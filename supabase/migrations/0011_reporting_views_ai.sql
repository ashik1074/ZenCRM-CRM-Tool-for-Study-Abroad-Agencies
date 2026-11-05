-- 0011: curated reporting views (for the AI assistant) and the readonly_ai role.
-- These views are owned by the migration user and bypass RLS, so they are NOT exposed to
-- anon/authenticated. Only `readonly_ai` can read them, and the server decides per user role
-- which views a query may reference. Student-scoped views (v_my_*) filter on the
-- transaction-local setting app.user_id that the server sets before running the query.

drop view if exists public.v_students cascade;
create view public.v_students as
select s.id, s.student_code, s.full_name, s.gender, s.date_of_birth, s.nationality,
       s.phone, s.whatsapp, s.email, s.passport_no, s.passport_issue_date, s.passport_expiry_date,
       s.status, s.intake, s.intended_program_level, s.scholarship_type, s.hsk_level, s.ielts_score,
       s.lead_source, s.referred_by, c.full_name as counselor_name,
       s.previous_china_visa, s.previous_china_residence,
       (s.created_at at time zone 'Asia/Dhaka')::date as registered_date,
       s.is_draft
from public.students s
left join public.profiles c on c.id = s.counselor_id
where s.deleted_at is null;

drop view if exists public.v_student_status_history cascade;
create view public.v_student_status_history as
select h.student_id, s.full_name as student_name, h.from_status, h.to_status,
       (h.changed_at at time zone 'Asia/Dhaka') as changed_at_dhaka,
       (h.changed_at at time zone 'Asia/Dhaka')::date as changed_date
from public.student_status_history h
join public.students s on s.id = h.student_id and s.deleted_at is null;

drop view if exists public.v_universities cascade;
create view public.v_universities as
select u.id, u.name, u.city, u.province, u.ranking, u.website, u.is_active
from public.universities u where u.deleted_at is null;

drop view if exists public.v_offers cascade;
create view public.v_offers as
select o.id, o.title, u.name as university_name, u.city as university_city, o.program, o.degree_level,
       o.intake, o.scholarship_type, o.covers_tuition, o.covers_accommodation, o.stipend_amount, o.stipend_currency,
       o.tuition_fee, o.accommodation_fee, o.fee_currency, o.application_deadline, o.language_of_instruction,
       o.source, o.status, (o.created_at at time zone 'Asia/Dhaka')::date as created_date
from public.offers o join public.universities u on u.id = o.university_id
where o.deleted_at is null;

drop view if exists public.v_applications cascade;
create view public.v_applications as
select a.id, a.student_id, s.full_name as student_name, s.status as student_status,
       u.name as university_name, u.city as university_city, o.title as offer_title, o.program,
       o.degree_level, o.intake, o.scholarship_type, a.status, a.applied_at, a.decision_at
from public.applications a
join public.students s on s.id = a.student_id and s.deleted_at is null
join public.offers o on o.id = a.offer_id
join public.universities u on u.id = a.university_id
where a.deleted_at is null;

drop view if exists public.v_tasks cascade;
create view public.v_tasks as
select t.id, t.title, t.status, t.priority, t.due_date, t.tags,
       a.full_name as assignee_name, r.full_name as reporter_name,
       sp.name as sprint_name, sp.status as sprint_status, s.full_name as student_name,
       (t.created_at at time zone 'Asia/Dhaka')::date as created_date,
       (t.completed_at at time zone 'Asia/Dhaka')::date as completed_date
from public.tasks t
left join public.profiles a on a.id = t.assignee_id
left join public.profiles r on r.id = t.reporter_id
left join public.sprints sp on sp.id = t.sprint_id
left join public.students s on s.id = t.student_id
where t.deleted_at is null;

drop view if exists public.v_finance cascade;
create view public.v_finance as
select t.id, t.type, t.txn_date, t.amount, t.currency, t.exchange_rate, t.amount_bdt,
       c.name as category, t.payment_method, t.reference_no, t.vendor, s.full_name as student_name, t.receipt_no
from public.transactions t
join public.transaction_categories c on c.id = t.category_id
left join public.students s on s.id = t.student_id
where t.deleted_at is null;

drop view if exists public.v_fee_dues cascade;
create view public.v_fee_dues as
select s.id as student_id, s.full_name as student_name, fp.title as plan_title, fp.currency,
       fp.total_amount,
       coalesce(sum(i.paid_amount), 0) as paid_amount,
       fp.total_amount - coalesce(sum(i.paid_amount), 0) as balance_due,
       coalesce(sum(greatest(i.amount - i.paid_amount, 0)) filter (where i.due_date < public.today_dhaka()), 0) as overdue_amount
from public.fee_plans fp
join public.students s on s.id = fp.student_id and s.deleted_at is null
left join public.fee_installments i on i.fee_plan_id = fp.id and i.deleted_at is null
where fp.deleted_at is null
group by s.id, s.full_name, fp.id, fp.title, fp.currency, fp.total_amount;

-- ---- student self-service views ----
create or replace function public.ai_user_id()
returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

drop view if exists public.v_my_student cascade;
create view public.v_my_student as
select * from public.v_students where id = (select id from public.students where user_id = public.ai_user_id() and deleted_at is null);

drop view if exists public.v_my_status_history cascade;
create view public.v_my_status_history as
select * from public.v_student_status_history where student_id = (select id from public.students where user_id = public.ai_user_id());

drop view if exists public.v_my_applications cascade;
create view public.v_my_applications as
select * from public.v_applications where student_id = (select id from public.students where user_id = public.ai_user_id());

drop view if exists public.v_my_payments cascade;
create view public.v_my_payments as
select t.txn_date, t.amount, t.currency, t.amount_bdt, c.name as category, t.payment_method, t.receipt_no
from public.transactions t
join public.transaction_categories c on c.id = t.category_id
where t.deleted_at is null and t.type = 'income'
  and t.student_id = (select id from public.students where user_id = public.ai_user_id());

-- ---- lock views down ----
do $$
declare v text;
begin
  foreach v in array array['v_students','v_student_status_history','v_universities','v_offers','v_applications',
    'v_tasks','v_finance','v_fee_dues','v_my_student','v_my_status_history','v_my_applications','v_my_payments']
  loop
    execute format('revoke all on public.%I from public, anon, authenticated', v);
  end loop;
end $$;

-- ---- readonly_ai role ----
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'readonly_ai') then
    create role readonly_ai nologin noinherit;
  end if;
end $$;

do $$
begin
  execute format('grant readonly_ai to %I', current_user);
exception when others then
  raise notice 'could not grant readonly_ai to %: %', current_user, sqlerrm;
end $$;

grant usage on schema public to readonly_ai;
revoke all on all tables in schema public from readonly_ai;
grant execute on function public.ai_user_id() to readonly_ai;
grant execute on function public.today_dhaka() to readonly_ai;
do $$
declare v text;
begin
  foreach v in array array['v_students','v_student_status_history','v_universities','v_offers','v_applications',
    'v_tasks','v_finance','v_fee_dues','v_my_student','v_my_status_history','v_my_applications','v_my_payments']
  loop
    execute format('grant select on public.%I to readonly_ai', v);
  end loop;
end $$;
alter role readonly_ai set statement_timeout = '5s';
