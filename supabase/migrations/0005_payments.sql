-- 0005_payments.sql — Ödeme & makbuz (Faz 1.4)

create type public.payment_method as enum ('cash', 'card', 'transfer', 'online');

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  customer_id         uuid not null references public.customers(id) on delete cascade,
  appointment_id      uuid references public.appointments(id) on delete set null,
  customer_package_id uuid references public.customer_packages(id) on delete set null,
  receipt_no          text not null,
  amount              numeric(10, 2) not null check (amount > 0),
  method              public.payment_method not null,
  type                text not null default 'service'
                        check (type in ('service', 'package', 'product', 'other')),
  note                text,
  paid_at             timestamptz not null default now(),
  staff_id            uuid references public.staff(id) on delete set null,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index payments_org_paid_idx on public.payments(org_id, paid_at) where deleted_at is null;
create index payments_customer_idx on public.payments(customer_id) where deleted_at is null;
create index payments_receipt_idx on public.payments(org_id, receipt_no);

-- ── RLS: üyeler okur (muhasebe finans görür); owner/reception tahsil eder ──
alter table public.payments enable row level security;

create policy payments_select on public.payments
  for select using (public.is_org_member(org_id));
create policy payments_write on public.payments
  for all using (public.role_in_org(org_id) in ('owner', 'reception'))
  with check (public.role_in_org(org_id) in ('owner', 'reception'));
