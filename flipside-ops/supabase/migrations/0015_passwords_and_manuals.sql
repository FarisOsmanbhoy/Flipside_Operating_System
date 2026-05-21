-- ────────────────────────────────────────────────────────────────────
-- Passwords vault + Manuals / Guides
-- Two domain tables backed by two soft-configurable category lookups,
-- with audit triggers, RLS (read = any authenticated, write = manager or
-- admin), and a private `manuals` storage bucket for uploaded files.
-- ────────────────────────────────────────────────────────────────────

-- ── Category lookups ────────────────────────────────────────────────
-- Same shape as the other lookups in migration 0003 so /admin/config's
-- LookupEditor can drive them without any new component code. Writes
-- gated to admins to match the existing lookup-editor permission model.
do $$
declare
  t text;
  tables text[] := array['password_categories', 'manual_categories'];
begin
  foreach t in array tables loop
    execute format('
      create table public.%I (
        id uuid primary key default gen_random_uuid(),
        name text not null unique,
        display_order int not null default 0,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        created_by uuid,
        updated_at timestamptz not null default now(),
        updated_by uuid
      );
      create trigger trg_%I_audit
        before insert or update on public.%I
        for each row execute function public.set_audit_columns();
      alter table public.%I enable row level security;
      create policy "%I_read" on public.%I
        for select to authenticated using (true);
      create policy "%I_admin_write" on public.%I
        for all to authenticated
        using (public.is_admin()) with check (public.is_admin());
    ', t, t, t, t, t, t, t, t);
  end loop;
end $$;

-- Seed categories from the PROPS mockups so the pages aren't empty.
insert into public.password_categories (name, display_order) values
  ('AIPs', 10),
  ('Aircraft Tracking', 20),
  ('Operations', 30),
  ('Accounts', 40),
  ('Other', 99)
on conflict (name) do nothing;

insert into public.manual_categories (name, display_order) values
  ('Accounts', 10),
  ('Operations', 20),
  ('Compliance', 30),
  ('Fuelworx', 40),
  ('Barclaycard', 50),
  ('Other', 99)
on conflict (name) do nothing;

-- ── passwords ───────────────────────────────────────────────────────
create table public.passwords (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.password_categories(id) on delete restrict,
  system text not null,
  dept_id uuid references public.departments(id) on delete set null,
  username text,
  password text,
  web_address text,
  further_info text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index passwords_category_idx on public.passwords(category_id);
create index passwords_dept_idx on public.passwords(dept_id);

create trigger trg_passwords_audit_cols
  before insert or update on public.passwords
  for each row execute function public.set_audit_columns();

create trigger trg_audit_passwords
  after insert or update or delete on public.passwords
  for each row execute function public.log_audit();

alter table public.passwords enable row level security;

create policy "passwords_read" on public.passwords
  for select to authenticated using (true);

create policy "passwords_write" on public.passwords
  for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

-- ── manuals ─────────────────────────────────────────────────────────
create table public.manuals (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.manual_categories(id) on delete restrict,
  title text not null,
  company text,
  reference text,
  revision_no int,
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  storage_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index manuals_category_idx on public.manuals(category_id);
create index manuals_author_idx on public.manuals(author_id);

create trigger trg_manuals_audit_cols
  before insert or update on public.manuals
  for each row execute function public.set_audit_columns();

create trigger trg_audit_manuals
  after insert or update or delete on public.manuals
  for each row execute function public.log_audit();

alter table public.manuals enable row level security;

create policy "manuals_read" on public.manuals
  for select to authenticated using (true);

create policy "manuals_write" on public.manuals
  for all to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

-- ── Storage bucket for manual files ─────────────────────────────────
insert into storage.buckets (id, name, public)
values ('manuals', 'manuals', false)
on conflict (id) do nothing;

create policy "manuals_bucket_read" on storage.objects
  for select to authenticated using (bucket_id = 'manuals');

create policy "manuals_bucket_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'manuals' and public.is_manager_or_admin());

create policy "manuals_bucket_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'manuals' and public.is_manager_or_admin());

create policy "manuals_bucket_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'manuals' and public.is_manager_or_admin());
