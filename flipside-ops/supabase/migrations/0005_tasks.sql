do $$ begin
  create type public.task_type as enum ('task','notice','industry_alert','recurring_template');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('open','in_progress','done','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recurrence as enum ('none','daily','weekly','monthly','yearly');
exception when duplicate_object then null; end $$;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  type public.task_type not null default 'task',
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_department uuid references public.departments(id) on delete set null,
  due_date timestamptz,
  status public.task_status not null default 'open',
  priority_id uuid references public.task_priorities(id) on delete set null,
  category_id uuid references public.task_categories(id) on delete set null,
  alert_category_id uuid references public.industry_alert_categories(id) on delete set null,
  notice_category_id uuid references public.notice_categories(id) on delete set null,
  linked_client_id uuid references public.clients(id) on delete set null,
  needs_prep boolean not null default false,
  private boolean not null default false,
  recurrence public.recurrence not null default 'none',
  recurrence_source_id uuid references public.tasks(id) on delete set null,
  completed_at timestamptz,
  dismissed_by uuid[] not null default '{}', -- profile ids who dismissed (for notices)
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index tasks_type_idx on public.tasks(type);
create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_assigned_dept_idx on public.tasks(assigned_department);
create index tasks_due_date_idx on public.tasks(due_date);
create index tasks_status_idx on public.tasks(status);
create index tasks_linked_client_idx on public.tasks(linked_client_id);
create index tasks_fts on public.tasks using gin (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
);
create trigger trg_tasks_audit
  before insert or update on public.tasks
  for each row execute function public.set_audit_columns();

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments(task_id);

-- ────────────────────────────────────────────────────────────────────
-- RLS
-- All roles can read (respecting private flag) and create.
-- Edit/delete: author OR admin (managers can edit team members' tasks too).
-- ────────────────────────────────────────────────────────────────────
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;

create policy "tasks_read" on public.tasks
  for select to authenticated using (
    not private
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or public.is_admin()
    or (public.is_manager_or_admin() and assigned_to in (
      select id from public.profiles where department_id = (
        select department_id from public.profiles where id = auth.uid()
      )
    ))
  );
create policy "tasks_insert" on public.tasks
  for insert to authenticated with check (auth.uid() is not null);
create policy "tasks_update" on public.tasks
  for update to authenticated using (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_manager_or_admin()
  );
create policy "tasks_delete" on public.tasks
  for delete to authenticated using (
    created_by = auth.uid() or public.is_admin()
  );

create policy "task_comments_read" on public.task_comments
  for select to authenticated using (
    exists (select 1 from public.tasks t where t.id = task_id and (
      not t.private or t.assigned_to = auth.uid() or t.created_by = auth.uid()
      or public.is_admin()
    ))
  );
create policy "task_comments_insert" on public.task_comments
  for insert to authenticated with check (author_id = auth.uid());
create policy "task_comments_delete" on public.task_comments
  for delete to authenticated using (
    author_id = auth.uid() or public.is_admin()
  );
