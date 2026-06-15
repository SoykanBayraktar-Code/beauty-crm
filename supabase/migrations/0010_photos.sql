-- 0010_photos.sql — Öncesi/sonrası fotoğraf (onam korumalı, özel Storage) (Faz 2.4)

-- ── treatment_photos: klinik fotoğraf meta (dosya Storage'da, yol burada) ──
create table public.treatment_photos (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  customer_id         uuid not null references public.customers(id) on delete cascade,
  treatment_record_id uuid references public.treatment_records(id) on delete set null,
  kind                text not null check (kind in ('before', 'after')),
  storage_path        text not null,
  caption             text,
  taken_at            timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index treatment_photos_customer_idx
  on public.treatment_photos(customer_id, taken_at desc) where deleted_at is null;

-- ── RLS: klinik erişim kuralına bağlı (owner tümü, randevulu uzman) ──
alter table public.treatment_photos enable row level security;

create policy photo_select on public.treatment_photos
  for select using (public.can_access_clinical(customer_id));
create policy photo_insert on public.treatment_photos
  for insert with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(customer_id)
  );
create policy photo_update on public.treatment_photos
  for update using (
    public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(customer_id)
  )
  with check (
    public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(customer_id)
  );

-- ── Özel Storage bucket (dosyalar yalnız imzalı URL ile okunur) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'treatment-photos', 'treatment-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Dosya yolu deseni: {org_id}/{customer_id}/{uuid}.{ext}
--   foldername(name)[1] = org_id, [2] = customer_id
create policy "tphoto storage select" on storage.objects
  for select to authenticated using (
    bucket_id = 'treatment-photos'
    and public.can_access_clinical(((storage.foldername(name))[2])::uuid)
  );
create policy "tphoto storage insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'treatment-photos'
    and ((storage.foldername(name))[1])::uuid = public.current_org_id()
    and public.role_in_org(((storage.foldername(name))[1])::uuid) in ('owner', 'specialist')
    and public.can_access_clinical(((storage.foldername(name))[2])::uuid)
  );
create policy "tphoto storage delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'treatment-photos'
    and public.role_in_org(((storage.foldername(name))[1])::uuid) in ('owner', 'specialist')
    and public.can_access_clinical(((storage.foldername(name))[2])::uuid)
  );
