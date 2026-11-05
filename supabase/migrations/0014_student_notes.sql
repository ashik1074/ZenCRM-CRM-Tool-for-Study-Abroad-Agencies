-- 0014: timestamped notes on a student (Notes & Activity tab).
create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_student_notes_student on public.student_notes(student_id, created_at desc);
create index if not exists idx_student_notes_author on public.student_notes(author_id);
select public.attach_std_triggers('student_notes');

alter table public.student_notes enable row level security;
drop policy if exists student_notes_select on public.student_notes;
drop policy if exists student_notes_insert on public.student_notes;
drop policy if exists student_notes_update on public.student_notes;
create policy student_notes_select on public.student_notes for select to authenticated using (public.has_permission('students','view') and deleted_at is null);
create policy student_notes_insert on public.student_notes for insert to authenticated with check (public.has_permission('students','view') and author_id = auth.uid());
create policy student_notes_update on public.student_notes for update to authenticated using (author_id = auth.uid() or public.has_permission('students','delete'));

drop trigger if exists trg_student_notes_audit on public.student_notes;
create trigger trg_student_notes_audit after insert or update or delete on public.student_notes for each row execute function public.audit_trigger();

-- Activity feed for one student: status changes + audit entries on the student and its child rows.
-- Security definer so counselors without audit:view still see their student's history; requires students:view.
create or replace function public.student_activity(p_student uuid, p_limit int default 50)
returns table(at timestamptz, actor text, kind text, summary text, details jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_permission('students','view');
  return query
  select * from (
    select h.changed_at, p.full_name, 'status'::text,
      coalesce(replace(h.from_status,'_',' ') || ' → ', '') || replace(h.to_status,'_',' ') || coalesce(' — ' || h.note, ''),
      null::jsonb
    from public.student_status_history h left join public.profiles p on p.id = h.changed_by
    where h.student_id = p_student
    union all
    select a.created_at, p.full_name, a.action,
      case a.table_name
        when 'students' then 'Profile ' || a.action || coalesce(' (' || array_to_string(a.changed_fields, ', ') || ')', '')
        else replace(a.table_name, 'student_', '') || ' ' || a.action end,
      jsonb_build_object('old', a.old_data, 'new', a.new_data)
    from public.audit_logs a left join public.profiles p on p.id = a.actor_id
    where (a.table_name = 'students' and a.record_id = p_student and not (a.action = 'update' and a.changed_fields = array['status']))
       or (a.table_name in ('student_education','student_work_experience','student_family_members','student_travel_history','student_documents','applications')
           and coalesce(a.new_data->>'student_id', a.old_data->>'student_id') = p_student::text)
  ) x order by 1 desc limit p_limit;
end $$;

-- Recent activity relevant to the current user: their own changes, changes on tasks assigned to them,
-- and status changes on students they counsel. Admin-level users (audit:view) see everyone's activity.
create or replace function public.my_recent_activity(p_limit int default 10)
returns table(at timestamptz, actor text, summary text, link text)
language sql stable security definer set search_path = public as $$
  select * from (
    select a.created_at, p.full_name,
      case a.table_name
        when 'students' then initcap(a.action) || ' student ' || coalesce(s.full_name, '')
        when 'tasks' then initcap(a.action) || ' task ' || coalesce(t.title, '')
        when 'offers' then initcap(a.action) || ' offer ' || coalesce(o.title, '')
        when 'transactions' then initcap(a.action) || ' ' || coalesce(a.new_data->>'type', a.old_data->>'type', 'transaction')
        when 'applications' then initcap(a.action) || ' application'
        else initcap(a.action) || ' ' || replace(a.table_name, '_', ' ') end,
      case a.table_name
        when 'students' then '/students/' || a.record_id
        when 'tasks' then '/tasks?task=' || a.record_id
        when 'offers' then '/offers?offer=' || a.record_id || '&status=all'
        when 'transactions' then '/finance/transactions'
        else null end
    from public.audit_logs a
    left join public.profiles p on p.id = a.actor_id
    left join public.students s on a.table_name = 'students' and s.id = a.record_id
    left join public.tasks t on a.table_name = 'tasks' and t.id = a.record_id
    left join public.offers o on a.table_name = 'offers' and o.id = a.record_id
    where a.table_name in ('students','tasks','offers','transactions','applications','universities','kb_entries')
      and (a.actor_id = auth.uid() or public.has_permission('audit','view'))
      and (a.table_name <> 'transactions' or public.has_permission('finance','view'))
    union all
    select ta.created_at, p.full_name,
      case ta.action when 'status' then 'Moved "' || t.title || '" to ' || replace(ta.to_value, '_', ' ')
        when 'comment' then 'Commented on "' || t.title || '"'
        else initcap(replace(ta.action, '_', ' ')) || ' on "' || t.title || '"' end,
      '/tasks?task=' || t.id
    from public.task_activity ta join public.tasks t on t.id = ta.task_id
    left join public.profiles p on p.id = ta.actor_id
    where t.assignee_id = auth.uid() and ta.actor_id is distinct from auth.uid() and ta.action <> 'created'
    union all
    select h.changed_at, p.full_name, s.full_name || ' → ' || replace(h.to_status, '_', ' '), '/students/' || s.id
    from public.student_status_history h join public.students s on s.id = h.student_id
    left join public.profiles p on p.id = h.changed_by
    where s.counselor_id = auth.uid() and h.changed_by is distinct from auth.uid()
  ) x
  where public.is_staff()
  order by 1 desc
  limit least(p_limit, 50)
$$;
