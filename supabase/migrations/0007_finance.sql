-- 0007: finance.

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency in ('BDT','CNY','USD')),
  rate_to_bdt numeric(14,6) not null check (rate_to_bdt > 0),
  effective_date date not null default public.today_dhaka(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (currency, effective_date)
);
create index if not exists idx_exchange_rates_created_by on public.exchange_rates(created_by);
select public.attach_std_triggers('exchange_rates');

-- Latest rate on or before a date (BDT is always 1)
create or replace function public.rate_to_bdt(p_currency text, p_date date default public.today_dhaka())
returns numeric language sql stable as $$
  select case when p_currency = 'BDT' then 1::numeric else coalesce((
    select rate_to_bdt from public.exchange_rates
    where currency = p_currency and effective_date <= p_date and deleted_at is null
    order by effective_date desc limit 1
  ), (
    select rate_to_bdt from public.exchange_rates
    where currency = p_currency and deleted_at is null
    order by effective_date asc limit 1
  )) end
$$;

create table if not exists public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income','expense')),
  name text not null,
  is_archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create unique index if not exists uq_txn_categories on public.transaction_categories(type, lower(name)) where deleted_at is null;
create index if not exists idx_txn_categories_created_by on public.transaction_categories(created_by);
select public.attach_std_triggers('transaction_categories');

create table if not exists public.fee_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null default 'Service package',
  total_amount numeric(14,2) not null check (total_amount >= 0),
  currency text not null default 'BDT' check (currency in ('BDT','CNY','USD')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_fee_plans_student on public.fee_plans(student_id);
create index if not exists idx_fee_plans_created_by on public.fee_plans(created_by);
select public.attach_std_triggers('fee_plans');

create table if not exists public.fee_installments (
  id uuid primary key default gen_random_uuid(),
  fee_plan_id uuid not null references public.fee_plans(id) on delete cascade,
  label text not null,
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0,   -- maintained by trigger from transactions
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_fee_installments_plan on public.fee_installments(fee_plan_id);
create index if not exists idx_fee_installments_due on public.fee_installments(due_date);
create index if not exists idx_fee_installments_created_by on public.fee_installments(created_by);
select public.attach_std_triggers('fee_installments');

create sequence if not exists public.receipt_no_seq start 10001;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income','expense')),
  txn_date date not null default public.today_dhaka(),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'BDT' check (currency in ('BDT','CNY','USD')),
  exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  amount_bdt numeric(14,2) generated always as (round(amount * exchange_rate, 2)) stored,
  category_id uuid not null references public.transaction_categories(id) on delete restrict,
  student_id uuid references public.students(id) on delete set null,
  fee_installment_id uuid references public.fee_installments(id) on delete set null,
  payment_method text not null default 'Cash' check (payment_method in ('Cash','bKash','Nagad','Bank Transfer','Card')),
  reference_no text,
  vendor text,
  note text,
  receipt_path text,
  receipt_no text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);
create index if not exists idx_transactions_category on public.transactions(category_id);
create index if not exists idx_transactions_student on public.transactions(student_id);
create index if not exists idx_transactions_installment on public.transactions(fee_installment_id);
create index if not exists idx_transactions_created_by on public.transactions(created_by);
create index if not exists idx_transactions_date on public.transactions(txn_date);
create index if not exists idx_transactions_type_date on public.transactions(type, txn_date);
select public.attach_std_triggers('transactions');

-- Assign money-receipt number to student income
create or replace function public.txn_receipt_no()
returns trigger language plpgsql as $$
begin
  if new.type = 'income' and new.student_id is not null and new.receipt_no is null then
    new.receipt_no := 'MR-' || nextval('public.receipt_no_seq')::text;
  end if;
  if new.type = 'expense' then
    new.student_id := null;
    new.fee_installment_id := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_transactions_receipt on public.transactions;
create trigger trg_transactions_receipt before insert or update on public.transactions
  for each row execute function public.txn_receipt_no();

-- Recompute paid amount on installments touched by a transaction change
create or replace function public.recalc_installment(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.fee_installments i set paid_amount = coalesce((
    select sum(round(t.amount_bdt / public.rate_to_bdt(fp.currency, t.txn_date), 2))
    from public.transactions t
    join public.fee_installments i2 on i2.id = t.fee_installment_id
    join public.fee_plans fp on fp.id = i2.fee_plan_id
    where t.fee_installment_id = p_id and t.deleted_at is null and t.type = 'income'
  ), 0)
  where i.id = p_id
$$;

create or replace function public.txn_recalc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.fee_installment_id is not null then
    perform public.recalc_installment(old.fee_installment_id);
  end if;
  if tg_op in ('INSERT','UPDATE') and new.fee_installment_id is not null then
    perform public.recalc_installment(new.fee_installment_id);
  end if;
  return null;
end $$;
drop trigger if exists trg_transactions_recalc on public.transactions;
create trigger trg_transactions_recalc after insert or update or delete on public.transactions
  for each row execute function public.txn_recalc();
