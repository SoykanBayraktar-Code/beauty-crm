-- 0018_invite_member.sql — H5: personel davetini DB düzeyinde zorla
-- inviteMember admin client (service_role) ile org_members/staff insert ediyordu →
-- RLS tamamen baypas, owner doğrulaması tek bir uygulama-katmanı if'ine bağlıydı.
-- Bu SECURITY DEFINER RPC owner kontrolünü DB içinde tekrarlar; böylece admin
-- client yalnız auth.admin.createUser için kullanılır (RLS baypas yüzeyi minimum).
-- create_organization ile aynı atomik desen (org_member + staff tek transaction).

create or replace function public.invite_org_member(
  p_user_id   uuid,
  p_role      public.org_role,
  p_full_name text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := public.current_org_id();
  v_member uuid;
begin
  if v_org is null then
    raise exception 'Aktif merkez bulunamadı';
  end if;
  -- DB düzeyi owner doğrulaması (admin-client baypasına güvenme).
  if public.role_in_org(v_org) <> 'owner' then
    raise exception 'Yalnız yönetici personel ekleyebilir';
  end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 then
    raise exception 'Ad soyad gerekli';
  end if;

  insert into public.org_members(org_id, user_id, role)
    values (v_org, p_user_id, p_role)
    returning id into v_member;

  insert into public.staff(org_id, member_id, full_name)
    values (v_org, v_member, trim(p_full_name));

  return v_member;
end $$;

grant execute on function public.invite_org_member(uuid, public.org_role, text)
  to authenticated;
