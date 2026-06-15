-- 0011_inventory.sql — Stok & sarf malzeme + lot/SKT izlenebilirliği (Faz 2.5)

-- ── Tedarikçiler ──
create table public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  phone      text,
  email      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index suppliers_org_idx on public.suppliers(org_id) where deleted_at is null;

-- ── Ürünler (sarf / perakende) ──
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  sku           text,
  category      text not null default 'consumable' check (category in ('consumable', 'retail')),
  unit          text not null default 'adet',
  supplier_id   uuid references public.suppliers(id) on delete set null,
  reorder_level numeric not null default 0,   -- kritik stok eşiği
  sale_price    numeric,                       -- perakende satış için
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index products_org_idx on public.products(org_id) where deleted_at is null;

-- ── Lot/parti (lot no + SKT + miktar) ──
create table public.product_batches (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  batch_no    text,
  expiry_date date,
  quantity    numeric not null default 0 check (quantity >= 0),
  unit_cost   numeric,
  received_at date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index product_batches_product_idx on public.product_batches(product_id) where deleted_at is null;
create index product_batches_expiry_idx on public.product_batches(expiry_date) where deleted_at is null;

-- ── İşleme bağlı kullanım (hangi lot, hangi klinik kayıt, miktar) ──
create table public.treatment_product_usage (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  treatment_record_id uuid not null references public.treatment_records(id) on delete cascade,
  product_id          uuid not null references public.products(id) on delete restrict,
  batch_id            uuid not null references public.product_batches(id) on delete restrict,
  quantity            numeric not null check (quantity > 0),
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index tpu_record_idx on public.treatment_product_usage(treatment_record_id);
create index tpu_batch_idx on public.treatment_product_usage(batch_id);

-- updated_at triggerları
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_product_batches_updated before update on public.product_batches
  for each row execute function public.set_updated_at();

-- ── Stok düşüm / geri-alma (lot izlenebilirliği) ──
create or replace function public.apply_usage_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare avail numeric;
begin
  select quantity into avail from public.product_batches
    where id = new.batch_id and deleted_at is null for update;
  if avail is null then
    raise exception 'Lot bulunamadı veya silinmiş';
  end if;
  if avail < new.quantity then
    raise exception 'Lotta yeterli stok yok (mevcut %, istenen %)', avail, new.quantity;
  end if;
  update public.product_batches set quantity = quantity - new.quantity
    where id = new.batch_id;
  return new;
end $$;
create trigger trg_usage_deduct before insert on public.treatment_product_usage
  for each row execute function public.apply_usage_stock();

create or replace function public.revert_usage_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.product_batches set quantity = quantity + old.quantity
    where id = old.batch_id;
  return old;
end $$;
create trigger trg_usage_revert after delete on public.treatment_product_usage
  for each row execute function public.revert_usage_stock();

-- ── RLS ──
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_batches enable row level security;
alter table public.treatment_product_usage enable row level security;

-- Stok: tüm üyeler okur; owner + reception yönetir
create policy suppliers_select on public.suppliers
  for select using (public.is_org_member(org_id));
create policy suppliers_write on public.suppliers
  for all using (public.role_in_org(org_id) in ('owner', 'reception'))
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception')
  );

create policy products_select on public.products
  for select using (public.is_org_member(org_id));
create policy products_write on public.products
  for all using (public.role_in_org(org_id) in ('owner', 'reception'))
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception')
  );

create policy batches_select on public.product_batches
  for select using (public.is_org_member(org_id));
create policy batches_write on public.product_batches
  for all using (public.role_in_org(org_id) in ('owner', 'reception'))
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception')
  );

-- Kullanım: klinik kayda bağlı → klinik erişimi olan (owner / randevulu uzman)
create policy usage_select on public.treatment_product_usage
  for select using (
    public.can_access_clinical(
      (select customer_id from public.treatment_records where id = treatment_record_id)
    )
  );
create policy usage_insert on public.treatment_product_usage
  for insert with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(
      (select customer_id from public.treatment_records where id = treatment_record_id)
    )
  );
create policy usage_delete on public.treatment_product_usage
  for delete using (
    public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(
      (select customer_id from public.treatment_records where id = treatment_record_id)
    )
  );
