-- 0004: universities, offers, attachments, applications.

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  province text,
  ranking int,
  website text,
  contact_person text,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create unique index if not exists uq_universities_name on public.universities(lower(name)) where deleted_at is null;
create index if not exists idx_universities_name_trgm on public.universities using gin (name gin_trgm_ops);
create index if not exists idx_universities_city on public.universities(city);
create index if not exists idx_universities_created_by on public.universities(created_by);
select public.attach_std_triggers('universities');

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  university_id uuid not null references public.universities(id) on delete restrict,
  program text not null,
  degree_level text not null check (degree_level in ('Language','Diploma','Bachelor','Master','PhD')),
  intake text,
  scholarship_type text check (scholarship_type in ('CSC','Provincial','University','Self-funded')),
  covers_tuition boolean not null default false,
  covers_accommodation boolean not null default false,
  stipend_amount numeric(14,2),
  stipend_currency text not null default 'CNY' check (stipend_currency in ('BDT','CNY','USD')),
  tuition_fee numeric(14,2),
  accommodation_fee numeric(14,2),
  fee_currency text not null default 'CNY' check (fee_currency in ('BDT','CNY','USD')),
  application_deadline date,
  language_of_instruction text check (language_of_instruction in ('English','Chinese','Bilingual')),
  eligibility text,
  source text not null default 'direct' check (source in ('direct','partner_agent')),
  partner_name text,
  status text not null default 'open' check (status in ('open','closed','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_offers_university on public.offers(university_id);
create index if not exists idx_offers_created_by on public.offers(created_by);
create index if not exists idx_offers_status on public.offers(status);
create index if not exists idx_offers_deadline on public.offers(application_deadline);
create index if not exists idx_offers_intake on public.offers(intake);
create index if not exists idx_offers_created_at on public.offers(created_at);
create index if not exists idx_offers_title_trgm on public.offers using gin (title gin_trgm_ops);
create index if not exists idx_offers_program_trgm on public.offers using gin (program gin_trgm_ops);
select public.attach_std_triggers('offers');

-- Auto-expire on write when the deadline has passed
create or replace function public.offer_auto_expire()
returns trigger language plpgsql as $$
begin
  if new.application_deadline is not null
     and new.application_deadline < public.today_dhaka()
     and new.status = 'open' then
    new.status := 'expired';
  end if;
  return new;
end $$;
drop trigger if exists trg_offers_expire on public.offers;
create trigger trg_offers_expire before insert or update on public.offers
  for each row execute function public.offer_auto_expire();

-- Batch expiry, called when lists load and by the scheduled job
create or replace function public.expire_offers()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.offers set status = 'expired'
  where status = 'open' and application_deadline < public.today_dhaka() and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

create table if not exists public.offer_attachments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_offer_attachments_offer on public.offer_attachments(offer_id);
select public.attach_std_triggers('offer_attachments');

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete restrict,
  university_id uuid not null references public.universities(id) on delete restrict,
  status text not null default 'submitted' check (status in ('submitted','under_review','accepted','rejected','withdrawn')),
  applied_at date not null default public.today_dhaka(),
  decision_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create unique index if not exists uq_applications_student_offer on public.applications(student_id, offer_id) where deleted_at is null;
create index if not exists idx_applications_student on public.applications(student_id);
create index if not exists idx_applications_offer on public.applications(offer_id);
create index if not exists idx_applications_university on public.applications(university_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_applied_at on public.applications(applied_at);
create index if not exists idx_applications_created_by on public.applications(created_by);
select public.attach_std_triggers('applications');

-- Keep university_id in sync with the offer; stamp decision date
create or replace function public.application_sync()
returns trigger language plpgsql as $$
begin
  select university_id into new.university_id from public.offers where id = new.offer_id;
  if new.status in ('accepted','rejected') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.decision_at := coalesce(new.decision_at, public.today_dhaka());
  end if;
  return new;
end $$;
drop trigger if exists trg_applications_sync on public.applications;
create trigger trg_applications_sync before insert or update on public.applications
  for each row execute function public.application_sync();
