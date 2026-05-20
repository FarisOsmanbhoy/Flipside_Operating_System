-- Replace the user_role enum with a numeric access_level (1=editor, 2=manager,
-- 3=admin). Helper-function NAMES are preserved (is_admin, is_manager_or_admin)
-- so every RLS policy that references them keeps working transparently; only
-- the function bodies change to read access_level.
--
-- Also grants EXECUTE back to `authenticated` on those helpers. The earlier
-- blanket revoke was the cause of "permission denied for function is_admin" at
-- runtime: RLS policies invoke these functions as the calling role, and
-- SECURITY DEFINER does not bypass the EXECUTE privilege check.

-- 1. profiles.access_level: new column, backfilled from existing role.
alter table public.profiles
  add column if not exists access_level int;

update public.profiles
set access_level = case role
  when 'admin' then 3
  when 'manager' then 2
  when 'editor' then 1
end
where access_level is null;

alter table public.profiles
  alter column access_level set not null,
  alter column access_level set default 1;

alter table public.profiles
  add constraint profiles_access_level_check
    check (access_level between 1 and 3);

create index if not exists profiles_access_level_idx
  on public.profiles(access_level);

-- 2. client_section_types.required_level: same conversion. Gates which
--    sections a level-1 user can see/edit.
alter table public.client_section_types
  add column if not exists required_level int;

update public.client_section_types
set required_level = case required_role
  when 'admin' then 3
  when 'manager' then 2
  when 'editor' then 1
end
where required_level is null;

alter table public.client_section_types
  alter column required_level set not null,
  alter column required_level set default 1;

alter table public.client_section_types
  add constraint client_section_types_required_level_check
    check (required_level between 1 and 3);

-- 3. New helper that returns the int level.
create or replace function public.auth_level()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select access_level from public.profiles where id = auth.uid();
$$;

-- 4. Rewrite is_admin / is_manager_or_admin to read access_level. Same names,
--    same return types — every existing policy keeps working.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_level() >= 3, false);
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_level() >= 2, false);
$$;

-- 5. Thin shim for any caller still reading auth_role() as text. Removed after
--    the TypeScript refactor stops referencing it.
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case public.auth_level()
    when 3 then 'admin'
    when 2 then 'manager'
    when 1 then 'editor'
  end;
$$;

-- 6. Grant EXECUTE back to authenticated. This is the actual fix for the
--    "permission denied for function is_admin" runtime error.
grant execute on function public.auth_level() to authenticated;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_manager_or_admin() to authenticated;

-- 7. Update the new-auth-user trigger to set access_level directly. Bootstrap
--    admin email gets level 3; everyone else lands at level 1.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, access_level)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case
      when lower(new.email) = 'farisosmanbhoy01@gmail.com' then 3
      else 1
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 8. Self-update policy: prevent self-elevation by pinning access_level to the
--    current value (previously pinned role).
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and access_level = (
      select access_level from public.profiles where id = auth.uid()
    )
  );

-- 9. Drop old enum-typed columns and the enum itself.
alter table public.profiles drop column if exists role;
alter table public.client_section_types drop column if exists required_role;
drop type if exists public.user_role;
