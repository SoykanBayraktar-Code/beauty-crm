import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/types";

export type Membership = {
  org_id: string;
  role: OrgRole;
  organizations: { name: string } | null;
};

/** Doğrulanmış kullanıcı (yoksa null). React cache ile istek başına tek sorgu. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Kullanıcının aktif merkez üyeliği + rolü (RLS ile korunur). */
export const getMembership = cache(async (): Promise<Membership | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  // KRİTİK: members_select RLS org-kapsamlı (kullanıcı-kapsamlı DEĞİL) → org'daki
  // TÜM üyeleri döndürür. user_id filtresi olmadan limit(1) BAŞKA bir üyenin rolünü
  // verebilir (yetki kararı bozulması). Mutlaka kendi satırımıza bağla + deterministik sırala.
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(name)")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as Membership | null) ?? null;
});

/** Korumalı sunucu kodu: girişsizse /login'e yönlendir. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Korumalı app kodu: üyelik yoksa /setup'a yönlendir. */
export async function requireMembership(): Promise<Membership> {
  await requireUser();
  const membership = await getMembership();
  if (!membership) redirect("/setup");
  return membership;
}
