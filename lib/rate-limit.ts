// Basit in-memory rate limiter (sabit pencere).
// NOT: Tek-instance bellek tutar. Vercel gibi çok-instance/serverless ortamda
// her instance ayrı sayar ve cold-start'ta sıfırlanır — dağıtık üretimde
// Upstash/Redis tabanlı bir limiter'a geçilmeli. Yine de credential-stuffing /
// brute-force'a karşı anlamlı bir fren sağlar.

type Hit = { count: number; resetAt: number };

const store = new Map<string, Hit>();

/**
 * Anahtar başına `limit` isteği `windowMs` içinde kabul eder.
 * Döndürür: ok=false ise eşik aşılmıştır; retryAfterSec yeniden deneme süresidir.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hit = store.get(key);

  if (!hit || now > hit.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  hit.count += 1;
  if (hit.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((hit.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}
