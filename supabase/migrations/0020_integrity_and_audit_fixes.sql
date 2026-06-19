-- 0020_integrity_and_audit_fixes.sql — M2 + M10 + M6

-- ── M2: paket-seans senkronu soft-delete edilmiş randevuyu saymasın ──
-- updateAppointmentStatus deleted_at filtrelemediğinde, silinmiş bir randevu
-- 'completed'a çekilirse bu trigger paket seansını yanlışça düşürüyordu.
-- Guard: yalnız aktif (deleted_at is null) randevular seans sayacını etkiler.
create or replace function public.sync_package_sessions()
returns trigger language plpgsql as $$
begin
  if new.customer_package_id is not null and new.deleted_at is null then
    if new.status = 'completed' and old.status <> 'completed' then
      update public.customer_packages
        set sessions_used = sessions_used + 1
        where id = new.customer_package_id;
    elsif old.status = 'completed' and new.status <> 'completed' then
      update public.customer_packages
        set sessions_used = greatest(0, sessions_used - 1)
        where id = new.customer_package_id;
    end if;
  end if;
  return new;
end $$;

-- ── M10: stok iadesi silinmiş lota yapılıp stoğu "görünmez" kılmasın ──
-- Bir usage satırı silindiğinde revert_usage_stock miktarı geri ekliyordu;
-- lot bu arada soft-delete edilmişse stok görünmez bir lota eklenip kayboluyordu.
-- Guard: yalnız aktif (deleted_at is null) lota iade yap.
create or replace function public.revert_usage_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.product_batches
    set quantity = quantity + old.quantity
    where id = old.batch_id and deleted_at is null;
  return old;
end $$;

-- ── M6: audit_log insert'ini sahteciliğe karşı sıkılaştır ──
-- Eski politika: is_org_member(org_id) → herhangi bir üye istediği actor_id ile
-- sahte denetim kaydı atabiliyordu. actor_id'yi auth.uid()'e ve org'u aktif org'a sabitle.
-- (lib/audit.ts zaten actor_id = getUser().id [auth.uid()] gönderiyor → uyumlu.)
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
  for insert with check (
    public.is_org_member(org_id)
    and org_id = public.current_org_id()
    and (actor_id = auth.uid() or actor_id is null)
  );
