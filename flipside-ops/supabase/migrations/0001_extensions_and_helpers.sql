-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ────────────────────────────────────────────────────────────────────
-- Audit columns trigger
-- Sets created_at/created_by on insert and updated_at/updated_by on update.
-- auth.uid() returns null for service-role / SQL editor writes; that's fine.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.set_audit_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_at = now();
    new.updated_by = auth.uid();
  elsif tg_op = 'UPDATE' then
    new.updated_at = now();
    new.updated_by = auth.uid();
    new.created_at = old.created_at;
    new.created_by = old.created_by;
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────
-- auth_role() — security-definer helper to read the current user's role
-- without recursing through RLS.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(auth_role() = 'admin', false); $$;

create or replace function public.is_manager_or_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(auth_role() in ('admin','manager'), false); $$;
