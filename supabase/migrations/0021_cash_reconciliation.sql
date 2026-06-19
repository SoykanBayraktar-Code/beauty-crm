-- 0021_cash_reconciliation.sql — M12: kasa kapanış mutabakatını kalıcılaştır
-- Kapanışta beklenen tutar (açılış + oturum nakit satışı) hiçbir yere yazılmıyordu;
-- yalnız sayılan (counted_amount) tutuluyordu → geçmiş mutabakat (sapma) denetlenemiyordu.
-- expected_amount snapshot'ı eklenir; sapma = counted_amount - expected_amount türetilebilir.
alter table public.cash_sessions
  add column if not exists expected_amount numeric(12, 2);
