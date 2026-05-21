-- Suppliers (parallel to clients) — vendors / suppliers knowledge base.
-- Mirrors the clients structure 1:1, minus the subcontractors child table
-- (suppliers do not have sub-suppliers).

-- ────────────────────────────────────────────────────────────────────
-- Lookups: supplier_statuses, supplier_types (same shape as client_*)
-- ────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  tables text[] := array['supplier_statuses', 'supplier_types'];
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

-- Supplier section types
create table public.supplier_section_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  display_order int not null default 0,
  icon text,
  required_level int not null default 1
    check (required_level between 1 and 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create trigger trg_supplier_section_types_audit
  before insert or update on public.supplier_section_types
  for each row execute function public.set_audit_columns();
alter table public.supplier_section_types enable row level security;
create policy "supplier_section_types_read" on public.supplier_section_types
  for select to authenticated using (true);
create policy "supplier_section_types_admin_write" on public.supplier_section_types
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────────────
-- Seed defaults
-- ────────────────────────────────────────────────────────────────────
insert into public.supplier_statuses (name, display_order) values
  ('Active', 10), ('On hold', 20), ('Closed', 30)
on conflict (name) do nothing;

insert into public.supplier_types (name, display_order) values
  ('Materials', 10), ('Equipment', 20), ('Services', 30),
  ('Subcontractor', 40), ('Other', 99)
on conflict (name) do nothing;

-- Same sections as clients, minus subcontractors.
insert into public.supplier_section_types (slug, name, display_order, icon) values
  ('overview',     'Overview',                 10, 'info'),
  ('key-contacts', 'Key Contacts',             30, 'users'),
  ('preferences',  'Preferences & Protocols',  40, 'sliders'),
  ('billing',      'Billing & Terms',          60, 'receipt'),
  ('documents',    'Documents',                70, 'file-text'),
  ('projects',     'Past Projects',            80, 'briefcase')
on conflict (slug) do nothing;

-- ────────────────────────────────────────────────────────────────────
-- Suppliers (mirrors clients)
-- ────────────────────────────────────────────────────────────────────
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type_id uuid references public.supplier_types(id) on delete set null,
  status_id uuid references public.supplier_statuses(id) on delete set null,
  location text,
  since_date date,
  assigned_pm_id uuid references public.profiles(id) on delete set null,
  important_info text,
  logo_url text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index suppliers_status_idx on public.suppliers(status_id);
create index suppliers_pm_idx on public.suppliers(assigned_pm_id);
create index suppliers_name_trgm on public.suppliers using gin (name gin_trgm_ops);
create index suppliers_fts on public.suppliers using gin (
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(important_info,'') || ' ' || coalesce(notes,''))
);
create trigger trg_suppliers_audit
  before insert or update on public.suppliers
  for each row execute function public.set_audit_columns();

-- Section data: one row per (supplier, section_type)
create table public.supplier_section_data (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  section_type_id uuid not null references public.supplier_section_types(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (supplier_id, section_type_id)
);
create index ssd_supplier_idx on public.supplier_section_data(supplier_id);
create trigger trg_ssd_audit
  before insert or update on public.supplier_section_data
  for each row execute function public.set_audit_columns();

-- Contacts
create table public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  preferred_channel text,
  notes text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index supplier_contacts_supplier_idx on public.supplier_contacts(supplier_id);
create trigger trg_supplier_contacts_audit
  before insert or update on public.supplier_contacts
  for each row execute function public.set_audit_columns();

-- ────────────────────────────────────────────────────────────────────
-- RLS — matches clients: read for all authenticated, write for managers/admin
-- ────────────────────────────────────────────────────────────────────
alter table public.suppliers enable row level security;
alter table public.supplier_section_data enable row level security;
alter table public.supplier_contacts enable row level security;

create policy "suppliers_read" on public.suppliers
  for select to authenticated using (true);
create policy "ssd_read" on public.supplier_section_data
  for select to authenticated using (true);
create policy "supplier_contacts_read" on public.supplier_contacts
  for select to authenticated using (true);

create policy "suppliers_write" on public.suppliers
  for all to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "ssd_write" on public.supplier_section_data
  for all to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "supplier_contacts_write" on public.supplier_contacts
  for all to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());

-- ────────────────────────────────────────────────────────────────────
-- Tasks: link change requests so they can surface as tasks for admins.
-- ────────────────────────────────────────────────────────────────────
alter table public.tasks
  add column if not exists linked_change_request_id uuid
  references public.change_requests(id) on delete set null;
create index if not exists tasks_linked_change_request_idx
  on public.tasks(linked_change_request_id);
