import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
