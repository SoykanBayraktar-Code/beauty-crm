-- 0016_segments.sql — Kaydedilmiş müşteri segmentleri (filtre tanımları) (Adım 3)
-- Aynı motor Pazarlama'da (Adım 5) kampanya hedefi olarak yeniden kullanılır.

create table public.segments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  criteria    jsonb not null default '{}'::jsonb,  -- filtre parametreleri
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index segments_org_idx on public.segments(org_id) where deleted_at is null;

alter table public.segments enable row level security;

-- Üyeler görür; owner + resepsiyon yönetir (pazarlama-yetkili roller)
create policy segments_select on public.segments
  for select using (public.is_org_member(org_id));
create policy segments_write on public.segments
  for all using (public.role_in_org(org_id) in ('owner', 'reception'))
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception')
  );
