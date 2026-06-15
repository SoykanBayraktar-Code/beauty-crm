-- 0009_treatments.sql — Klinik kayıt + SOAP (Faz 2.3)

create table public.treatment_records (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  customer_id       uuid not null references public.customers(id) on delete cascade,
  appointment_id    uuid references public.appointments(id) on delete set null,
  procedure_type_id uuid references public.procedure_types(id) on delete set null,
  staff_id          uuid references public.staff(id) on delete set null,
  area              text,
  performed_at      timestamptz not null default now(),
  soap_subjective   text,
  soap_objective    text,
  soap_assessment   text,
  soap_plan         text,
  parameters        jsonb not null default '{}'::jsonb,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index treatment_records_customer_idx
  on public.treatment_records(customer_id, performed_at desc) where deleted_at is null;

create trigger trg_treatment_records_updated before update on public.treatment_records
  for each row execute function public.set_updated_at();

-- ── RLS: klinik erişim kuralı (owner / randevulu uzman) ──
alter table public.treatment_records enable row level security;

create policy treatment_select on public.treatment_records
  for select using (public.can_access_clinical(customer_id));
create policy treatment_insert on public.treatment_records
  for insert with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(customer_id)
  );
create policy treatment_update on public.treatment_records
  for update using (
    public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(customer_id)
  )
  with check (
    public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(customer_id)
  );
