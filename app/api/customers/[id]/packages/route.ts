import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/dal";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Derinlemesine savunma: RLS'e ek olarak açık kimlik kontrolü.
  const membership = await getMembership();
  if (!membership) {
    return NextResponse.json({ packages: [] }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_packages")
    .select("id, name, sessions_total, sessions_used")
    .eq("customer_id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("purchased_at", { ascending: false });

  const packages = (data ?? []).filter(
    (p) => p.sessions_used < p.sessions_total,
  );
  return NextResponse.json({ packages });
}
