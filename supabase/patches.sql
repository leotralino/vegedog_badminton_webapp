-- Run this in Supabase SQL Editor to apply fixes.
-- Safe to re-run (uses create or replace).

-- Fix 1: Allow multiple entries per user with different names
-- (original check blocked ANY second join; now only blocks duplicate names)
create or replace function public.join_session(
  p_session_id   uuid,
  p_user_id      uuid,
  p_display_name text
)
returns public.participants
language plpgsql security definer
as $$
declare
  v_session      public.sessions;
  v_joined_count int;
  v_queue_pos    int;
  v_status       text;
  v_result       public.participants;
begin
  perform pg_advisory_xact_lock(abs(hashtext(p_session_id::text)));

  select * into v_session from public.sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  if v_session.status != 'open' then raise exception 'Session is not open for joining'; end if;

  -- Only block if this exact name is already active (allows +1, +2 etc.)
  if exists (
    select 1 from public.participants
    where session_id   = p_session_id
      and user_id      = p_user_id
      and display_name = p_display_name
      and status in ('joined', 'waitlist')
  ) then
    raise exception 'You already have an active entry with this name';
  end if;

  select coalesce(max(queue_position), 0) + 1
    into v_queue_pos
    from public.participants where session_id = p_session_id;

  select count(*) into v_joined_count
    from public.participants
   where session_id = p_session_id and status = 'joined';

  v_status := case
    when v_joined_count < v_session.max_participants then 'joined'
    else 'waitlist'
  end;

  insert into public.participants (session_id, user_id, display_name, queue_position, status)
  values (p_session_id, p_user_id, p_display_name, v_queue_pos, v_status)
  returning * into v_result;

  return v_result;
end;
$$;

-- Fix 2: Admin can update participants (e.g. toggle stayed_late)
drop policy if exists "participants_update_admin" on public.participants;
create policy "participants_update_admin" on public.participants for update
  using (auth.uid() = (select initiator_id from public.sessions where id = session_id));

-- Fix 3: DiceBear avatar for email/password users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Player'),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/9.x/thumbs/svg?seed=' || new.id::text
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill DiceBear for existing users without an avatar
update public.profiles
set avatar_url = 'https://api.dicebear.com/9.x/thumbs/svg?seed=' || id::text
where avatar_url is null or avatar_url = '';

-- Fix 4: Enable Realtime for live queue updates
alter publication supabase_realtime add table public.participants;

-- Fix 5: Add notes and location_address columns to sessions, make fee fields optional
alter table public.sessions
  add column if not exists notes            text,
  add column if not exists location_address text,
  alter column fee_per_person               set default null,
  alter column late_withdraw_ratio          drop not null;

alter table public.sessions
  alter column late_withdraw_ratio set default null;

-- Fix 6: Add 'closed' status for manual move-to-history
alter table public.sessions
  drop constraint if exists sessions_status_check;

alter table public.sessions
  add constraint sessions_status_check
  check (status in ('open', 'locked', 'canceled', 'closed'));

-- Fix 7: Allow users to self-report payment on their own participant entries
drop policy if exists "payment_records_insert_own" on public.payment_records;
create policy "payment_records_insert_own" on public.payment_records
  for insert with check (
    exists (
      select 1 from public.participants
      where participants.id = payment_records.participant_id
        and participants.user_id = auth.uid()
    )
  );

drop policy if exists "payment_records_update_own" on public.payment_records;
create policy "payment_records_update_own" on public.payment_records
  for update using (
    exists (
      select 1 from public.participants
      where participants.id = payment_records.participant_id
        and participants.user_id = auth.uid()
    )
  );

-- Fix 8: Allow all authenticated users to read payment records (so everyone can see who paid)
-- Remove admin-only SELECT and unused admin INSERT
drop policy if exists "records_select_admin" on public.payment_records;
drop policy if exists "payment_records_select_own" on public.payment_records;
drop policy if exists "records_upsert_admin" on public.payment_records;
create policy "payment_records_select_authenticated" on public.payment_records
  for select using (auth.role() = 'authenticated');

-- Fix 9: DB trigger — auto-initialize payment records when a session is locked.
-- Runs server-side (security definer) so RLS does not block inserts for other users.
create or replace function public.initialize_payment_records()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'locked' and old.status != 'locked' then
    insert into public.payment_records (session_id, participant_id, base_fee, late_fee, status)
    select new.id, p.id, 0, 0, 'unpaid'
    from public.participants p
    where p.session_id = new.id
      and p.status = 'joined'
      and not exists (
        select 1 from public.payment_records r where r.participant_id = p.id
      );
  end if;
  return new;
end;
$$;

drop trigger if exists on_session_locked on public.sessions;
create trigger on_session_locked
  after update on public.sessions
  for each row execute function public.initialize_payment_records();

-- Fix 9b: Backfill for sessions already locked before this trigger existed.
insert into public.payment_records (session_id, participant_id, base_fee, late_fee, status)
select p.session_id, p.id, 0, 0, 'unpaid'
from public.participants p
join public.sessions s on s.id = p.session_id
where s.status in ('locked', 'closed')
  and p.status = 'joined'
  and not exists (
    select 1 from public.payment_records r where r.participant_id = p.id
  );
