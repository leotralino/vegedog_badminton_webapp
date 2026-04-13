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
