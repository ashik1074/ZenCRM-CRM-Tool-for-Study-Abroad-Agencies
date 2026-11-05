-- 0003: students and related tables.

create sequence if not exists public.student_code_seq start 1001;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique default ('ST-' || nextval('public.student_code_seq')::text),
  user_id uuid unique references public.profiles(id) on delete set null,  -- portal login
  -- personal
  full_name text not null,
  photo_path text,
  gender text check (gender in ('male','female','other')),
  date_of_birth date,
  nationality text not null default 'Bangladeshi',
  phone text,
  whatsapp text,
  email text,
  present_address text,
  permanent_address text,
  -- passport
  passport_no text,
  passport_issue_date date,
  passport_expiry_date date,
  -- language
  hsk_level text,
  ielts_score numeric(3,1),
  other_language_scores text,
  -- study preferences
  intended_program_level text check (intended_program_level in ('Language','Diploma','Bachelor','Master','PhD')),
  preferred_majors text[] not null default '{}',
  preferred_cities text[] not null default '{}',
  preferred_universities text[] not null default '{}',
  intake text,
  scholarship_type text check (scholarship_type in ('CSC','Provincial','University','Self-funded')),
  -- travel (questions from the visa sheet)
  has_valid_foreign_visa boolean not null default false,
  visited_countries_past_12m boolean not null default false,
  previous_china_visa boolean not null default false,
  previous_china_residence boolean not null default false,
  -- source & assignment
  lead_source text,
  referred_by text,
  counselor_id uuid references public.profiles(id) on delete set null,
  -- pipeline
  status text not null default 'inquiry' check (status in (
    'inquiry','registered','documents_collecting','applied','offer_received','jw202_received',
    'visa_applied','visa_approved','visa_rejected','departed','enrolled','dropped','on_hold')),
  is_draft boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_students_user on public.students(user_id);
create index if not exists idx_students_counselor on public.students(counselor_id);
create index if not exists idx_students_created_by on public.students(created_by);
create index if not exists idx_students_status on public.students(status);
create index if not exists idx_students_created_at on public.students(created_at);
create index if not exists idx_students_passport_expiry on public.students(passport_expiry_date);
create index if not exists idx_students_intake on public.students(intake);
create index if not exists idx_students_phone on public.students(phone);
create index if not exists idx_students_email on public.students(lower(email));
create index if not exists idx_students_passport on public.students(upper(passport_no));
create index if not exists idx_students_name_trgm on public.students using gin (full_name gin_trgm_ops);
create index if not exists idx_students_phone_trgm on public.students using gin (phone gin_trgm_ops);
create index if not exists idx_students_email_trgm on public.students using gin (email gin_trgm_ops);
create index if not exists idx_students_passport_trgm on public.students using gin (passport_no gin_trgm_ops);
select public.attach_std_triggers('students');

create table if not exists public.student_education (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  level text not null check (level in ('SSC','HSC','Diploma','Bachelor','Master')),
  institution text not null,
  degree text,
  major text,
  passing_year int check (passing_year between 1950 and 2100),
  gpa text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_student_education_student on public.student_education(student_id);
select public.attach_std_triggers('student_education');

create table if not exists public.student_work_experience (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  company text not null,
  address text,
  employer_phone text,
  position text,
  duty text,
  supervisor_name text,
  supervisor_phone text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_student_work_student on public.student_work_experience(student_id);
select public.attach_std_triggers('student_work_experience');

create table if not exists public.student_family_members (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  relation text not null check (relation in ('father','mother','spouse','child')),
  name text not null,
  date_of_birth date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_student_family_student on public.student_family_members(student_id);
select public.attach_std_triggers('student_family_members');

-- kind = 'valid_visa' (currently valid visa from another country) or 'visit' (country visited in past 12 months)
create table if not exists public.student_travel_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null check (kind in ('valid_visa','visit')),
  country text not null,
  visa_type text,
  valid_until date,
  visited_from date,
  visited_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_student_travel_student on public.student_travel_history(student_id);
select public.attach_std_triggers('student_travel_history');

create table if not exists public.student_status_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists idx_student_status_history_student on public.student_status_history(student_id);
create index if not exists idx_student_status_history_changed_at on public.student_status_history(changed_at);
create index if not exists idx_student_status_history_to on public.student_status_history(to_status);
create index if not exists idx_student_status_history_by on public.student_status_history(changed_by);

create or replace function public.log_student_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.student_status_history(student_id, from_status, to_status, changed_by, changed_at)
    values (new.id, null, new.status, coalesce(auth.uid(), new.created_by), new.created_at);
  elsif new.status is distinct from old.status then
    insert into public.student_status_history(student_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists trg_students_status on public.students;
create trigger trg_students_status after insert or update of status on public.students
  for each row execute function public.log_student_status();

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  category text not null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  expiry_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_student_documents_student on public.student_documents(student_id);
create index if not exists idx_student_documents_category on public.student_documents(category);
select public.attach_std_triggers('student_documents');

-- id of the student record linked to the current portal user
create or replace function public.my_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid() and deleted_at is null limit 1
$$;
