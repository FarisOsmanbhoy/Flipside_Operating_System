-- ────────────────────────────────────────────────────────────────────
-- Soft-configurable lookup tables (spec §10)
-- Same shape: id, name, display_order, is_active + audit columns.
-- Admin-editable via /admin/config.
-- ────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  tables text[] := array[
    'client_statuses',
    'client_types',
    'task_priorities',
    'task_categories',
    'industry_alert_categories',
    'notice_categories'
  ];
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

-- Client section types — same shape plus icon + required_role
create table public.client_section_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  display_order int not null default 0,
  icon text,
  required_role public.user_role not null default 'editor',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create trigger trg_client_section_types_audit
  before insert or update on public.client_section_types
  for each row execute function public.set_audit_columns();
alter table public.client_section_types enable row level security;
create policy "section_types_read" on public.client_section_types
  for select to authenticated using (true);
create policy "section_types_admin_write" on public.client_section_types
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────────────
-- Seed defaults
-- ────────────────────────────────────────────────────────────────────
insert into public.client_statuses (name, display_order) values
  ('Active', 10), ('On hold', 20), ('Closed', 30)
on conflict (name) do nothing;

insert into public.client_types (name, display_order) values
  ('General Contractor', 10), ('Property Owner', 20),
  ('Subcontractor', 30), ('Architect', 40), ('Other', 99)
on conflict (name) do nothing;

insert into public.task_priorities (name, display_order) values
  ('Low', 10), ('Normal', 20), ('High', 30), ('Urgent', 40)
on conflict (name) do nothing;

insert into public.task_categories (name, display_order) values
  ('General', 10), ('Field', 20), ('Office', 30), ('Compliance', 40)
on conflict (name) do nothing;

insert into public.industry_alert_categories (name, display_order) values
  ('Regulation', 10), ('Supplier', 20), ('Weather', 30), ('General', 40)
on conflict (name) do nothing;

insert into public.notice_categories (name, display_order) values
  ('General', 10), ('Policy', 20), ('Office', 30)
on conflict (name) do nothing;

insert into public.client_section_types (slug, name, display_order, icon) values
  ('overview',       'Overview',                          10, 'info'),
  ('key-contacts',   'Key Contacts',                      30, 'users'),
  ('preferences',    'Preferences & Protocols',           40, 'sliders'),
  ('subcontractors', 'Approved Subs / Preferred Installers', 50, 'hammer'),
  ('billing',        'Billing & Terms',                   60, 'receipt'),
  ('documents',      'Documents',                         70, 'file-text'),
  ('projects',       'Past Projects',                     80, 'briefcase')
on conflict (slug) do nothing;
-- Note: "Important info & quirks" is the always-visible callout on the client
-- header (stored in clients.important_info), not a soft-configurable section.
