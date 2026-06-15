-- 0014_access_grants.sql — Kalan güvenlik bulguları
-- F-3: klinik erişim yetkilendirme (clinical_access_grants) · F-2: tek-org değişmezliği
-- F-7: atomik ödeme kaydı (makbuz no + insert tek transaction)

-- ════════════════════════════════════════════════════════════════════
-- F-3 · Klinik erişim yetkilendirme
-- İstek: "Uzman kendi (randevulu) hastasını görür; yetkili yetki açarsa
-- başka uzmanın hastasını da görebilir." → açık, süreli, iptal edilebilir grant.
-- ════════════════════════════════════════════════════════════════════
create table public.clinical_access_grants (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  grantee_id  uuid not null references public.org_members(id) on delete cascade, -- erişim verilen üye
  granted_by  uuid references auth.users(id) on delete set null,
  reason      text,
  expires_at  timestamptz,   -- null = süresiz
  revoked_at  timestamptz,   -- iptal edildi
  created_at  timestamptz not null default now()
);
create index cag_customer_idx
  on public.clinical_access_grants(customer_id) where revoked_at is null;
create index cag_grantee_idx
  on public.clinical_access_grants(grantee_id) where revoked_at is null;

alter table public.clinical_access_grants enable row level security;

-- Owner tüm org grant'larını yönetir; üye kendi grant'larını görebilir.
create policy cag_select on public.clinical_access_grants
  for select using (
    public.role_in_org(org_id) = 'owner'
    or exists (
      select 1 from public.org_members m
      where m.id = grantee_id and m.user_id = auth.uid()
    )
  );
create policy cag_write on public.clinical_access_grants
  for all using (public.role_in_org(org_id) = 'owner')
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) = 'owner'
  );

-- can_access_clinical'a grant dalı ekle: owner | randevulu uzman | aktif-grant'lı üye
create or replace function public.can_access_clinical(target_customer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.customers c
    join public.org_members m
      on m.org_id = c.org_id and m.user_id = auth.uid() and m.deleted_at is null
    where c.id = target_customer
      and (
        m.role = 'owner'
        or (
          m.role = 'specialist'
          and exists (
            select 1
            from public.appointments a
            join public.staff s on s.id = a.staff_id
            where a.customer_id = target_customer
              and s.member_id = m.id
              and a.deleted_at is null
          )
        )
        or exists (
          select 1
          from public.clinical_access_grants g
          where g.customer_id = target_customer
            and g.grantee_id = m.id
            and g.revoked_at is null
            and (g.expires_at is null or g.expires_at > now())
        )
      )
  );
$$;

-- ════════════════════════════════════════════════════════════════════
-- F-2 · Tek-org değişmezliğini DB düzeyinde zorla
-- current_org_id()/getMembership() tek üyelik varsayıyor → bir kullanıcı en fazla
-- BİR aktif merkeze üye olabilir. Çok-org açılınca (JWT claim ile) bu index düşürülür.
-- ════════════════════════════════════════════════════════════════════
create unique index org_members_one_active_membership
  on public.org_members(user_id) where deleted_at is null;

-- ════════════════════════════════════════════════════════════════════
-- F-7 · Atomik ödeme kaydı (makbuz no + satırlar tek transaction)
-- Insert başarısızsa next_receipt_no()'nun sayaç artışı da geri alınır → numara boşluğu olmaz.
-- SECURITY INVOKER → payments RLS (owner/reception) uygulanır.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.record_payment(
  p_customer_id uuid,
  p_type        text,
  p_note        text,
  p_lines       jsonb
) returns text language plpgsql security invoker set search_path = public as $$
declare
  v_org     uuid := public.current_org_id();
  v_receipt text;
  v_line    jsonb;
begin
  if v_org is null then raise exception 'Aktif merkez bulunamadı'; end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'En az bir ödeme satırı gerekli';
  end if;

  v_receipt := public.next_receipt_no();

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into public.payments
      (org_id, customer_id, receipt_no, amount, method, type, note, created_by)
    values (
      v_org,
      p_customer_id,
      v_receipt,
      (v_line->>'amount')::numeric,
      (v_line->>'method')::public.payment_method,
      coalesce(nullif(p_type, ''), 'service'),
      p_note,
      auth.uid()
    );
  end loop;

  return v_receipt;
end $$;
grant execute on function public.record_payment(uuid, text, text, jsonb) to authenticated;
