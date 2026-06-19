import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/dal";

export async function GET(request: NextRequest) {
  // Derinlemesine savunma: RLS'e ek olarak açık kimlik kontrolü.
  const membership = await getMembership();
  if (!membership) {
    return NextResponse.json({ customers: [] }, { status: 401 });
  }

  // Allowlist: PostgREST filtre sözdizimini bozabilecek tüm karakterleri ele
  // (denylist yerine yalnız harf/rakam/boşluk bırak — enjeksiyon yüzeyini kapatır).
  const q = (request.nextUrl.searchParams.get("q") ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, full_name, phone")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null)
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8);

  return NextResponse.json({ customers: data ?? [] });
}
