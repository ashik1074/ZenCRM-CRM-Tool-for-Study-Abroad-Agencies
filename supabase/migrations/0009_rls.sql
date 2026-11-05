-- 0009: Row Level Security. Every table has RLS enabled; policies are driven by has_permission().
-- Soft-deleted rows are only visible to users with trash:view (Admin / System Admin) so they can restore.

do $$
declare t text;
begin
  foreach t in array array['roles','permissions','role_permissions','profiles','students','student_education',
    'student_work_experience','student_family_members','student_travel_history','student_status_history',
    'student_documents','universities','offers','offer_attachments','applications','sprints','tasks',
    'task_comments','task_attachments','task_activity','kb_entries','kb_attachments','transaction_categories',
    'transactions','fee_plans','fee_installments','exchange_rates','notifications','audit_logs',
    'ai_conversations','ai_messages','ai_query_logs','settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    -- drop all existing policies so this file is re-runnable
    perform 1;
  end loop;
end $$;

do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- helper: visible unless soft-deleted (or user may see trash)
create or replace function public.not_deleted_or_trash(p_deleted_at timestamptz)
returns boolean language sql stable as $$
  select p_deleted_at is null or public.has_permission('trash','view')
$$;

-- ---------- roles / permissions / profiles ----------
create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_write on public.roles for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

create policy permissions_select on public.permissions for select to authenticated using (true);
create policy permissions_write on public.permissions for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_write on public.role_permissions for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

-- staff can see staff directory (for assignee pickers); students only themselves
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());
-- users may update their own name/phone/avatar (role & active flag are protected by trigger below)
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_system_admin() then
    new.role_id := old.role_id;
    new.is_active := old.is_active;
    new.email := old.email;
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------- students ----------
create policy students_select on public.students for select to authenticated using (
  (public.has_permission('students','view') and public.not_deleted_or_trash(deleted_at))
  or (user_id = auth.uid() and deleted_at is null)
);
create policy students_insert on public.students for insert to authenticated with check (public.has_permission('students','create'));
create policy students_update on public.students for update to authenticated
  using (public.has_permission('students','edit') or public.has_permission('students','delete') or public.has_permission('trash','edit'))
  with check (public.has_permission('students','edit') or public.has_permission('students','delete') or public.has_permission('trash','edit'));
create policy students_delete on public.students for delete to authenticated using (public.has_permission('trash','edit'));

-- child tables of students share one pattern
do $$
declare t text;
begin
  foreach t in array array['student_education','student_work_experience','student_family_members','student_travel_history']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated using (
        (public.has_permission('students','view') and deleted_at is null) or student_id = public.my_student_id());
      create policy %1$s_insert on public.%1$I for insert to authenticated with check (
        public.has_permission('students','create') or public.has_permission('students','edit'));
      create policy %1$s_update on public.%1$I for update to authenticated using (public.has_permission('students','edit'))
        with check (public.has_permission('students','edit'));
      create policy %1$s_delete on public.%1$I for delete to authenticated using (
        public.has_permission('students','edit') or public.has_permission('students','create'));
    $f$, t);
  end loop;
end $$;

create policy student_status_history_select on public.student_status_history for select to authenticated using (
  public.has_permission('students','view') or student_id = public.my_student_id());
-- rows written by trigger only (security definer)

create policy student_documents_select on public.student_documents for select to authenticated using (
  (public.has_permission('students','view') and deleted_at is null) or (student_id = public.my_student_id() and deleted_at is null));
create policy student_documents_insert on public.student_documents for insert to authenticated with check (
  public.has_permission('students','edit') or public.has_permission('students','create') or student_id = public.my_student_id());
create policy student_documents_update on public.student_documents for update to authenticated
  using (public.has_permission('students','edit')) with check (public.has_permission('students','edit'));
create policy student_documents_delete on public.student_documents for delete to authenticated using (public.has_permission('students','edit'));

-- ---------- universities / offers / applications ----------
create policy universities_select on public.universities for select to authenticated using (
  (public.is_staff() and public.not_deleted_or_trash(deleted_at)) or
  id in (select university_id from public.applications where student_id = public.my_student_id()));
create policy universities_insert on public.universities for insert to authenticated with check (public.has_permission('universities','create'));
create policy universities_update on public.universities for update to authenticated
  using (public.has_permission('universities','edit') or public.has_permission('universities','delete'))
  with check (public.has_permission('universities','edit') or public.has_permission('universities','delete'));

create policy offers_select on public.offers for select to authenticated using (
  (public.has_permission('offers','view') and public.not_deleted_or_trash(deleted_at)) or
  id in (select offer_id from public.applications where student_id = public.my_student_id()));
create policy offers_insert on public.offers for insert to authenticated with check (public.has_permission('offers','create'));
create policy offers_update on public.offers for update to authenticated
  using (public.has_permission('offers','edit') or public.has_permission('offers','delete') or public.has_permission('trash','edit'))
  with check (public.has_permission('offers','edit') or public.has_permission('offers','delete') or public.has_permission('trash','edit'));

create policy offer_attachments_select on public.offer_attachments for select to authenticated using (
  public.has_permission('offers','view') and deleted_at is null);
create policy offer_attachments_insert on public.offer_attachments for insert to authenticated with check (
  public.has_permission('offers','create') or public.has_permission('offers','edit'));
create policy offer_attachments_delete on public.offer_attachments for delete to authenticated using (public.has_permission('offers','edit'));
create policy offer_attachments_update on public.offer_attachments for update to authenticated using (public.has_permission('offers','edit'));

create policy applications_select on public.applications for select to authenticated using (
  (public.has_permission('applications','view') and deleted_at is null) or (student_id = public.my_student_id() and deleted_at is null));
create policy applications_insert on public.applications for insert to authenticated with check (public.has_permission('applications','create'));
create policy applications_update on public.applications for update to authenticated
  using (public.has_permission('applications','edit')) with check (public.has_permission('applications','edit'));
create policy applications_delete on public.applications for delete to authenticated using (public.has_permission('applications','delete'));

-- ---------- sprints / tasks ----------
create policy sprints_select on public.sprints for select to authenticated using (public.has_permission('tasks','view') and deleted_at is null);
create policy sprints_write on public.sprints for all to authenticated
  using (public.has_permission('sprints','edit') or public.has_permission('sprints','create'))
  with check (public.has_permission('sprints','edit') or public.has_permission('sprints','create'));

-- task visibility: tasks_all:view sees all; otherwise only tasks I'm assigned to or reported
create or replace function public.can_see_task(p_assignee uuid, p_reporter uuid, p_created_by uuid)
returns boolean language sql stable as $$
  select public.has_permission('tasks_all','view')
      or (public.has_permission('tasks','view') and auth.uid() in (p_assignee, p_reporter, p_created_by))
$$;

create policy tasks_select on public.tasks for select to authenticated using (
  public.can_see_task(assignee_id, reporter_id, created_by) and public.not_deleted_or_trash(deleted_at));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.has_permission('tasks','create'));
create policy tasks_update on public.tasks for update to authenticated
  using (public.has_permission('trash','edit') or (public.has_permission('tasks','edit') and
         (public.has_permission('tasks_all','edit') or auth.uid() in (assignee_id, reporter_id, created_by))))
  with check (public.has_permission('tasks','edit') or public.has_permission('trash','edit'));

create or replace function public.can_see_task_id(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks t where t.id = p_task and public.can_see_task(t.assignee_id, t.reporter_id, t.created_by))
$$;

create policy task_comments_select on public.task_comments for select to authenticated using (public.can_see_task_id(task_id) and deleted_at is null);
create policy task_comments_insert on public.task_comments for insert to authenticated with check (public.can_see_task_id(task_id) and author_id = auth.uid());
create policy task_comments_update on public.task_comments for update to authenticated using (author_id = auth.uid());

create policy task_attachments_select on public.task_attachments for select to authenticated using (public.can_see_task_id(task_id) and deleted_at is null);
create policy task_attachments_insert on public.task_attachments for insert to authenticated with check (public.can_see_task_id(task_id) and public.has_permission('tasks','edit'));
create policy task_attachments_delete on public.task_attachments for delete to authenticated using (public.can_see_task_id(task_id) and public.has_permission('tasks','edit'));

create policy task_activity_select on public.task_activity for select to authenticated using (public.can_see_task_id(task_id));

-- ---------- knowledge base ----------
create policy kb_select on public.kb_entries for select to authenticated using (
  (public.has_permission('kb','view') or public.has_permission('portal','view')) and deleted_at is null);
create policy kb_insert on public.kb_entries for insert to authenticated with check (public.has_permission('kb','create'));
create policy kb_update on public.kb_entries for update to authenticated
  using (public.has_permission('kb','edit') or public.has_permission('kb','delete'))
  with check (public.has_permission('kb','edit') or public.has_permission('kb','delete'));

create policy kb_attachments_select on public.kb_attachments for select to authenticated using (public.has_permission('kb','view') and deleted_at is null);
create policy kb_attachments_write on public.kb_attachments for all to authenticated
  using (public.has_permission('kb','edit')) with check (public.has_permission('kb','edit') or public.has_permission('kb','create'));

-- ---------- finance ----------
create policy exchange_rates_select on public.exchange_rates for select to authenticated using (public.is_staff());
create policy exchange_rates_write on public.exchange_rates for all to authenticated
  using (public.has_permission('settings','edit')) with check (public.has_permission('settings','edit'));

create policy txn_categories_select on public.transaction_categories for select to authenticated using (public.has_permission('finance','view'));
create policy txn_categories_write on public.transaction_categories for all to authenticated
  using (public.has_permission('finance_categories','edit')) with check (public.has_permission('finance_categories','edit'));

create policy transactions_select on public.transactions for select to authenticated using (
  (public.has_permission('finance','view') and public.not_deleted_or_trash(deleted_at))
  or (student_id = public.my_student_id() and type = 'income' and deleted_at is null));
create policy transactions_insert on public.transactions for insert to authenticated with check (public.has_permission('finance','create'));
create policy transactions_update on public.transactions for update to authenticated
  using (public.has_permission('finance','edit') or public.has_permission('finance','delete') or public.has_permission('trash','edit'))
  with check (public.has_permission('finance','edit') or public.has_permission('finance','delete') or public.has_permission('trash','edit'));

create policy fee_plans_select on public.fee_plans for select to authenticated using (
  (public.has_permission('finance','view') and deleted_at is null) or (student_id = public.my_student_id() and deleted_at is null));
create policy fee_plans_write on public.fee_plans for all to authenticated
  using (public.has_permission('finance','edit')) with check (public.has_permission('finance','edit') or public.has_permission('finance','create'));

create policy fee_installments_select on public.fee_installments for select to authenticated using (
  deleted_at is null and (public.has_permission('finance','view') or
  fee_plan_id in (select id from public.fee_plans where student_id = public.my_student_id())));
create policy fee_installments_write on public.fee_installments for all to authenticated
  using (public.has_permission('finance','edit')) with check (public.has_permission('finance','edit') or public.has_permission('finance','create'));

-- ---------- system ----------
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

create policy audit_select on public.audit_logs for select to authenticated using (public.has_permission('audit','view'));

create policy ai_conversations_own on public.ai_conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_messages_own on public.ai_messages for all to authenticated
  using (conversation_id in (select id from public.ai_conversations where user_id = auth.uid()))
  with check (conversation_id in (select id from public.ai_conversations where user_id = auth.uid()));
create policy ai_query_logs_select on public.ai_query_logs for select to authenticated using (public.has_permission('audit','view') or user_id = auth.uid());
create policy ai_query_logs_insert on public.ai_query_logs for insert to authenticated with check (user_id = auth.uid());

create policy settings_select on public.settings for select to authenticated using (true);
create policy settings_write on public.settings for all to authenticated
  using (public.has_permission('settings','edit')) with check (public.has_permission('settings','edit'));

-- Anonymous users get nothing at all
revoke all on all tables in schema public from anon;
