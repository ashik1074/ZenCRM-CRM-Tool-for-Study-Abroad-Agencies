-- 0013: default roles, permission matrix, categories, settings. Re-runnable (does not overwrite edits
-- made from the UI except to add missing rows).

insert into public.roles (key, name, description, is_system, portal) values
  ('system_admin', 'System Administrator', 'Full access including users, roles and permissions', true, 'staff'),
  ('admin', 'Admin', 'Full business access, no user/role management', true, 'staff'),
  ('operator', 'Operator', 'Students, offers, tasks, knowledge base, AI assistant (non-finance)', true, 'staff'),
  ('finance_operator', 'Finance Operator', 'Finance module, finance reports, read-only students, own tasks', true, 'staff'),
  ('student', 'Student', 'Student portal only', true, 'student')
on conflict (key) do nothing;

-- module catalogue
insert into public.permissions (module, action, description)
select m.module, a.action, m.description
from (values
  ('dashboard','Dashboard'),
  ('students','Students'),
  ('universities','Universities'),
  ('offers','University offers'),
  ('applications','Applications (student ↔ offer)'),
  ('tasks','Tasks (own)'),
  ('tasks_all','All users'' tasks'),
  ('sprints','Sprints'),
  ('kb','Knowledge base'),
  ('finance','Finance transactions & fee plans'),
  ('finance_categories','Finance categories'),
  ('finance_reports','Finance reports'),
  ('reports','Business reports'),
  ('assistant','AI assistant'),
  ('assistant_finance','AI assistant: finance data'),
  ('audit','Audit log'),
  ('trash','Deleted items (restore)'),
  ('settings','Settings'),
  ('import','Bulk import'),
  ('portal','Student portal'),
  ('users','Users (System Admin only)'),
  ('roles','Roles & permissions (System Admin only)')
) m(module, description)
cross join (values ('view'),('create'),('edit'),('delete'),('export')) a(action)
on conflict (module, action) do nothing;

-- default grants (only inserted when the role has no grants yet, so UI edits survive re-runs)
create or replace function public._grant_defaults(p_role text, p_spec text[])
returns void language plpgsql as $$
declare r uuid; s text; m text; acts text;
begin
  select id into r from public.roles where key = p_role;
  if exists (select 1 from public.role_permissions where role_id = r) then return; end if;
  foreach s in array p_spec loop
    m := split_part(s, ':', 1);
    acts := split_part(s, ':', 2);
    insert into public.role_permissions(role_id, permission_id)
    select r, p.id from public.permissions p
    where p.module = m and (acts = '*' or p.action = any(string_to_array(acts, ',')))
    on conflict do nothing;
  end loop;
end $$;

select public._grant_defaults('admin', array[
  'dashboard:*','students:*','universities:*','offers:*','applications:*','tasks:*','tasks_all:*','sprints:*',
  'kb:*','finance:*','finance_categories:*','finance_reports:*','reports:*','assistant:*','assistant_finance:*',
  'audit:view,export','trash:view,edit','settings:view,edit','import:*']);

select public._grant_defaults('operator', array[
  'dashboard:view','students:view,create,edit,export','universities:view,create,edit','offers:view,create,edit,export',
  'applications:view,create,edit,delete','tasks:view,create,edit,delete','tasks_all:view','sprints:view,create,edit',
  'kb:view','assistant:view','import:view,create']);

select public._grant_defaults('finance_operator', array[
  'dashboard:view','students:view','tasks:view,create,edit','kb:view',
  'finance:*','finance_reports:view,export','assistant:view','assistant_finance:view']);

select public._grant_defaults('student', array['portal:view']);

drop function public._grant_defaults(text, text[]);

-- finance categories
insert into public.transaction_categories (type, name, sort_order)
select v.type, v.name, v.ord from (values
  ('income','Service Charge',1),('income','Application Fee',2),('income','Visa Processing Fee',3),
  ('income','Partner Commission',4),('income','Other',99),
  ('expense','Rent',1),('expense','Salary',2),('expense','Utilities',3),('expense','Marketing/Ads',4),
  ('expense','Application Fees Paid to University',5),('expense','Courier',6),('expense','Travel',7),
  ('expense','Office Supplies',8),('expense','Other',99)
) v(type, name, ord)
where not exists (select 1 from public.transaction_categories c where c.type = v.type and lower(c.name) = lower(v.name) and c.deleted_at is null);

-- exchange rates (approximate defaults; edit in Settings)
insert into public.exchange_rates (currency, rate_to_bdt, effective_date) values
  ('CNY', 16.80, '2024-01-01'), ('USD', 122.00, '2024-01-01')
on conflict (currency, effective_date) do nothing;

-- settings
insert into public.settings (key, value) values
  ('agency', '{"name":"Silk Road Study Abroad","logo_path":null,"phone":"+880 1700-000000","email":"info@example.com","address":"Dhaka, Bangladesh"}'),
  ('default_currency', '"BDT"'),
  ('intakes', '["March 2026","September 2026","March 2027","September 2027"]'),
  ('lead_sources', '["Facebook","Referral","Walk-in","Website","Agent"]'),
  ('document_categories', '["Passport","Photo","Transcript","Certificate","Bank Statement","Solvency","Admission Letter","JW202","Visa","Other"]'),
  ('required_documents', '["Passport","Photo","Transcript","Certificate","Bank Statement","Solvency","Admission Letter","JW202"]')
on conflict (key) do nothing;
