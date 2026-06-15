-- 0013_security_hardening.sql — Güvenlik denetimi düzeltmeleri
-- F-2: current_org_id() determinizmi · F-5: foto politikalarına aktif-org bağlaması

-- ── F-2: current_org_id() deterministik olsun ──
-- Çok-org senaryosunda rastgele org dönmesini engeller (en eski üyelik).
-- NOT: gerçek çok-org çözümü JWT claim'dir; bu yalnız determinizm/dayanıklılık sağlar.
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.org_members
  where user_id = auth.uid() and deleted_at is null
  order by created_at asc
  limit 1;
$$;

-- ── F-5: foto silme/güncelleme politikalarına aktif-org bağlaması ──
-- Insert politikası zaten org_id = current_org_id() bağlıyordu; delete/update simetrik olsun.
drop policy if exists "tphoto storage delete" on storage.objects;
create policy "tphoto storage delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'treatment-photos'
    and ((storage.foldername(name))[1])::uuid = public.current_org_id()
    and public.role_in_org(((storage.foldername(name))[1])::uuid) in ('owner', 'specialist')
    and public.can_access_clinical(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists photo_update on public.treatment_photos;
create policy photo_update on public.treatment_photos
  for update using (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(customer_id)
  )
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'specialist')
    and public.can_access_clinical(customer_id)
  );
