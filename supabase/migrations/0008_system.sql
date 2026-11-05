-- 0008: notifications, audit log, AI logs, settings.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('task_assigned','mention','student_status','task_due','passport_expiring','installment_overdue','system')),
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  dedupe_key text,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);
create unique index if not exists uq_notifications_dedupe on public.notifications(user_id, dedupe_key) where dedupe_key is not null;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert','update','delete','soft_delete','restore')),
  actor_id uuid references public.profiles(id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_table_record on public.audit_logs(table_name, record_id);
create index if not exists idx_audit_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_created_at on public.audit_logs(created_at desc);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_ai_conversations_user on public.ai_conversations(user_id, updated_at desc);
select public.attach_std_triggers('ai_conversations');

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  meta jsonb not null default '{}',   -- { queries: [{sql, columns, rows}], kb: [...] }
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_messages_conversation on public.ai_messages(conversation_id, created_at);

create table if not exists public.ai_query_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  question text not null,
  tool text,
  sql text,
  row_count int,
  duration_ms int,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_query_logs_user on public.ai_query_logs(user_id, created_at desc);
create index if not exists idx_ai_query_logs_conversation on public.ai_query_logs(conversation_id);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated before update on public.settings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Generic audit trigger: logs old -> new for business tables
-- ---------------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_action text; v_fields text[]; v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_action := 'insert'; v_id := new.id;
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old); v_action := 'delete'; v_id := old.id;
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_id := new.id;
    select array_agg(k) into v_fields
    from jsonb_object_keys(v_new) k
    where k not in ('updated_at','search','paid_amount') and v_new->k is distinct from v_old->k;
    if v_fields is null then return null; end if;
    v_action := case
      when (v_old ? 'deleted_at') and v_old->>'deleted_at' is null and v_new->>'deleted_at' is not null then 'soft_delete'
      when (v_old ? 'deleted_at') and v_old->>'deleted_at' is not null and v_new->>'deleted_at' is null then 'restore'
      else 'update' end;
    -- only keep changed fields to keep the log compact
    select jsonb_object_agg(k, v_old->k) into v_old from unnest(v_fields) k;
    select jsonb_object_agg(k, v_new->k) into v_new from unnest(v_fields) k;
    -- keep the parent link so per-student activity can find child-row changes
    if to_jsonb(new) ? 'student_id' then
      v_new := v_new || jsonb_build_object('student_id', to_jsonb(new)->'student_id');
    end if;
  end if;
  insert into public.audit_logs(table_name, record_id, action, actor_id, old_data, new_data, changed_fields)
  values (tg_table_name, v_id, v_action, auth.uid(), v_old, v_new, v_fields);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['students','student_education','student_work_experience','student_family_members',
    'student_travel_history','student_documents','universities','offers','applications','tasks','sprints',
    'transactions','fee_plans','fee_installments','transaction_categories','profiles','roles','kb_entries','exchange_rates']
  loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$I for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text, p_key text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications(user_id, type, title, body, link, dedupe_key)
  values (p_user, p_type, p_title, p_body, p_link, p_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
end $$;

create or replace function public.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.notify(new.assignee_id, 'task_assigned', 'Task assigned to you', new.title, '/tasks?task=' || new.id, null);
  end if;
  return null;
end $$;
drop trigger if exists trg_tasks_notify on public.tasks;
create trigger trg_tasks_notify after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_assigned();

create or replace function public.notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid; t record;
begin
  select id, title into t from public.tasks where id = new.task_id;
  foreach u in array new.mentions loop
    if u is distinct from new.author_id then
      perform public.notify(u, 'mention', 'You were mentioned on a task', t.title, '/tasks?task=' || t.id, null);
    end if;
  end loop;
  insert into public.task_activity(task_id, actor_id, action, to_value) values (new.task_id, new.author_id, 'comment', left(new.body, 120));
  return null;
end $$;
drop trigger if exists trg_task_comments_notify on public.task_comments;
create trigger trg_task_comments_notify after insert on public.task_comments
  for each row execute function public.notify_mentions();

create or replace function public.notify_student_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.counselor_id is not null and new.counselor_id is distinct from auth.uid() then
    perform public.notify(new.counselor_id, 'student_status', 'Student status changed',
      new.full_name || ': ' || replace(old.status,'_',' ') || ' → ' || replace(new.status,'_',' '),
      '/students/' || new.id, null);
  end if;
  return null;
end $$;
drop trigger if exists trg_students_notify on public.students;
create trigger trg_students_notify after update of status on public.students
  for each row execute function public.notify_student_status();

-- Scheduled notifications (idempotent thanks to dedupe keys). Called by pg_cron when
-- available and opportunistically by the app on dashboard load.
create or replace function public.generate_scheduled_notifications()
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_today date := public.today_dhaka();
begin
  perform public.expire_offers();

  for r in select id, title, assignee_id from public.tasks
           where deleted_at is null and due_date = v_today + 1 and status not in ('done','rejected') and assignee_id is not null loop
    perform public.notify(r.assignee_id, 'task_due', 'Task due tomorrow', r.title, '/tasks?task=' || r.id, 'task_due:' || r.id || ':' || (v_today + 1));
  end loop;

  for r in select id, full_name, counselor_id, passport_expiry_date from public.students
           where deleted_at is null and counselor_id is not null
             and passport_expiry_date between v_today and v_today + interval '6 months' loop
    perform public.notify(r.counselor_id, 'passport_expiring', 'Passport expiring soon',
      r.full_name || ' — expires ' || to_char(r.passport_expiry_date, 'DD Mon YYYY'), '/students/' || r.id,
      'passport:' || r.id || ':' || r.passport_expiry_date);
  end loop;

  for r in select i.id, i.label, i.due_date, s.id as student_id, s.full_name, s.counselor_id
           from public.fee_installments i
           join public.fee_plans fp on fp.id = i.fee_plan_id and fp.deleted_at is null
           join public.students s on s.id = fp.student_id and s.deleted_at is null
           where i.deleted_at is null and i.due_date < v_today and i.paid_amount < i.amount loop
    -- notify counselor and every finance user
    perform public.notify(r.counselor_id, 'installment_overdue', 'Installment overdue',
      r.full_name || ' — ' || r.label, '/students/' || r.student_id || '?tab=payments', 'inst:' || r.id);
    perform public.notify(p.id, 'installment_overdue', 'Installment overdue',
      r.full_name || ' — ' || r.label, '/students/' || r.student_id || '?tab=payments', 'inst:' || r.id)
    from public.profiles p join public.roles ro on ro.id = p.role_id
    where p.is_active and ro.key = 'finance_operator';
  end loop;
end $$;

-- Try to schedule with pg_cron if the extension is available (ignored otherwise)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule(jobid) from cron.job where jobname = 'crm_scheduled_notifications';
      perform cron.schedule('crm_scheduled_notifications', '0 * * * *', 'select public.generate_scheduled_notifications()');
    exception when others then
      raise notice 'pg_cron not scheduled: %', sqlerrm;
    end;
  end if;
end $$;
