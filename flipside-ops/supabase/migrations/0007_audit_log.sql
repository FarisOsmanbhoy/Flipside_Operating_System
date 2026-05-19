do $$ begin
  create type public.audit_action as enum ('create','update','delete');
exception when duplicate_object then null; end $$;

create table public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action public.audit_action not null,
  summary text,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index audit_log_actor_idx on public.audit_log(actor_id);

alter table public.audit_log enable row level security;
-- All authenticated can read (powers recent-activity widget).
create policy "audit_log_read" on public.audit_log
  for select to authenticated using (true);
-- Writes only via triggers (security-definer).
-- No insert/update/delete policy = blocked from client.

-- Generic audit trigger
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action public.audit_action;
  v_id uuid;
  v_summary text;
begin
  if tg_op = 'INSERT' then v_action := 'create'; v_id := new.id;
  elsif tg_op = 'UPDATE' then v_action := 'update'; v_id := new.id;
  elsif tg_op = 'DELETE' then v_action := 'delete'; v_id := old.id;
  end if;

  -- Best-effort summary: prefer .name then .title
  if tg_op in ('INSERT','UPDATE') then
    v_summary := coalesce(
      to_jsonb(new) ->> 'name',
      to_jsonb(new) ->> 'title',
      tg_table_name
    );
  else
    v_summary := coalesce(
      to_jsonb(old) ->> 'name',
      to_jsonb(old) ->> 'title',
      tg_table_name
    );
  end if;

  insert into public.audit_log (actor_id, entity_type, entity_id, action, summary, diff)
  values (
    auth.uid(),
    tg_table_name,
    v_id,
    v_action,
    v_summary,
    case
      when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      when tg_op = 'INSERT' then jsonb_build_object('after', to_jsonb(new))
      when tg_op = 'DELETE' then jsonb_build_object('before', to_jsonb(old))
    end
  );
  return coalesce(new, old);
end;
$$;

-- Attach to the tables we care about
create trigger trg_audit_clients
  after insert or update or delete on public.clients
  for each row execute function public.log_audit();
create trigger trg_audit_csd
  after insert or update or delete on public.client_section_data
  for each row execute function public.log_audit();
create trigger trg_audit_contacts
  after insert or update or delete on public.client_contacts
  for each row execute function public.log_audit();
create trigger trg_audit_subs
  after insert or update or delete on public.client_subcontractors
  for each row execute function public.log_audit();
create trigger trg_audit_tasks
  after insert or update or delete on public.tasks
  for each row execute function public.log_audit();
create trigger trg_audit_change_requests
  after insert or update on public.change_requests
  for each row execute function public.log_audit();
