export type ExpiryStatus = "expired" | "soon" | "ok" | null;

/** SKT durumu: geçmiş / 30 gün içinde / uzak / tarihsiz. Sunucuda hesaplanır. */
export function expiryStatus(expiry: string | null): ExpiryStatus {
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${expiry}T00:00:00`);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}

export const EXPIRY_LABEL: Record<"expired" | "soon", string> = {
  expired: "SKT geçti",
  soon: "SKT yaklaşıyor",
};
