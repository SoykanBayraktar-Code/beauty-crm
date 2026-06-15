-- 0002_customers.sql — Müşteri yönetimi (Faz 1.1)

create extension if not exists pg_trgm;

-- ── customers ──
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  full_name   text not null,
  phone       text,
  email       text,
  birth_date  date,
  gender      text check (gender in ('female', 'male', 'other')),
  source      text,
  tags        text[] not null default '{}',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index customers_org_idx on public.customers(org_id) where deleted_at is null;
create index customers_name_trgm on public.customers using gin (full_name gin_trgm_ops);
create index customers_phone_idx on public.customers(phone);
create index customers_tags_idx on public.customers using gin (tags);

create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

-- ── customer_notes ──
create table public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index customer_notes_customer_idx on public.customer_notes(customer_id);

-- ── RLS ──
alter table public.customers      enable row level security;
alter table public.customer_notes enable row level security;

-- Üyeler görür (muhasebe dahil; sütun kısıtı UI'da). Yazma: owner/reception/specialist.
create policy customers_select on public.customers
  for select using (public.is_org_member(org_id));
create policy customers_insert on public.customers
  for insert with check (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );
create policy customers_update on public.customers
  for update using (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  )
  with check (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );
create policy customers_delete on public.customers
  for delete using (public.role_in_org(org_id) in ('owner', 'reception'));

create policy customer_notes_select on public.customer_notes
  for select using (public.is_org_member(org_id));
create policy customer_notes_write on public.customer_notes
  for all using (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  )
  with check (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );
