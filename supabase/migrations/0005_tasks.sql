-- 0005: sprints, tasks, comments, attachments, activity.

create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned' check (status in ('planned','active','completed')),
  goal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  check (end_date >= start_date)
);
-- Only one active sprint at a time
create unique index if not exists uq_sprints_one_active on public.sprints((status)) where status = 'active' and deleted_at is null;
create index if not exists idx_sprints_created_by on public.sprints(created_by);
select public.attach_std_triggers('sprints');

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,                       -- sanitized HTML
  assignee_id uuid references public.profiles(id) on delete set null,
  reporter_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'todo' check (status in ('todo','in_progress','in_review','done','paused','rejected')),
  due_date date,
  sprint_id uuid references public.sprints(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  tags text[] not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_tasks_reporter on public.tasks(reporter_id);
create index if not exists idx_tasks_sprint on public.tasks(sprint_id);
create index if not exists idx_tasks_student on public.tasks(student_id);
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due on public.tasks(due_date);
create index if not exists idx_tasks_completed_at on public.tasks(completed_at);
create index if not exists idx_tasks_title_trgm on public.tasks using gin (title gin_trgm_ops);
select public.attach_std_triggers('tasks');

create or replace function public.task_completed_stamp()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  if new.reporter_id is null then new.reporter_id := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists trg_tasks_completed on public.tasks;
create trigger trg_tasks_completed before insert or update on public.tasks
  for each row execute function public.task_completed_stamp();

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_task_comments_task on public.task_comments(task_id);
create index if not exists idx_task_comments_author on public.task_comments(author_id);
select public.attach_std_triggers('task_comments');

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_task_attachments_task on public.task_attachments(task_id);
select public.attach_std_triggers('task_attachments');

create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,           -- created | status | assignee | priority | due_date | sprint | comment | attachment
  from_value text,
  to_value text,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_activity_task on public.task_activity(task_id);
create index if not exists idx_task_activity_actor on public.task_activity(actor_id);

create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor uuid := coalesce(auth.uid(), new.created_by);
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity(task_id, actor_id, action, to_value) values (new.id, actor, 'created', new.title);
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.task_activity(task_id, actor_id, action, from_value, to_value) values (new.id, actor, 'status', old.status, new.status);
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into public.task_activity(task_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'assignee',
      (select full_name from public.profiles where id = old.assignee_id),
      (select full_name from public.profiles where id = new.assignee_id));
  end if;
  if new.priority is distinct from old.priority then
    insert into public.task_activity(task_id, actor_id, action, from_value, to_value) values (new.id, actor, 'priority', old.priority, new.priority);
  end if;
  if new.due_date is distinct from old.due_date then
    insert into public.task_activity(task_id, actor_id, action, from_value, to_value) values (new.id, actor, 'due_date', old.due_date::text, new.due_date::text);
  end if;
  if new.sprint_id is distinct from old.sprint_id then
    insert into public.task_activity(task_id, actor_id, action, from_value, to_value)
    values (new.id, actor, 'sprint',
      (select name from public.sprints where id = old.sprint_id),
      (select name from public.sprints where id = new.sprint_id));
  end if;
  return new;
end $$;
drop trigger if exists trg_tasks_activity on public.tasks;
create trigger trg_tasks_activity after insert or update on public.tasks
  for each row execute function public.log_task_activity();
