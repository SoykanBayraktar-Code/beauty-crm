-- 0015_finance.sql — Finans derinliği: kasa (cash_sessions) + gider (expenses) (Adım 2)

-- ── Kasa oturumu (gün aç/kapa + gün sonu mutabakat) ──
create table public.cash_sessions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  opened_by      uuid references auth.users(id) on delete set null,
  opened_at      timestamptz not null default now(),
  opening_float  numeric(12, 2) not null default 0,    -- açılış kasası
  closed_by      uuid references auth.users(id) on delete set null,
  closed_at      timestamptz,
  counted_amount numeric(12, 2),                         -- kapanışta sayılan nakit
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Aynı anda merkez başına EN FAZLA bir açık kasa
create unique index cash_sessions_one_open
  on public.cash_sessions(org_id) where closed_at is null;
create index cash_sessions_org_idx on public.cash_sessions(org_id, opened_at desc);

create trigger trg_cash_sessions_updated before update on public.cash_sessions
  for each row execute function public.set_updated_at();

-- ── Gider ──
create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  category    text not null default 'other'
                check (category in ('rent', 'supplies', 'salary', 'utilities', 'other')),
  amount      numeric(12, 2) not null check (amount > 0),
  spent_on    date not null default current_date,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index expenses_org_idx on public.expenses(org_id, spent_on desc) where deleted_at is null;

-- ── RLS ──
alter table public.cash_sessions enable row level security;
alter table public.expenses      enable row level security;

-- Kasa: finans-yetkili roller görür; owner+reception işletir
create policy cash_select on public.cash_sessions
  for select using (public.role_in_org(org_id) in ('owner', 'reception', 'accountant'));
create policy cash_write on public.cash_sessions
  for all using (public.role_in_org(org_id) in ('owner', 'reception'))
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception')
  );

-- Gider: yalnız owner + muhasebe
create policy expense_select on public.expenses
  for select using (public.role_in_org(org_id) in ('owner', 'accountant'));
create policy expense_write on public.expenses
  for all using (public.role_in_org(org_id) in ('owner', 'accountant'))
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'accountant')
  );
