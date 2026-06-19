import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/dal";

/**
 * KVKK erişim talebi: bir müşteriye ait tüm verinin dışa aktarımı (JSON indirme).
 * Yalnız yönetici (owner). RLS de erişimi kısıtlar (owner tüm klinik veriyi görür).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const membership = await getMembership();
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const { id } = await params;
  const supabase = await createClient();

  // Savunma derinliği: RLS'e ek olarak org sahipliğini kod düzeyinde de doğrula.
  // Müşteri çağıranın org'una ait değilse 404 (IDOR koruması).
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("org_id", membership.org_id)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  const [
    { data: notes },
    { data: appointments },
    { data: payments },
    { data: anamnesis },
    { data: treatments },
    { data: photos },
    { data: consents },
    { data: packages },
  ] = await Promise.all([
    supabase.from("customer_notes").select("*").eq("customer_id", id),
    supabase
      .from("appointments")
      .select("*, services(name), staff(full_name)")
      .eq("customer_id", id),
    supabase.from("payments").select("*").eq("customer_id", id),
    supabase
      .from("customer_anamnesis")
      .select("*")
      .eq("customer_id", id)
      .order("version", { ascending: true }),
    supabase
      .from("treatment_records")
      .select("*, procedure_types(name), treatment_product_usage(*)")
      .eq("customer_id", id),
    supabase
      .from("treatment_photos")
      .select("id, kind, storage_path, caption, taken_at")
      .eq("customer_id", id)
      .is("deleted_at", null),
    supabase.from("customer_consents").select("*").eq("customer_id", id),
    supabase.from("customer_packages").select("*").eq("customer_id", id),
  ]);

  // Foto erişimi için imzalı URL (1 saat)
  let photoExport = photos ?? [];
  const paths = (photos ?? []).map((p) => p.storage_path);
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from("treatment-photos")
      .createSignedUrls(paths, 3600);
    const urlByPath = new Map(
      (signed ?? []).map((s) => [s.path, s.signedUrl]),
    );
    photoExport = (photos ?? []).map((p) => ({
      ...p,
      signed_url: urlByPath.get(p.storage_path) ?? null,
    }));
  }

  const payload = {
    exported_at: new Date().toISOString(),
    kvkk_note:
      "Bu dosya KVKK erişim/taşınabilirlik talebi kapsamında üretilmiştir.",
    customer,
    notes: notes ?? [],
    appointments: appointments ?? [],
    payments: payments ?? [],
    anamnesis: anamnesis ?? [],
    treatments: treatments ?? [],
    photos: photoExport,
    consents: consents ?? [],
    packages: packages ?? [],
  };

  // Content-Disposition ASCII olmalı → Türkçe karakterleri ASCII'ye indir
  const safeName =
    String(customer.full_name ?? "musteri")
      .replace(/[şŞ]/g, "s")
      .replace(/[çÇ]/g, "c")
      .replace(/[ğĞ]/g, "g")
      .replace(/[üÜ]/g, "u")
      .replace(/[öÖ]/g, "o")
      .replace(/[ıİ]/g, "i")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "musteri";
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kvkk_${safeName}_${id.slice(0, 8)}.json"`,
    },
  });
}
