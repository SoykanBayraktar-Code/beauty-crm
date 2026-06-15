-- 0001_init.sql
-- Kiracılık & kimlik temeli: organizations / org_members / staff
-- + RLS yardımcıları + politikalar + güvenli kurulum RPC'si.
-- Tasarım: multi-tenant hazır, DB düzeyinde izolasyon (RLS).

-- ── Eklentiler ──
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist";  -- (randevu çakışma EXCLUDE'u için sonraki fazda)

-- ── Roller ──
create type public.org_role as enum ('owner', 'reception', 'specialist', 'accountant');

-- ── organizations ──
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  currency    text not null default 'TRY',
  timezone    text not null default 'Europe/Istanbul',
  logo_url    text,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── org_members (auth.users ↔ org + rol) ──
create table public.org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.org_role not null default 'reception',
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, user_id)
);
create index org_members_user_idx on public.org_members(user_id) where deleted_at is null;
create index org_members_org_idx on public.org_members(org_id) where deleted_at is null;

-- ── staff (uzman detayı; bir üyeye bağlı olabilir) ──
create table public.staff (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  member_id      uuid references public.org_members(id) on delete set null,
  full_name      text not null,
  title          text,
  specialties    text[] not null default '{}',
  calendar_color text not null default '#C7A35A',
  working_hours  jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index staff_org_idx on public.staff(org_id) where deleted_at is null;

-- ── updated_at tetikleyicisi ──
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_orgs_updated  before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger trg_staff_updated before update on public.staff
  for each row execute function public.set_updated_at();

-- ── RLS yardımcıları (SECURITY DEFINER → org_members RLS'ine takılmaz, recursion yok) ──
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where user_id = auth.uid()
      and org_id = target_org
      and deleted_at is null
  );
$$;

create or replace function public.role_in_org(target_org uuid)
returns public.org_role language sql stable security definer set search_path = public as $$
  select role from public.org_members
  where user_id = auth.uid()
    and org_id = target_org
    and deleted_at is null
  limit 1;
$$;

-- Aktif merkez (tek-üyelik başlangıç; SaaS'ta JWT claim'e taşınacak)
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.org_members
  where user_id = auth.uid() and deleted_at is null
  limit 1;
$$;

-- ── RLS etkinleştir ──
alter table public.organizations enable row level security;
alter table public.org_members  enable row level security;
alter table public.staff         enable row level security;

-- organizations: üyeler görür; yalnız owner günceller (insert RPC ile)
create policy orgs_select on public.organizations
  for select using (public.is_org_member(id));
create policy orgs_update on public.organizations
  for update using (public.role_in_org(id) = 'owner')
  with check (public.role_in_org(id) = 'owner');

-- org_members: üyeler görür; yalnız owner yönetir
create policy members_select on public.org_members
  for select using (public.is_org_member(org_id));
create policy members_insert on public.org_members
  for insert with check (public.role_in_org(org_id) = 'owner');
create policy members_update on public.org_members
  for update using (public.role_in_org(org_id) = 'owner')
  with check (public.role_in_org(org_id) = 'owner');
create policy members_delete on public.org_members
  for delete using (public.role_in_org(org_id) = 'owner');

-- staff: üyeler görür; yalnız owner yönetir
create policy staff_select on public.staff
  for select using (public.is_org_member(org_id));
create policy staff_write on public.staff
  for all using (public.role_in_org(org_id) = 'owner')
  with check (public.role_in_org(org_id) = 'owner');

-- ── Güvenli kurulum RPC'si: ilk merkez + owner üyelik + staff (atomik) ──
create or replace function public.create_organization(p_name text, p_full_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'Kimlik doğrulaması gerekli';
  end if;

  insert into public.organizations(name) values (p_name) returning id into v_org;

  insert into public.org_members(org_id, user_id, role)
    values (v_org, v_uid, 'owner') returning id into v_member;

  insert into public.staff(org_id, member_id, full_name)
    values (v_org, v_member, coalesce(nullif(p_full_name, ''), 'Yönetici'));

  return v_org;
end;
$$;

-- ── Yetkiler ──
grant execute on function public.is_org_member(uuid)   to authenticated;
grant execute on function public.role_in_org(uuid)     to authenticated;
grant execute on function public.current_org_id()      to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
