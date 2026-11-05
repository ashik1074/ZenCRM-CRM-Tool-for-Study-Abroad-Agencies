-- 0006: knowledge base.

create table if not exists public.kb_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  body text not null default '',               -- HTML (body_format='html') or plain text (body_format='text')
  body_format text not null default 'html' check (body_format in ('html','text')),
  body_text text not null default '',          -- plain-text version used for search and copy
  tags text[] not null default '{}',
  updated_by uuid references public.profiles(id) on delete set null,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(body_text,'')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_kb_search on public.kb_entries using gin (search);
create index if not exists idx_kb_title_trgm on public.kb_entries using gin (title gin_trgm_ops);
create index if not exists idx_kb_category on public.kb_entries(category);
create index if not exists idx_kb_updated_by on public.kb_entries(updated_by);
create index if not exists idx_kb_created_by on public.kb_entries(created_by);
select public.attach_std_triggers('kb_entries');

create or replace function public.kb_stamp_updated_by()
returns trigger language plpgsql as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  return new;
end $$;
drop trigger if exists trg_kb_updated_by on public.kb_entries;
create trigger trg_kb_updated_by before insert or update on public.kb_entries
  for each row execute function public.kb_stamp_updated_by();

create table if not exists public.kb_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.kb_entries(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_kb_attachments_entry on public.kb_attachments(entry_id);
select public.attach_std_triggers('kb_attachments');
