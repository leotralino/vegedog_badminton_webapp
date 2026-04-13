-- ============================================================
-- VegDog Badminton — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL editor)
-- ============================================================

-- ── Profiles (one per auth user) ──────────────────────────
create table if not exists profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nickname       text not null default '',
  avatar_url     text,
  venmo_username text,   -- Venmo username, e.g. "alice-bmt"
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Player'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Sessions ──────────────────────────────────────────────
create table if not exists sessions (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  location          text not null,
  starts_at         timestamptz not null,
  withdraw_deadline timestamptz not null,
  max_participants  int not null default 8,
  court_count       int not null default 2,
  fee_per_person    numeric(10,2),
  late_withdraw_ratio numeric(3,2) not null default 1.0,
  status            text not null default 'open'
                    check (status in ('open','locked','canceled')),
  initiator_id      uuid not null references profiles(id),
  created_at        timestamptz not null default now()
);

-- ── Participants (queue entries) ───────────────────────────
create table if not exists participants (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  user_id        uuid not null references profiles(id),
  display_name   text not null,
  queue_position int not null,
  status         text not null default 'joined'
                 check (status in ('joined','waitlist','withdrawn','late_withdraw')),
  stayed_late    boolean not null default false,
  joined_at      timestamptz not null default now(),
  withdrew_at    timestamptz
);

-- ── Payment methods (per session, set by organiser) ───────
create table if not exists payment_methods (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  type        text not null check (type in ('venmo','zelle','other')),
  label       text not null,
  account_ref text not null,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);

-- ── Payment records (per participant) ─────────────────────
create table if not exists payment_records (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  base_fee       numeric(10,2) not null default 0,
  late_fee       numeric(10,2) not null default 0,
  status         text not null default 'unpaid'
                 check (status in ('unpaid','paid','waived')),
  note           text,
  updated_at     timestamptz not null default now(),
  unique (participant_id)
);

-- ── Indexes ───────────────────────────────────────────────
create index if not exists idx_sessions_starts_at    on sessions(starts_at);
create index if not exists idx_sessions_status       on sessions(status);
create index if not exists idx_participants_session  on participants(session_id, queue_position);
create index if not exists idx_participants_user     on participants(session_id, user_id);
create index if not exists idx_payment_records_part  on payment_records(participant_id);

-- ── Concurrency-safe join function ────────────────────────
-- Uses pg_advisory_xact_lock to serialise concurrent joins per session,
-- so 100 people clicking "Join" at the same moment get correct queue positions.
create or replace function join_session(
  p_session_id  uuid,
  p_user_id     uuid,
  p_display_name text
)
returns participants
language plpgsql security definer
as $$
declare
  v_session     sessions;
  v_joined_count int;
  v_queue_pos   int;
  v_status      text;
  v_result      participants;
begin
  -- Serialize per session (advisory lock scoped to the transaction)
  perform pg_advisory_xact_lock(abs(hashtext(p_session_id::text)));

  select * into v_session from sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status != 'open' then
    raise exception 'Session is not open for joining';
  end if;

  -- Prevent exact duplicate active entries
  if exists (
    select 1 from participants
    where session_id = p_session_id
      and user_id    = p_user_id
      and display_name = p_display_name
      and status in ('joined','waitlist')
  ) then
    raise exception 'You already have an active entry with this name';
  end if;

  -- Next queue position
  select coalesce(max(queue_position), 0) + 1
    into v_queue_pos
    from participants
   where session_id = p_session_id;

  -- Determine slot vs waitlist
  select count(*) into v_joined_count
    from participants
   where session_id = p_session_id and status = 'joined';

  v_status := case
    when v_joined_count < v_session.max_participants then 'joined'
    else 'waitlist'
  end;

  insert into participants (session_id, user_id, display_name, queue_position, status)
  values (p_session_id, p_user_id, p_display_name, v_queue_pos, v_status)
  returning * into v_result;

  return v_result;
end;
$$;

-- ── Withdraw function ─────────────────────────────────────
create or replace function withdraw_participant(
  p_participant_id uuid,
  p_user_id        uuid
)
returns participants
language plpgsql security definer
as $$
declare
  v_participant participants;
  v_session     sessions;
  v_late        bool;
  v_new_status  text;
begin
  select * into v_participant from participants where id = p_participant_id;
  if not found then raise exception 'Participant not found'; end if;
  if v_participant.user_id != p_user_id then raise exception 'Not your entry'; end if;
  if v_participant.status not in ('joined','waitlist') then raise exception 'Already withdrawn'; end if;

  select * into v_session from sessions where id = v_participant.session_id;
  if v_session.status = 'locked' then raise exception 'Session is locked'; end if;

  v_late      := now() > v_session.withdraw_deadline;
  v_new_status := case when v_late then 'late_withdraw' else 'withdrawn' end;

  update participants
     set status = v_new_status, withdrew_at = now()
   where id = p_participant_id
  returning * into v_participant;

  -- Promote waitlist → joined if a slot freed up
  if v_new_status in ('withdrawn','late_withdraw') then
    perform pg_advisory_xact_lock(abs(hashtext(v_session.id::text)));
    update participants p
       set status = 'joined'
     where p.session_id = v_session.id
       and p.status = 'waitlist'
       and (select count(*) from participants where session_id = v_session.id and status = 'joined')
           < v_session.max_participants
       and p.queue_position = (
         select min(queue_position) from participants
          where session_id = v_session.id and status = 'waitlist'
       );
  end if;

  return v_participant;
end;
$$;

-- ── Row Level Security ────────────────────────────────────
alter table profiles         enable row level security;
alter table sessions         enable row level security;
alter table participants     enable row level security;
alter table payment_methods  enable row level security;
alter table payment_records  enable row level security;

-- Profiles: anyone can read; users can insert/update their own
create policy "profiles_select_all"   on profiles for select using (true);
create policy "profiles_insert_own"   on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"   on profiles for update using (auth.uid() = id);

-- Sessions: anyone can read; auth users can create; initiator can update
create policy "sessions_select_all"   on sessions for select using (true);
create policy "sessions_insert_auth"  on sessions for insert with check (auth.uid() = initiator_id);
create policy "sessions_update_own"   on sessions for update using (auth.uid() = initiator_id);

-- Participants: anyone can read; auth users insert via function; users can withdraw own
create policy "participants_select_all"   on participants for select using (true);
create policy "participants_insert_auth"  on participants for insert with check (auth.uid() = user_id);
create policy "participants_update_own"   on participants for update using (auth.uid() = user_id);
-- Admins (initiator) can also update participant metadata (stayed_late)
create policy "participants_update_admin" on participants for update
  using (
    auth.uid() = (select initiator_id from sessions where id = session_id)
  );

-- Payment methods: anyone can read; initiator can insert/delete
create policy "methods_select_all"   on payment_methods for select using (true);
create policy "methods_insert_admin" on payment_methods for insert
  with check (auth.uid() = (select initiator_id from sessions where id = session_id));
create policy "methods_delete_admin" on payment_methods for delete
  using (auth.uid() = (select initiator_id from sessions where id = session_id));

-- Payment records: session initiator can read/write
create policy "records_select_admin" on payment_records for select
  using (auth.uid() = (select initiator_id from sessions where id = session_id));
create policy "records_upsert_admin" on payment_records for insert
  with check (auth.uid() = (select initiator_id from sessions where id = session_id));
create policy "records_update_admin" on payment_records for update
  using (auth.uid() = (select initiator_id from sessions where id = session_id));

-- Grant execute on functions
grant execute on function join_session        to authenticated;
grant execute on function withdraw_participant to authenticated;
