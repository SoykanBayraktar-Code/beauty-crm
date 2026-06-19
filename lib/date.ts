// Europe/Istanbul = sabit UTC+3 (DST yok). Makbuz numarası DB'de Istanbul'a göre
// üretiliyor (0012); finans ay-başı hesabı da aynı politikayı kullanmalı, yoksa
// ayın ilk saatlerindeki gelir yanlış aya düşer (M4).
const IST_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * İçinde bulunulan ayın Istanbul-saatiyle 1'i 00:00'ına karşılık gelen:
 *  - iso : UTC instant (timestamptz alanlarla, ör. payments.paid_at, karşılaştırma)
 *  - date: 'YYYY-MM-01' dizgesi (date alanlarla, ör. expenses.spent_on, karşılaştırma)
 * now parametresi test edilebilirlik için enjekte edilebilir.
 */
export function istanbulMonthStart(now: Date = new Date()): {
  iso: string;
  date: string;
} {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const startUtc = new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS);
  return {
    iso: startUtc.toISOString(),
    date: `${y}-${String(m + 1).padStart(2, "0")}-01`,
  };
}
