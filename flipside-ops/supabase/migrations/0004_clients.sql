-- Clients (the knowledge base subject)
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type_id uuid references public.client_types(id) on delete set null,
  status_id uuid references public.client_statuses(id) on delete set null,
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
create index clients_status_idx on public.clients(status_id);
create index clients_pm_idx on public.clients(assigned_pm_id);
create index clients_name_trgm on public.clients using gin (name gin_trgm_ops);
create index clients_fts on public.clients using gin (
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(important_info,'') || ' ' || coalesce(notes,''))
);
create trigger trg_clients_audit
  before insert or update on public.clients
  for each row execute function public.set_audit_columns();

-- Section data: one row per (client, section_type), jsonb-shaped per section
create table public.client_section_data (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  section_type_id uuid not null references public.client_section_types(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (client_id, section_type_id)
);
create index csd_client_idx on public.client_section_data(client_id);
create trigger trg_csd_audit
  before insert or update on public.client_section_data
  for each row execute function public.set_audit_columns();

-- Contacts
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
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
create index client_contacts_client_idx on public.client_contacts(client_id);
create trigger trg_client_contacts_audit
  before insert or update on public.client_contacts
  for each row execute function public.set_audit_columns();

-- Subcontractors
do $$ begin
  create type public.sub_status as enum ('preferred','backup','blacklisted');
exception when duplicate_object then null; end $$;

create table public.client_subcontractors (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  trade text not null,
  company_name text not null,
  status public.sub_status not null default 'preferred',
  contact text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index client_subs_client_idx on public.client_subcontractors(client_id);
create index client_subs_status_idx on public.client_subcontractors(status);
create trigger trg_client_subs_audit
  before insert or update on public.client_subcontractors
  for each row execute function public.set_audit_columns();

-- ────────────────────────────────────────────────────────────────────
-- RLS — write = admin OR (manager); editor read-only.
-- Spec §4: editors are not viewers, they can read but must request changes.
-- ────────────────────────────────────────────────────────────────────
alter table public.clients enable row level security;
alter table public.client_section_data enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_subcontractors enable row level security;

-- Read for all authenticated
create policy "clients_read"     on public.clients     for select to authenticated using (true);
create policy "csd_read"         on public.client_section_data for select to authenticated using (true);
create policy "contacts_read"    on public.client_contacts     for select to authenticated using (true);
create policy "subs_read"        on public.client_subcontractors for select to authenticated using (true);

-- Manager/admin write
create policy "clients_write"  on public.clients
  for all to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "csd_write"      on public.client_section_data
  for all to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "contacts_write" on public.client_contacts
  for all to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy "subs_write"     on public.client_subcontractors
  for all to authenticated
  using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
