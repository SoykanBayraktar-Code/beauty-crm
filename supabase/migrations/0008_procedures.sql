-- 0008_procedures.sql — İşlem türü & parametre şeması (Faz 2.2)

create table public.procedure_types (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  name                     text not null,
  category                 text,
  is_medical               boolean not null default false,
  requires_consent         boolean not null default false,
  -- Alan tanımları: [{key,label,type:text|number|select|textarea,unit?,options?}]
  parameter_schema         jsonb not null default '[]'::jsonb,
  default_session_count    integer not null default 1,
  recommended_interval_days integer,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);
create index procedure_types_org_idx on public.procedure_types(org_id) where deleted_at is null;

create trigger trg_procedure_types_updated before update on public.procedure_types
  for each row execute function public.set_updated_at();

-- hizmet → işlem türü bağı
alter table public.services
  add column procedure_type_id uuid references public.procedure_types(id) on delete set null;

-- ── RLS: üyeler okur; owner yönetir ──
alter table public.procedure_types enable row level security;

create policy proc_types_select on public.procedure_types
  for select using (public.is_org_member(org_id));
create policy proc_types_write on public.procedure_types
  for all using (public.role_in_org(org_id) = 'owner')
  with check (public.role_in_org(org_id) = 'owner');
