-- 0012: report & dashboard functions. SECURITY INVOKER: they run with the caller's RLS,
-- and additionally check the module permission explicitly.

create or replace function public.require_permission(p_module text, p_action text)
returns void language plpgsql stable as $$
begin
  if not public.has_permission(p_module, p_action) then
    raise exception 'Permission denied: %:%', p_module, p_action using errcode = '42501';
  end if;
end $$;

create or replace function public.dhaka_date(ts timestamptz)
returns date language sql immutable as $$ select (ts at time zone 'Asia/Dhaka')::date $$;

-- ordered pipeline stages for funnel/conversion maths
create or replace function public.stage_rank(p_status text)
returns int language sql immutable as $$
  select case p_status
    when 'inquiry' then 1 when 'registered' then 2 when 'documents_collecting' then 3 when 'applied' then 4
    when 'offer_received' then 5 when 'jw202_received' then 6 when 'visa_applied' then 7
    when 'visa_approved' then 8 when 'departed' then 9 when 'enrolled' then 10 else 0 end
$$;

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb language plpgsql stable as $$
declare
  me uuid := auth.uid();
  v_today date := public.today_dhaka();
  v_month_start date := date_trunc('month', v_today)::date;
  v_week_start date := date_trunc('week', v_today)::date;
  result jsonb;
  admin_part jsonb := null;
  finance_part jsonb := null;
begin
  perform public.require_permission('dashboard','view');

  select jsonb_build_object(
    'pending', count(*) filter (where status = 'todo'),
    'in_progress', count(*) filter (where status in ('in_progress','in_review')),
    'due_today', count(*) filter (where due_date = v_today and status not in ('done','rejected')),
    'overdue', count(*) filter (where due_date < v_today and status not in ('done','rejected','paused')),
    'completed_week', count(*) filter (where status = 'done' and public.dhaka_date(completed_at) >= v_week_start)
  ) into result
  from public.tasks where assignee_id = me and deleted_at is null;

  if public.has_permission('reports','view') then
    select jsonb_build_object(
      'students_this_month', (select count(*) from public.students where deleted_at is null and not is_draft and public.dhaka_date(created_at) >= v_month_start),
      'offers_this_month', (select count(*) from public.applications where deleted_at is null and status = 'accepted' and decision_at >= v_month_start),
      'visa_approved', (select count(*) from public.student_status_history where to_status = 'visa_approved'),
      'visa_rejected', (select count(*) from public.student_status_history where to_status = 'visa_rejected')
    ) into admin_part;
    result := result || jsonb_build_object('admin', admin_part);
  end if;

  if public.has_permission('finance','view') then
    select jsonb_build_object(
      'income', coalesce(sum(amount_bdt) filter (where type = 'income'), 0),
      'expense', coalesce(sum(amount_bdt) filter (where type = 'expense'), 0)
    ) into finance_part
    from public.transactions where deleted_at is null and txn_date >= v_month_start and txn_date <= v_today;
    result := result || jsonb_build_object('finance', finance_part);
  end if;

  return result;
end $$;

create or replace function public.upcoming_deadlines(p_limit int default 10)
returns table(kind text, ref_id uuid, title text, due date, link text) language sql stable as $$
  (select 'task'::text, t.id, t.title, t.due_date, '/tasks?task=' || t.id
   from public.tasks t
   where t.deleted_at is null and t.assignee_id = auth.uid() and t.due_date >= public.today_dhaka()
     and t.status not in ('done','rejected'))
  union all
  (select 'offer_deadline', o.id, o.title || ' (' || u.name || ')', o.application_deadline, '/offers?offer=' || o.id
   from public.offers o join public.universities u on u.id = o.university_id
   where o.deleted_at is null and o.status = 'open' and o.application_deadline between public.today_dhaka() and public.today_dhaka() + 60)
  union all
  (select 'passport_expiry', s.id, s.full_name || ' — passport', s.passport_expiry_date, '/students/' || s.id
   from public.students s
   where s.deleted_at is null and s.passport_expiry_date between public.today_dhaka() and (public.today_dhaka() + interval '6 months')::date
     and s.status not in ('dropped','enrolled'))
  order by 4 asc
  limit p_limit
$$;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create or replace function public.report_university(p_from date, p_to date)
returns table(university_id uuid, university text, city text, applications bigint, accepted bigint, rejected bigint, enrolled bigint)
language plpgsql stable as $$
begin
  perform public.require_permission('reports','view');
  return query
  select u.id, u.name, u.city,
    count(a.id) as applications,
    count(a.id) filter (where a.status = 'accepted'),
    count(a.id) filter (where a.status = 'rejected'),
    count(distinct a.student_id) filter (where a.status = 'accepted' and s.status = 'enrolled')
  from public.universities u
  left join public.applications a on a.university_id = u.id and a.deleted_at is null and a.applied_at between p_from and p_to
  left join public.students s on s.id = a.student_id and s.deleted_at is null
  where u.deleted_at is null
  group by u.id, u.name, u.city
  order by 4 desc, 2;
end $$;

create or replace function public.report_enrollment_trend(p_from date, p_to date, p_grain text default 'month')
returns table(period text, registered bigint, enrolled bigint) language plpgsql stable as $$
declare fmt text := case when p_grain = 'year' then 'YYYY' else 'YYYY-MM' end;
        g text := case when p_grain = 'year' then 'year' else 'month' end;
begin
  perform public.require_permission('reports','view');
  return query
  with periods as (
    select to_char(d, fmt) as p from generate_series(date_trunc(g, p_from::timestamp), p_to::timestamp, ('1 ' || g)::interval) d
  ), reg as (
    select to_char(public.dhaka_date(created_at), fmt) p, count(*) c from public.students
    where deleted_at is null and not is_draft and public.dhaka_date(created_at) between p_from and p_to group by 1
  ), enr as (
    select to_char(public.dhaka_date(changed_at), fmt) p, count(distinct student_id) c from public.student_status_history
    where to_status = 'enrolled' and public.dhaka_date(changed_at) between p_from and p_to group by 1
  )
  select periods.p, coalesce(reg.c, 0), coalesce(enr.c, 0)
  from periods left join reg on reg.p = periods.p left join enr on enr.p = periods.p
  order by 1;
end $$;

create or replace function public.report_funnel(p_from date, p_to date)
returns table(stage text, stage_order int, students bigint) language plpgsql stable as $$
begin
  perform public.require_permission('reports','view');
  return query
  with cohort as (
    select s.id from public.students s
    where s.deleted_at is null and not s.is_draft and public.dhaka_date(s.created_at) between p_from and p_to
  ), reached as (
    select c.id, max(public.stage_rank(h.to_status)) as r
    from cohort c join public.student_status_history h on h.student_id = c.id group by c.id
  ), stages as (
    select * from (values ('inquiry',1),('registered',2),('documents_collecting',3),('applied',4),('offer_received',5),
      ('jw202_received',6),('visa_applied',7),('visa_approved',8),('departed',9),('enrolled',10)) v(stage, ord)
  )
  select st.stage, st.ord, count(r.id) filter (where r.r >= st.ord)
  from stages st cross join reached r
  group by st.stage, st.ord
  union all
  select st.stage, st.ord, 0 from stages st where not exists (select 1 from reached)
  order by 2;
end $$;

create or replace function public.report_visa(p_from date, p_to date)
returns jsonb language plpgsql stable as $$
declare res jsonb;
begin
  perform public.require_permission('reports','view');
  with outcomes as (
    select distinct on (h.student_id) h.student_id, h.to_status
    from public.student_status_history h
    join public.students s on s.id = h.student_id and s.deleted_at is null
    where h.to_status in ('visa_approved','visa_rejected') and public.dhaka_date(h.changed_at) between p_from and p_to
    order by h.student_id, h.changed_at desc
  ), acc as (
    select distinct on (a.student_id) a.student_id, u.name as university, o.program
    from public.applications a join public.universities u on u.id = a.university_id join public.offers o on o.id = a.offer_id
    where a.status = 'accepted' and a.deleted_at is null
    order by a.student_id, a.decision_at desc nulls last
  )
  select jsonb_build_object(
    'approved', (select count(*) from outcomes where to_status = 'visa_approved'),
    'rejected', (select count(*) from outcomes where to_status = 'visa_rejected'),
    'by_university', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(acc.university, 'Unknown') as name,
          count(*) filter (where o.to_status = 'visa_approved') as approved,
          count(*) filter (where o.to_status = 'visa_rejected') as rejected,
          count(*) as total,
          round(100.0 * count(*) filter (where o.to_status = 'visa_approved') / nullif(count(*),0), 1) as success_rate
        from outcomes o left join acc on acc.student_id = o.student_id group by 1) x), '[]'),
    'by_program', coalesce((select jsonb_agg(x order by x.total desc) from (
        select coalesce(acc.program, 'Unknown') as name,
          count(*) filter (where o.to_status = 'visa_approved') as approved,
          count(*) filter (where o.to_status = 'visa_rejected') as rejected,
          count(*) as total,
          round(100.0 * count(*) filter (where o.to_status = 'visa_approved') / nullif(count(*),0), 1) as success_rate
        from outcomes o left join acc on acc.student_id = o.student_id group by 1) x), '[]')
  ) into res;
  return res;
end $$;

create or replace function public.report_counselors(p_from date, p_to date)
returns table(counselor_id uuid, counselor text, students_handled bigint, conversions bigint, tasks_completed bigint)
language plpgsql stable as $$
begin
  perform public.require_permission('reports','view');
  return query
  select p.id, p.full_name,
    (select count(*) from public.students s where s.counselor_id = p.id and s.deleted_at is null and not s.is_draft
       and public.dhaka_date(s.created_at) between p_from and p_to),
    (select count(*) from public.students s where s.counselor_id = p.id and s.deleted_at is null
       and public.dhaka_date(s.created_at) between p_from and p_to and s.status in ('visa_approved','departed','enrolled')),
    (select count(*) from public.tasks t where t.assignee_id = p.id and t.deleted_at is null and t.status = 'done'
       and public.dhaka_date(t.completed_at) between p_from and p_to)
  from public.profiles p join public.roles r on r.id = p.role_id
  where r.portal = 'staff' and p.deleted_at is null
  order by 3 desc, 2;
end $$;

create or replace function public.report_lead_sources(p_from date, p_to date)
returns table(lead_source text, students bigint, conversions bigint, conversion_rate numeric)
language plpgsql stable as $$
begin
  perform public.require_permission('reports','view');
  return query
  select coalesce(s.lead_source, 'Unknown'), count(*),
    count(*) filter (where s.status in ('visa_approved','departed','enrolled')),
    round(100.0 * count(*) filter (where s.status in ('visa_approved','departed','enrolled')) / nullif(count(*),0), 1)
  from public.students s
  where s.deleted_at is null and not s.is_draft and public.dhaka_date(s.created_at) between p_from and p_to
  group by 1 order by 2 desc;
end $$;

create or replace function public.report_offers(p_from date, p_to date)
returns jsonb language plpgsql stable as $$
declare res jsonb;
begin
  perform public.require_permission('reports','view');
  with o as (
    select o.*, u.name as university from public.offers o join public.universities u on u.id = o.university_id
    where o.deleted_at is null and public.dhaka_date(o.created_at) between p_from and p_to
  )
  select jsonb_build_object(
    'by_university', coalesce((select jsonb_agg(x order by x.count desc) from (select university as name, count(*) from o group by 1) x), '[]'),
    'by_scholarship', coalesce((select jsonb_agg(x order by x.count desc) from (select coalesce(scholarship_type,'None') as name, count(*) from o group by 1) x), '[]'),
    'by_intake', coalesce((select jsonb_agg(x order by x.name) from (select coalesce(intake,'Unspecified') as name, count(*) from o group by 1) x), '[]'),
    'by_status', coalesce((select jsonb_agg(x) from (select status as name, count(*) from o group by 1) x), '[]')
  ) into res;
  return res;
end $$;

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
create or replace function public.report_finance(p_from date, p_to date)
returns jsonb language plpgsql stable as $$
declare
  res jsonb;
  v_today date := public.today_dhaka();
  v_month date := date_trunc('month', v_today)::date;
  v_year date := date_trunc('year', v_today)::date;
begin
  perform public.require_permission('finance','view');
  with t as (select * from public.transactions where deleted_at is null)
  select jsonb_build_object(
    'period', (select jsonb_build_object(
        'income', coalesce(sum(amount_bdt) filter (where type='income'),0),
        'expense', coalesce(sum(amount_bdt) filter (where type='expense'),0))
      from t where txn_date between p_from and p_to),
    'month', (select jsonb_build_object(
        'income', coalesce(sum(amount_bdt) filter (where type='income'),0),
        'expense', coalesce(sum(amount_bdt) filter (where type='expense'),0))
      from t where txn_date between v_month and v_today),
    'ytd', (select jsonb_build_object(
        'income', coalesce(sum(amount_bdt) filter (where type='income'),0),
        'expense', coalesce(sum(amount_bdt) filter (where type='expense'),0))
      from t where txn_date between v_year and v_today),
    'outstanding_dues', (select coalesce(sum(greatest(i.amount - i.paid_amount, 0) * public.rate_to_bdt(fp.currency)), 0)
      from public.fee_installments i join public.fee_plans fp on fp.id = i.fee_plan_id and fp.deleted_at is null
      join public.students s on s.id = fp.student_id and s.deleted_at is null
      where i.deleted_at is null),
    'monthly', coalesce((select jsonb_agg(x order by x.month) from (
        select to_char(m, 'YYYY-MM') as month,
          coalesce((select sum(amount_bdt) from t where type='income' and date_trunc('month', txn_date) = m),0) as income,
          coalesce((select sum(amount_bdt) from t where type='expense' and date_trunc('month', txn_date) = m),0) as expense
        from generate_series(date_trunc('month', p_from::timestamp), p_to::timestamp, '1 month') m) x), '[]'),
    'yearly', coalesce((select jsonb_agg(x order by x.year) from (
        select extract(year from txn_date)::int as year,
          sum(amount_bdt) filter (where type='income') as income,
          sum(amount_bdt) filter (where type='expense') as expense
        from t group by 1) x), '[]'),
    'expense_by_category', coalesce((select jsonb_agg(x order by x.amount desc) from (
        select c.name, sum(t.amount_bdt) as amount from t join public.transaction_categories c on c.id = t.category_id
        where t.type='expense' and t.txn_date between p_from and p_to group by 1) x), '[]'),
    'income_by_category', coalesce((select jsonb_agg(x order by x.amount desc) from (
        select c.name, sum(t.amount_bdt) as amount from t join public.transaction_categories c on c.id = t.category_id
        where t.type='income' and t.txn_date between p_from and p_to group by 1) x), '[]'),
    'top_students', coalesce((select jsonb_agg(x order by x.amount desc) from (
        select s.id, s.full_name as name, sum(t.amount_bdt) as amount from t join public.students s on s.id = t.student_id
        where t.type='income' and t.txn_date between p_from and p_to group by 1,2 order by 3 desc limit 10) x), '[]')
  ) into res;
  return res;
end $$;

-- Student-side checklist helper (works for staff and the student themselves through RLS)
create or replace function public.student_checklist(p_student uuid)
returns table(category text, status text, document_count bigint, expiry_date date)
language sql stable as $$
  with req as (
    select jsonb_array_elements_text(coalesce(
      (select value from public.settings where key = 'required_documents'),
      '["Passport","Photo","Transcript","Certificate","Bank Statement","Solvency","Admission Letter","JW202"]'::jsonb)) as category
  ), docs as (
    select d.category, count(*) as n, max(d.expiry_date) as expiry
    from public.student_documents d where d.student_id = p_student and d.deleted_at is null group by 1
  ), stu as (
    select passport_expiry_date from public.students where id = p_student
  )
  select r.category,
    case
      when d.n is null then 'missing'
      when r.category = 'Passport' and (select passport_expiry_date from stu) < public.today_dhaka() then 'expired'
      when d.expiry is not null and d.expiry < public.today_dhaka() then 'expired'
      else 'received' end,
    coalesce(d.n, 0),
    case when r.category = 'Passport' then coalesce(d.expiry, (select passport_expiry_date from stu)) else d.expiry end
  from req r left join docs d on d.category = r.category
$$;

-- Duplicate detection for enrollment
create or replace function public.find_student_duplicates(p_phone text, p_email text, p_passport text, p_exclude uuid default null)
returns table(id uuid, full_name text, phone text, email text, passport_no text, match text)
language plpgsql stable as $$
begin
  perform public.require_permission('students','view');
  return query
  select s.id, s.full_name, s.phone, s.email, s.passport_no,
    concat_ws(', ',
      case when nullif(p_phone,'') is not null and regexp_replace(s.phone,'\D','','g') = regexp_replace(p_phone,'\D','','g') then 'phone' end,
      case when nullif(p_email,'') is not null and lower(s.email) = lower(p_email) then 'email' end,
      case when nullif(p_passport,'') is not null and upper(s.passport_no) = upper(p_passport) then 'passport' end)
  from public.students s
  where s.deleted_at is null and (p_exclude is null or s.id <> p_exclude)
    and ((nullif(p_phone,'') is not null and regexp_replace(s.phone,'\D','','g') = regexp_replace(p_phone,'\D','','g'))
      or (nullif(p_email,'') is not null and lower(s.email) = lower(p_email))
      or (nullif(p_passport,'') is not null and upper(s.passport_no) = upper(p_passport)))
  limit 5;
end $$;

-- Global search
create or replace function public.global_search(p_q text)
returns table(kind text, id uuid, title text, subtitle text, link text) language plpgsql stable as $$
declare q text := '%' || p_q || '%';
begin
  if length(trim(coalesce(p_q,''))) < 2 then return; end if;
  if public.has_permission('students','view') then
    return query select 'student'::text, s.id, s.full_name, concat_ws(' · ', s.student_code, s.phone, s.passport_no), '/students/' || s.id
      from public.students s where s.deleted_at is null and (s.full_name ilike q or s.phone ilike q or s.email ilike q or s.passport_no ilike q or s.student_code ilike q)
      order by similarity(s.full_name, p_q) desc limit 6;
  end if;
  if public.has_permission('offers','view') then
    return query select 'offer'::text, o.id, o.title, concat_ws(' · ', u.name, o.program, o.intake), '/offers?offer=' || o.id
      from public.offers o join public.universities u on u.id = o.university_id
      where o.deleted_at is null and (o.title ilike q or o.program ilike q or u.name ilike q) limit 6;
  end if;
  if public.is_staff() then
    return query select 'university'::text, u.id, u.name, concat_ws(', ', u.city, u.province), '/universities?university=' || u.id
      from public.universities u where u.deleted_at is null and (u.name ilike q or u.city ilike q) limit 5;
  end if;
  if public.has_permission('tasks','view') then
    return query select 'task'::text, t.id, t.title, t.status, '/tasks?task=' || t.id
      from public.tasks t where t.deleted_at is null and t.title ilike q
        and public.can_see_task(t.assignee_id, t.reporter_id, t.created_by) limit 6;
  end if;
  if public.has_permission('kb','view') then
    return query select 'kb'::text, k.id, k.title, k.category, '/kb?entry=' || k.id
      from public.kb_entries k where k.deleted_at is null
        and (k.search @@ plainto_tsquery('simple', p_q) or k.title ilike q) limit 5;
  end if;
end $$;

-- Attach a note to a status-history row (rows are trigger-written; no direct update policy)
create or replace function public.annotate_status_history(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_permission('students','edit');
  update public.student_status_history set note = left(p_note, 500) where id = p_id;
end $$;
