-- ============================================================
-- 1. THE NUKE: Clean up all existing app data and logic
-- ============================================================
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_user() cascade;
-- drop function if exists public.join_session(uuid, uuid, text) cascade;
-- drop function if exists public.withdraw_participant(uuid, uuid) cascade;

-- drop table if exists public.payment_records cascade;
-- drop table if exists public.payment_methods cascade;
-- drop table if exists public.participants cascade;
-- drop table if exists public.sessions cascade;
-- drop table if exists public.profiles cascade;

-- ============================================================
-- 2. TABLES: Rebuild from the ground up
-- ============================================================

-- Profiles must come first (others reference it)
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nickname       text not null default '',
  avatar_url     text,
  venmo_username text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Sessions
create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  location          text not null,
  starts_at         timestamptz not null,
  withdraw_deadline timestamptz not null,
  max_participants  int not null default 8,
  court_count       int not null default 2,
  fee_per_person    numeric(10,2),
  late_withdraw_ratio numeric(3,2) not null default 1.0,
  status            text not null default 'open' check (status in ('open','locked','canceled')),
  initiator_id      uuid not null references public.profiles(id),
  created_at        timestamptz not null default now()
);

-- Participants
create table public.participants (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id),
  display_name   text not null,
  queue_position int not null,
  status         text not null default 'joined' check (status in ('joined','waitlist','withdrawn','late_withdraw')),
  stayed_late    boolean not null default false,
  joined_at      timestamptz not null default now(),
  withdrew_at    timestamptz
);

-- Payment methods
create table public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  type        text not null check (type in ('venmo','zelle','other')),
  label       text not null,
  account_ref text not null,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- Payment records
create table public.payment_records (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sessions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  base_fee       numeric(10,2) not null default 0,
  late_fee       numeric(10,2) not null default 0,
  status         text not null default 'unpaid' check (status in ('unpaid','paid','waived')),
  note           text,
  updated_at     timestamptz not null default now(),
  unique (participant_id)
);

-- ============================================================
-- 3. LOGIC: Functions and Triggers
-- ============================================================

-- Auth Trigger Function
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Player'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Concurrency-safe Join
create or replace function public.join_session(
  p_session_id  uuid,
  p_user_id     uuid,
  p_display_name text
)
returns public.participants
language plpgsql security definer
as $$
declare
  v_session     public.sessions;
  v_joined_count int;
  v_queue_pos   int;
  v_status      text;
  v_result      public.participants;
begin
  perform pg_advisory_xact_lock(abs(hashtext(p_session_id::text)));
  select * into v_session from public.sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  if v_session.status != 'open' then raise exception 'Session is not open for joining'; end if;

  if exists (
    select 1 from public.participants
    where session_id = p_session_id and user_id = p_user_id and status in ('joined','waitlist')
  ) then raise exception 'You already have an active entry'; end if;

  select coalesce(max(queue_position), 0) + 1 into v_queue_pos from public.participants where session_id = p_session_id;
  select count(*) into v_joined_count from public.participants where session_id = p_session_id and status = 'joined';

  v_status := case when v_joined_count < v_session.max_participants then 'joined' else 'waitlist' end;

  insert into public.participants (session_id, user_id, display_name, queue_position, status)
  values (p_session_id, p_user_id, p_display_name, v_queue_pos, v_status)
  returning * into v_result;

  return v_result;
end;
$$;

-- Withdraw Function
create or replace function public.withdraw_participant(
  p_participant_id uuid,
  p_user_id        uuid
)
returns public.participants
language plpgsql security definer
as $$
declare
  v_participant public.participants;
  v_session     public.sessions;
  v_late        bool;
  v_new_status  text;
begin
  select * into v_participant from public.participants where id = p_participant_id;
  if not found then raise exception 'Participant not found'; end if;
  if v_participant.user_id != p_user_id then raise exception 'Not your entry'; end if;

  select * into v_session from public.sessions where id = v_participant.session_id;
  v_late      := now() > v_session.withdraw_deadline;
  v_new_status := case when v_late then 'late_withdraw' else 'withdrawn' end;

  update public.participants set status = v_new_status, withdrew_at = now() where id = p_participant_id returning * into v_participant;

  if v_new_status in ('withdrawn','late_withdraw') then
    update public.participants p set status = 'joined'
     where p.session_id = v_session.id and p.status = 'waitlist'
       and (select count(*) from public.participants where session_id = v_session.id and status = 'joined') < v_session.max_participants
       and p.queue_position = (select min(queue_position) from public.participants where session_id = v_session.id and status = 'waitlist');
  end if;
  return v_participant;
end;
$$;

-- ============================================================
-- 4. SECURITY: RLS and Permissions
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payment_records enable row level security;

-- Policies
create policy "profiles_select_all"   on public.profiles for select using (true);
create policy "profiles_insert_own"   on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"   on public.profiles for update using (auth.uid() = id);

create policy "sessions_select_all"   on public.sessions for select using (true);
create policy "sessions_insert_auth"  on public.sessions for insert with check (auth.uid() = initiator_id);
create policy "sessions_update_own"   on public.sessions for update using (auth.uid() = initiator_id);

create policy "participants_select_all"   on public.participants for select using (true);
create policy "participants_insert_auth"  on public.participants for insert with check (auth.uid() = user_id);
create policy "participants_update_own"   on public.participants for update using (auth.uid() = user_id);

create policy "methods_select_all"   on public.payment_methods for select using (true);
create policy "methods_insert_admin" on public.payment_methods for insert with check (auth.uid() = (select initiator_id from public.sessions where id = session_id));

create policy "records_select_admin" on public.payment_records for select using (auth.uid() = (select initiator_id from public.sessions where id = session_id));
create policy "records_upsert_admin" on public.payment_records for insert with check (auth.uid() = (select initiator_id from public.sessions where id = session_id));

-- Grant Access
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;
grant execute on function public.join_session to authenticated;
grant execute on function public.withdraw_participant to authenticated;

-- Indexes
create index if not exists idx_sessions_starts_at    on public.sessions(starts_at);
create index if not exists idx_participants_session  on public.participants(session_id, queue_position);