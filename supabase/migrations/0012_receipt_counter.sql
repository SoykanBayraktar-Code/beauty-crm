-- 0012_receipt_counter.sql — Çakışmasız atomik makbuz numarası (org+gün sıralı)
-- Not: payments.receipt_no'ya unique kısıt KONMAZ — bölünmüş ödemede bir makbuz
-- birden çok satırda aynı numarayı kasıtlı paylaşır. Tekillik sayaçta sağlanır.

create table public.receipt_counters (
  org_id uuid not null references public.organizations(id) on delete cascade,
  day    date not null,
  seq    integer not null default 0,
  primary key (org_id, day)
);

-- Yalnız SECURITY DEFINER fonksiyon erişir; doğrudan istemci erişimi yok.
alter table public.receipt_counters enable row level security;

-- Aktif merkez için günlük sıralı makbuz no üretir (atomik upsert → yarış-güvenli).
create or replace function public.next_receipt_no()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_day date := (now() at time zone 'Europe/Istanbul')::date;
  v_seq integer;
begin
  if v_org is null then
    raise exception 'Aktif merkez bulunamadı';
  end if;

  insert into public.receipt_counters (org_id, day, seq)
    values (v_org, v_day, 1)
  on conflict (org_id, day)
    do update set seq = public.receipt_counters.seq + 1
  returning seq into v_seq;

  return 'MKB-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

grant execute on function public.next_receipt_no() to authenticated;
