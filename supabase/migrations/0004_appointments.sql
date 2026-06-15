-- 0004_appointments.sql — Randevu & seans takibi (Faz 1.3)

create type public.appointment_status as enum (
  'scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'no_show', 'cancelled'
);

-- ── customer_packages (satılan paket; kalan seans takibi) ──
create table public.customer_packages (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  customer_id    uuid not null references public.customers(id) on delete cascade,
  package_id     uuid references public.packages(id) on delete set null,
  service_id     uuid references public.services(id) on delete set null,
  name           text not null,
  sessions_total integer not null check (sessions_total > 0),
  sessions_used  integer not null default 0 check (sessions_used >= 0),
  price_paid     numeric(10, 2) not null default 0,
  purchased_at   timestamptz not null default now(),
  expires_at     timestamptz,
  status         text not null default 'active'
                   check (status in ('active', 'completed', 'expired', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index customer_packages_customer_idx on public.customer_packages(customer_id) where deleted_at is null;

create trigger trg_customer_packages_updated before update on public.customer_packages
  for each row execute function public.set_updated_at();

-- ── appointments ──
create table public.appointments (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  customer_id         uuid not null references public.customers(id) on delete cascade,
  staff_id            uuid not null references public.staff(id) on delete restrict,
  service_id          uuid references public.services(id) on delete set null,
  customer_package_id uuid references public.customer_packages(id) on delete set null,
  start_at            timestamptz not null,
  end_at              timestamptz not null,
  status              public.appointment_status not null default 'scheduled',
  notes               text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (end_at > start_at),
  -- Aynı uzman + çakışan zaman aralığı → DB düzeyinde imkânsız (iptal/silinmiş hariç)
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (deleted_at is null and status <> 'cancelled')
);
create index appointments_org_start_idx on public.appointments(org_id, start_at) where deleted_at is null;
create index appointments_staff_start_idx on public.appointments(staff_id, start_at) where deleted_at is null;
create index appointments_customer_idx on public.appointments(customer_id) where deleted_at is null;

create trigger trg_appointments_updated before update on public.appointments
  for each row execute function public.set_updated_at();

-- ── Tamamlanınca paketten seans düş (geri alınınca iade et) ──
create or replace function public.sync_package_sessions()
returns trigger language plpgsql as $$
begin
  if new.customer_package_id is not null then
    if new.status = 'completed' and old.status <> 'completed' then
      update public.customer_packages
        set sessions_used = sessions_used + 1
        where id = new.customer_package_id;
    elsif old.status = 'completed' and new.status <> 'completed' then
      update public.customer_packages
        set sessions_used = greatest(0, sessions_used - 1)
        where id = new.customer_package_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_appt_package_sessions after update on public.appointments
  for each row execute function public.sync_package_sessions();

-- ── RLS ──
alter table public.customer_packages enable row level security;
alter table public.appointments      enable row level security;

create policy cust_pkg_select on public.customer_packages
  for select using (public.is_org_member(org_id));
create policy cust_pkg_write on public.customer_packages
  for all using (public.role_in_org(org_id) in ('owner', 'reception'))
  with check (public.role_in_org(org_id) in ('owner', 'reception'));

create policy appt_select on public.appointments
  for select using (public.is_org_member(org_id));
create policy appt_write on public.appointments
  for all using (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  )
  with check (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );
