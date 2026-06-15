import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "")
    .replace(/[,()]/g, "")
    .trim();
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, full_name, phone")
    .is("deleted_at", null)
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8);

  return NextResponse.json({ customers: data ?? [] });
}
