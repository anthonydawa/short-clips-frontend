-- Shoort Clips user access model
-- Run once in the SQL Editor for project dymsvtgktszfofeuwxjn.
-- Free-trial signups receive 30 days of access. Regular signups remain locked
-- until a verified Creem webhook activates paid access.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_type text not null default 'paid'
    check (access_type in ('free_trial', 'paid', 'test_user')),
  is_active boolean not null default false,
  signup_source text not null default 'direct'
    check (signup_source in ('direct', 'paid_signup', 'free_trial_request', 'admin_invite')),
  trial_ends_at timestamptz,
  paid_until timestamptz,
  creem_customer_id text,
  creem_subscription_id text,
  subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to rerun after the earlier test-user version of this setup.
alter table public.user_access drop constraint if exists user_access_access_type_check;
alter table public.user_access add constraint user_access_access_type_check
  check (access_type in ('free_trial', 'paid', 'test_user'));
alter table public.user_access drop constraint if exists user_access_signup_source_check;
alter table public.user_access add constraint user_access_signup_source_check
  check (signup_source in ('direct', 'paid_signup', 'free_trial_request', 'admin_invite'));
alter table public.user_access alter column access_type set default 'paid';
alter table public.user_access alter column is_active set default false;
alter table public.user_access add column if not exists creem_customer_id text;
alter table public.user_access add column if not exists creem_subscription_id text;
alter table public.user_access add column if not exists subscription_status text;
create unique index if not exists user_access_creem_customer_unique
  on public.user_access (creem_customer_id) where creem_customer_id is not null;
create unique index if not exists user_access_creem_subscription_unique
  on public.user_access (creem_subscription_id) where creem_subscription_id is not null;

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
  insert into public.user_access (user_id, access_type, is_active, signup_source, trial_ends_at)
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'signup_source' = 'free_trial_request'
        then 'free_trial'
      when new.raw_user_meta_data ->> 'signup_source' = 'admin_invite'
        then 'test_user'
      else 'paid'
    end,
    case
      when new.raw_user_meta_data ->> 'signup_source' in ('free_trial_request', 'admin_invite') then true
      else false
    end,
    case
      when new.raw_user_meta_data ->> 'signup_source' = 'free_trial_request' then 'free_trial_request'
      when new.raw_user_meta_data ->> 'signup_source' = 'paid_signup' then 'paid_signup'
      when new.raw_user_meta_data ->> 'signup_source' = 'admin_invite' then 'admin_invite'
      else 'direct'
    end,
    case
      when new.raw_user_meta_data ->> 'signup_source' = 'free_trial_request' then now() + interval '30 days'
      else null
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
insert into public.user_access (user_id, access_type, is_active, signup_source, trial_ends_at)
select id,
  case
    when raw_user_meta_data ->> 'signup_source' = 'free_trial_request' then 'free_trial'
    when raw_user_meta_data ->> 'signup_source' = 'admin_invite' then 'test_user'
    else 'paid'
  end,
  case
    when raw_user_meta_data ->> 'signup_source' in ('free_trial_request', 'admin_invite') then true
    else false
  end,
  case
    when raw_user_meta_data ->> 'signup_source' = 'free_trial_request'
      then 'free_trial_request'
    when raw_user_meta_data ->> 'signup_source' = 'paid_signup'
      then 'paid_signup'
    when raw_user_meta_data ->> 'signup_source' = 'admin_invite'
      then 'admin_invite'
    else 'direct'
  end,
  case
    when raw_user_meta_data ->> 'signup_source' = 'free_trial_request' then now() + interval '30 days'
    else null
  end
from auth.users
on conflict (user_id) do nothing;

-- Correct rows created by the earlier all-test-user trigger without touching
-- accounts that were manually promoted to paid or test access.
update public.user_access as access
set access_type = 'free_trial',
    is_active = true,
    signup_source = 'free_trial_request',
    trial_ends_at = coalesce(access.trial_ends_at, access.created_at + interval '30 days')
from auth.users as auth_user
where access.user_id = auth_user.id
  and auth_user.raw_user_meta_data ->> 'signup_source' = 'free_trial_request'
  and access.access_type = 'test_user'
  and access.paid_until is null;

update public.user_access as access
set access_type = 'paid',
    is_active = false,
    signup_source = 'paid_signup'
from auth.users as auth_user
where access.user_id = auth_user.id
  and auth_user.raw_user_meta_data ->> 'signup_source' = 'paid_signup'
  and access.access_type = 'test_user'
  and access.paid_until is null;

comment on table public.user_access is
  'Server-controlled Shoort Clips access. Users may read their own row but cannot change access_type or is_active.';
