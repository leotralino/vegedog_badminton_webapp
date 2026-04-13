-- ⚠️  FULL RESET — drops all app tables, functions, triggers, and policies
-- Run this in Supabase SQL Editor, then run schema.sql afterwards.

-- Drop functions
drop function if exists join_session(uuid, uuid, text) cascade;
drop function if exists withdraw_participant(uuid, uuid) cascade;
drop function if exists handle_new_user() cascade;

-- Drop triggers
drop trigger if exists on_auth_user_created on auth.users;

-- Drop tables (cascade removes policies, indexes, foreign keys)
drop table if exists payment_records  cascade;
drop table if exists payment_methods  cascade;
drop table if exists participants      cascade;
drop table if exists sessions          cascade;
drop table if exists profiles          cascade;
