-- AI-assisted import + data-quality diagnostics support tables.
--
-- ai_usage_log    — append-only audit of every Anthropic API call we make,
--                   surfaced in /admin/audit so admins can see cost + traffic.
-- ai_diagnostics  — findings produced by the diagnostics scanner (duplicates,
--                   missing fields, anomalies). Admin can dismiss or act on
--                   each row.
--
-- Both tables are admin-only (read + write). RLS denies non-admins entirely.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- ai_usage_log
-- ─────────────────────────────────────────────────────────────────────
create table public.ai_usage_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  endpoint      text not null,    -- 'import.map' | 'import.clarify' | 'cleanup.suggest' | 'diagnostics.scan' | 'smoke'
  model         text not null,    -- e.g. 'claude-haiku-4-5-20251001'
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  cost_usd      numeric(10,6) not null default 0,
  created_at    timestamptz not null default now()
);
create index ai_usage_log_created_idx on public.ai_usage_log(created_at desc);
create index ai_usage_log_endpoint_idx on public.ai_usage_log(endpoint);

alter table public.ai_usage_log enable row level security;

-- Admins read; writes happen via service role from the server only.
create policy "ai_usage_log_admin_read" on public.ai_usage_log
  for select to authenticated
  using (public.is_admin());
-- No insert/update/delete policy = blocked from any non-service-role caller.

-- ─────────────────────────────────────────────────────────────────────
-- ai_diagnostics
-- ─────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.ai_finding_severity as enum ('info', 'warn');
exception when duplicate_object then null; end $$;

create table public.ai_diagnostics (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('client', 'supplier', 'password')),
  entity_id     uuid not null,
  issue_type    text not null check (issue_type in ('duplicate', 'missing_field', 'anomaly')),
  severity      public.ai_finding_severity not null default 'info',
  suggestion    text not null,
  payload       jsonb,            -- structured extras, e.g. { duplicate_of: <uuid>, field: 'type_id' }
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  dismissed_at  timestamptz,
  dismissed_by  uuid references public.profiles(id) on delete set null,
  acted_at      timestamptz,
  -- One open finding per (entity, issue_type, payload hash) so re-running the
  -- scanner doesn't pile up duplicates. We hash payload jsonb via md5 of its
  -- canonical text form.
  finding_key   text generated always as (
    entity_type || ':' || entity_id::text || ':' || issue_type || ':' ||
    md5(coalesce(payload::text, ''))
  ) stored
);
create unique index ai_diagnostics_open_unique
  on public.ai_diagnostics(finding_key)
  where dismissed_at is null;
create index ai_diagnostics_entity_idx on public.ai_diagnostics(entity_type, entity_id);
create index ai_diagnostics_open_idx on public.ai_diagnostics(created_at desc)
  where dismissed_at is null;

alter table public.ai_diagnostics enable row level security;

create policy "ai_diagnostics_admin_read" on public.ai_diagnostics
  for select to authenticated
  using (public.is_admin());

create policy "ai_diagnostics_admin_update" on public.ai_diagnostics
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Inserts happen via service role from the diagnostics scanner. No insert
-- policy means non-service-role clients cannot fabricate findings.
