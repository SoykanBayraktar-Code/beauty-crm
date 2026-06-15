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
    await supabase.from("audit_log").insert({
      org_id: membership.org_id,
      actor_id: user?.id ?? null,
      action,
      entity,
      entity_id: entityId ?? null,
      meta,
    });
  } catch {
    // sessizce geç — denetim kaydı ana işlemi engellememeli
  }
}
