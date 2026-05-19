-- Departments (soft-configurable)
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create trigger trg_departments_audit
  before insert or update on public.departments
  for each row execute function public.set_audit_columns();

-- Roles enum
do $$ begin
  create type public.user_role as enum ('admin','manager','editor');
exception when duplicate_object then null; end $$;

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  role public.user_role not null default 'editor',
  department_id uuid references public.departments(id) on delete set null,
  phone text,
  mobile text,
  start_date date,
  avatar_url text,
  languages text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index profiles_role_idx on public.profiles(role);
create index profiles_dept_idx on public.profiles(department_id);
create index profiles_email_idx on public.profiles(lower(email));
create trigger trg_profiles_audit
  before insert or update on public.profiles
  for each row execute function public.set_audit_columns();

-- Trigger: when a new auth.users row appears, create a profile.
-- Default role = editor. Admin promotes via /admin/users.
-- Special-case: bootstrap admin email gets admin role.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case
      when lower(new.email) = 'farisosmanbhoy01@gmail.com' then 'admin'::public.user_role
      else 'editor'::public.user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- RLS
alter table public.departments enable row level security;
alter table public.profiles enable row level security;

-- Departments: all authenticated read; admin writes.
create policy "departments_read" on public.departments
  for select to authenticated using (true);
create policy "departments_admin_write" on public.departments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Profiles: all authenticated read.
create policy "profiles_read" on public.profiles
  for select to authenticated using (true);

-- Self-update (limited columns enforced at app layer; full row updates blocked).
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Admin can update/delete anyone (incl. role).
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy "profiles_admin_delete" on public.profiles
  for delete to authenticated
  using (public.is_admin());
-- Insert is only via the auth trigger above; no client insert policy.
