-- 0010: Storage buckets (all private, 10 MB, images/PDF/DOCX/XLSX) and policies matching table RLS.
-- Object paths:
--   student-files/{student_id}/{uuid}-{name}
--   offer-leaflets/{offer_id}/{uuid}-{name}
--   task-attachments/{task_id}/{uuid}-{name}
--   kb-attachments/{entry_id}/{uuid}-{name}
--   receipts/{transaction_id or 'tmp'}/{uuid}-{name}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select b, b, false, 10485760, array[
  'image/jpeg','image/png','image/webp','image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel']
from unnest(array['student-files','offer-leaflets','task-attachments','kb-attachments','receipts']) b
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists crm_student_files_select on storage.objects;
drop policy if exists crm_student_files_insert on storage.objects;
drop policy if exists crm_student_files_delete on storage.objects;
drop policy if exists crm_offer_leaflets_select on storage.objects;
drop policy if exists crm_offer_leaflets_write on storage.objects;
drop policy if exists crm_offer_leaflets_delete on storage.objects;
drop policy if exists crm_task_files_select on storage.objects;
drop policy if exists crm_task_files_insert on storage.objects;
drop policy if exists crm_task_files_delete on storage.objects;
drop policy if exists crm_kb_files_select on storage.objects;
drop policy if exists crm_kb_files_insert on storage.objects;
drop policy if exists crm_kb_files_delete on storage.objects;
drop policy if exists crm_receipts_select on storage.objects;
drop policy if exists crm_receipts_insert on storage.objects;
drop policy if exists crm_receipts_delete on storage.objects;

create or replace function public.storage_first_folder_uuid(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end $$;

-- student-files
create policy crm_student_files_select on storage.objects for select to authenticated using (
  bucket_id = 'student-files' and (
    public.has_permission('students','view')
    or public.storage_first_folder_uuid(name) = public.my_student_id()));
create policy crm_student_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'student-files' and (
    public.has_permission('students','edit') or public.has_permission('students','create')
    or public.storage_first_folder_uuid(name) = public.my_student_id()));
create policy crm_student_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'student-files' and public.has_permission('students','edit'));

-- offer-leaflets
create policy crm_offer_leaflets_select on storage.objects for select to authenticated using (
  bucket_id = 'offer-leaflets' and public.has_permission('offers','view'));
create policy crm_offer_leaflets_write on storage.objects for insert to authenticated with check (
  bucket_id = 'offer-leaflets' and (public.has_permission('offers','create') or public.has_permission('offers','edit')));
create policy crm_offer_leaflets_delete on storage.objects for delete to authenticated using (
  bucket_id = 'offer-leaflets' and public.has_permission('offers','edit'));

-- task-attachments
create policy crm_task_files_select on storage.objects for select to authenticated using (
  bucket_id = 'task-attachments' and public.can_see_task_id(public.storage_first_folder_uuid(name)));
create policy crm_task_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'task-attachments' and public.has_permission('tasks','edit') and public.can_see_task_id(public.storage_first_folder_uuid(name)));
create policy crm_task_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'task-attachments' and public.has_permission('tasks','edit') and public.can_see_task_id(public.storage_first_folder_uuid(name)));

-- kb-attachments
create policy crm_kb_files_select on storage.objects for select to authenticated using (
  bucket_id = 'kb-attachments' and (public.has_permission('kb','view') or public.has_permission('portal','view')));
create policy crm_kb_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'kb-attachments' and (public.has_permission('kb','edit') or public.has_permission('kb','create')));
create policy crm_kb_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'kb-attachments' and public.has_permission('kb','edit'));

-- receipts
create policy crm_receipts_select on storage.objects for select to authenticated using (
  bucket_id = 'receipts' and public.has_permission('finance','view'));
create policy crm_receipts_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'receipts' and (public.has_permission('finance','create') or public.has_permission('finance','edit')));
create policy crm_receipts_delete on storage.objects for delete to authenticated using (
  bucket_id = 'receipts' and public.has_permission('finance','edit'));
