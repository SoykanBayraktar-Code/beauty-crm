-- 0006_consents.sql — KVKK onam & denetim kaydı (Faz 1.5)

-- ── consent_templates (versiyonlu onam metinleri) ──
create table public.consent_templates (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  body       text not null,
  version    integer not null default 1,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index consent_templates_org_idx on public.consent_templates(org_id) where deleted_at is null;

create trigger trg_consent_templates_updated before update on public.consent_templates
  for each row execute function public.set_updated_at();

-- ── customer_consents (alınan açık rıza; metin anlık görüntüsüyle) ──
create table public.customer_consents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  template_id   uuid references public.consent_templates(id) on delete set null,
  title         text not null,
  version       integer not null default 1,
  body_snapshot text not null,
  granted_at    timestamptz not null default now(),
  granted_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index customer_consents_customer_idx on public.customer_consents(customer_id);

-- ── audit_log (denetim izi) ──
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log(org_id, created_at desc);

-- ── RLS ──
alter table public.consent_templates enable row level security;
alter table public.customer_consents enable row level security;
alter table public.audit_log         enable row level security;

create policy consent_tpl_select on public.consent_templates
  for select using (public.is_org_member(org_id));
create policy consent_tpl_write on public.consent_templates
  for all using (public.role_in_org(org_id) = 'owner')
  with check (public.role_in_org(org_id) = 'owner');

create policy cust_consent_select on public.customer_consents
  for select using (public.is_org_member(org_id));
create policy cust_consent_write on public.customer_consents
  for all using (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  )
  with check (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );

-- audit_log: yalnız owner okur; üyeler kendi org'larına kayıt ekleyebilir
create policy audit_select on public.audit_log
  for select using (public.role_in_org(org_id) = 'owner');
create policy audit_insert on public.audit_log
  for insert with check (public.is_org_member(org_id));
