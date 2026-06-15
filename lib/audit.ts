import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMembership, getUser } from "@/lib/auth/dal";

/** Hassas işlemleri denetim kaydına yazar. Asla ana işlemi bozmaz. */
export async function logAudit(
  action: string,
  entity: string,
  entityId?: string | null,
  meta: Record<string, unknown> = {},
) {
  try {
    const membership = await getMembership();
    if (!membership) return;
    const user = await getUser();
    const supabase = await createClient();
    const { error } = await supabase.from("audit_log").insert({
      org_id: membership.org_id,
      actor_id: user?.id ?? null,
      action,
      entity,
      entity_id: entityId ?? null,
      meta,
    });
    // Hata ana işlemi bozmamalı, ama gözlemlenebilir olmalı ("sessiz boşluk" değil).
    if (error) console.error(`[audit] insert failed (${action}):`, error.message);
  } catch (e) {
    console.error(`[audit] unexpected failure (${action}):`, e);
  }
}
