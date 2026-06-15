-- 0003_catalog.sql — Hizmet & paket kataloğu (Faz 1.2)

-- ── services ──
create table public.services (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null,
  category     text,
  duration_min integer not null default 30 check (duration_min > 0),
  price        numeric(10, 2) not null default 0 check (price >= 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index services_org_idx on public.services(org_id) where deleted_at is null;

create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();

-- ── packages (tek hizmete bağlı seans paketi; çoklu-hizmet Faz 2) ──
create table public.packages (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  name           text not null,
  service_id     uuid references public.services(id) on delete set null,
  total_sessions integer not null default 1 check (total_sessions > 0),
  price          numeric(10, 2) not null default 0 check (price >= 0),
  valid_days     integer check (valid_days is null or valid_days > 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index packages_org_idx on public.packages(org_id) where deleted_at is null;

create trigger trg_packages_updated before update on public.packages
  for each row execute function public.set_updated_at();

-- ── RLS: üyeler okur; yalnız owner yönetir ──
alter table public.services enable row level security;
alter table public.packages enable row level security;

create policy services_select on public.services
  for select using (public.is_org_member(org_id));
create policy services_write on public.services
  for all using (public.role_in_org(org_id) = 'owner')
  with check (public.role_in_org(org_id) = 'owner');

create policy packages_select on public.packages
  for select using (public.is_org_member(org_id));
create policy packages_write on public.packages
  for all using (public.role_in_org(org_id) = 'owner')
  with check (public.role_in_org(org_id) = 'owner');
