-- 0001: extensions and generic helpers. Re-runnable.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- created_by default from the JWT user when present
create or replace function public.set_created_by()
returns trigger language plpgsql as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

-- Attach the standard triggers to a business table.
create or replace function public.attach_std_triggers(p_table text)
returns void language plpgsql as $$
begin
  execute format('drop trigger if exists trg_%1$s_updated on public.%1$I', p_table);
  execute format('create trigger trg_%1$s_updated before update on public.%1$I for each row execute function public.set_updated_at()', p_table);
  execute format('drop trigger if exists trg_%1$s_created_by on public.%1$I', p_table);
  execute format('create trigger trg_%1$s_created_by before insert on public.%1$I for each row execute function public.set_created_by()', p_table);
end $$;

-- Today in Asia/Dhaka
create or replace function public.today_dhaka()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Dhaka')::date
$$;
