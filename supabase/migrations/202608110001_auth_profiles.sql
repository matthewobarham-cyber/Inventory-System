create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  role text not null default 'Staff' check (role in ('Admin', 'Student assistant', 'Auditor', 'Staff')),
  active boolean not null default true,
  tsr boolean not null default false,
  campus_id text not null default '',
  title text not null default '',
  department text not null default '',
  phone text not null default '',
  office text not null default '',
  manager text not null default '',
  joined text not null default '',
  avatar text,
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'Admin' and active = true
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Users read their own profile and administrators read all" on public.profiles;
create policy "Users read their own profile and administrators read all"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.current_user_is_admin()));

drop policy if exists "Administrators can update profiles" on public.profiles;
create policy "Administrators can update profiles"
on public.profiles for update to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

create or replace function public.set_own_profile_avatar(new_avatar text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set avatar = new_avatar, updated_at = now()
  where id = (select auth.uid()) and active = true;
end;
$$;

revoke all on function public.set_own_profile_avatar(text) from public;
grant execute on function public.set_own_profile_avatar(text) to authenticated;

create or replace function public.touch_own_profile_last_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set last_seen = now(), updated_at = now()
  where id = (select auth.uid()) and active = true;
end;
$$;

revoke all on function public.touch_own_profile_last_seen() from public;
grant execute on function public.touch_own_profile_last_seen() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, role, active, tsr, campus_id, title, department, phone, office, manager, joined)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when new.raw_user_meta_data ->> 'role' in ('Admin', 'Student assistant', 'Auditor', 'Staff') then new.raw_user_meta_data ->> 'role' else 'Staff' end,
    true,
    coalesce((new.raw_user_meta_data ->> 'tsr')::boolean, false),
    coalesce(new.raw_user_meta_data ->> 'campus_id', ''),
    coalesce(new.raw_user_meta_data ->> 'title', ''),
    coalesce(new.raw_user_meta_data ->> 'department', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'office', ''),
    coalesce(new.raw_user_meta_data ->> 'manager', ''),
    coalesce(new.raw_user_meta_data ->> 'joined', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
