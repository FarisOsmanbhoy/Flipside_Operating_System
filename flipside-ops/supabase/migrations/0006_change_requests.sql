do $$ begin
  create type public.change_request_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  section_type_id uuid references public.client_section_types(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  summary text not null,
  proposed_data jsonb,
  status public.change_request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index cr_client_idx on public.change_requests(client_id);
create index cr_status_idx on public.change_requests(status);
create index cr_requester_idx on public.change_requests(requested_by);
create trigger trg_cr_audit
  before insert or update on public.change_requests
  for each row execute function public.set_audit_columns();

alter table public.change_requests enable row level security;

-- Editor: insert their own + read their own
create policy "cr_insert_own" on public.change_requests
  for insert to authenticated
  with check (requested_by = auth.uid());

create policy "cr_read" on public.change_requests
  for select to authenticated
  using (
    requested_by = auth.uid()
    or public.is_manager_or_admin()
  );

-- Manager/admin: update (approve/reject)
create policy "cr_review" on public.change_requests
  for update to authenticated
  using (public.is_manager_or_admin())
  with check (public.is_manager_or_admin());

create policy "cr_delete" on public.change_requests
  for delete to authenticated using (public.is_admin());
