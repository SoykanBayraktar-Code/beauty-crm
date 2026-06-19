-- 0017_rls_symmetry.sql — M3: Faz-1 yazma politikalarına org bağlaması
-- Faz-1 tabloları (customers/appointments/payments/consents...) yalnız
-- role_in_org(org_id) kontrol ediyordu; cross-tenant yazma koruması tek bir
-- unique index'e (org_members_one_active_membership) bağlıydı. Faz-2 tabloları
-- gibi WITH CHECK'e org_id = current_org_id() ekleyerek simetrik/dayanıklı yap.
-- Çok-org (JWT claim) açıldığında o index düşürülse bile cross-tenant yazma kapalı kalır.

-- ── customers ──
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update using (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  )
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );

-- ── customer_notes ──
drop policy if exists customer_notes_write on public.customer_notes;
create policy customer_notes_write on public.customer_notes
  for all using (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  )
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );

-- ── customer_packages ──
drop policy if exists cust_pkg_write on public.customer_packages;
create policy cust_pkg_write on public.customer_packages
  for all using (public.role_in_org(org_id) in ('owner', 'reception'))
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception')
  );

-- ── appointments ──
drop policy if exists appt_write on public.appointments;
create policy appt_write on public.appointments
  for all using (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  )
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );

-- ── payments ──
-- NOT: record_payment org_id := current_org_id() ile yazıyor → uyumlu.
drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments
  for all using (public.role_in_org(org_id) in ('owner', 'reception'))
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception')
  );

-- ── consent_templates ──
drop policy if exists consent_tpl_write on public.consent_templates;
create policy consent_tpl_write on public.consent_templates
  for all using (public.role_in_org(org_id) = 'owner')
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) = 'owner'
  );

-- ── customer_consents ──
drop policy if exists cust_consent_write on public.customer_consents;
create policy cust_consent_write on public.customer_consents
  for all using (
    public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  )
  with check (
    org_id = public.current_org_id()
    and public.role_in_org(org_id) in ('owner', 'reception', 'specialist')
  );
