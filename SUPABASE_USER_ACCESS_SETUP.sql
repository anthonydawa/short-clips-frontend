-- Shoort Clips user access model
-- Run once in the SQL Editor for project dymsvtgktszfofeuwxjn.
-- All current and future users receive active test_user access by default.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_type text not null default 'test_user'
    check (access_type in ('free_trial', 'paid', 'test_user')),
  is_active boolean not null default true,
  signup_source text not null default 'direct'
    check (signup_source in ('direct', 'free_trial_request', 'admin_invite')),
  trial_ends_at timestamptz,
  paid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_access enable row level security;

revoke all on table public.user_access from anon, authenticated;
grant select on table public.user_access to authenticated;

drop policy if exists "Users can read their own access" on public.user_access;
create policy "Users can read their own access"
on public.user_access
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.create_user_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_access (user_id, access_type, is_active, signup_source)
  values (
    new.id,
    'test_user',
    true,
    case
      when new.raw_user_meta_data ->> 'signup_source' = 'free_trial_request'
        then 'free_trial_request'
      when new.raw_user_meta_data ->> 'signup_source' = 'admin_invite'
        then 'admin_invite'
      else 'direct'
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function private.create_user_access() from public, anon, authenticated, service_role;

drop trigger if exists on_auth_user_created_access on auth.users;
create trigger on_auth_user_created_access
after insert on auth.users
for each row execute function private.create_user_access();

create or replace function private.touch_user_access_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.touch_user_access_updated_at() from public, anon, authenticated, service_role;

drop trigger if exists user_access_set_updated_at on public.user_access;
create trigger user_access_set_updated_at
before update on public.user_access
for each row execute function private.touch_user_access_updated_at();

-- Backfill everyone who signed up before this table existed.
insert into public.user_access (user_id, access_type, is_active, signup_source)
select id, 'test_user', true,
  case
    when raw_user_meta_data ->> 'signup_source' = 'free_trial_request'
      then 'free_trial_request'
    when raw_user_meta_data ->> 'signup_source' = 'admin_invite'
      then 'admin_invite'
    else 'direct'
  end
from auth.users
on conflict (user_id) do nothing;

comment on table public.user_access is
  'Server-controlled Shoort Clips access. Users may read their own row but cannot change access_type or is_active.';
