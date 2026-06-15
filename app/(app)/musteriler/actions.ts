"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership, getUser } from "@/lib/auth/dal";
import { logAudit } from "@/lib/audit";

const customerSchema = z.object({
  full_name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı."),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Geçersiz e-posta.")
    .optional()
    .or(z.literal("")),
  birth_date: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(["female", "male", "other"]).optional().or(z.literal("")),
  source: z.string().trim().optional().or(z.literal("")),
  tags: z.string().optional(),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type CustomerState = { error?: string; ok?: boolean } | undefined;

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

export async function upsertCustomer(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const membership = await requireMembership();

  const parsed = customerSchema.safeParse({
    full_name: formData.get("full_name") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    birth_date: formData.get("birth_date") ?? "",
    gender: formData.get("gender") ?? "",
    source: formData.get("source") ?? "",
    tags: formData.get("tags") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const payload = {
    org_id: membership.org_id,
    full_name: parsed.data.full_name,
    phone: clean(formData.get("phone")),
    email: clean(formData.get("email")),
    birth_date: clean(formData.get("birth_date")),
    gender: clean(formData.get("gender")),
    source: clean(formData.get("source")),
    tags,
    notes: clean(formData.get("notes")),
  };

  const supabase = await createClient();
  const id = clean(formData.get("id"));
  let savedId = id;
  if (id) {
    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { error: error.message };
    savedId = data?.id ?? null;
  }

  await logAudit(id ? "customer.update" : "customer.create", "customer", savedId, {
    full_name: parsed.data.full_name,
  });
  revalidatePath("/musteriler");
  if (savedId) revalidatePath(`/musteriler/${savedId}`);
  return { ok: true };
}

export async function addCustomerNote(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const membership = await requireMembership();
  const user = await getUser();
  const customerId = clean(formData.get("customer_id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!customerId || !body) return { error: "Not boş olamaz." };

  const supabase = await createClient();
  const { error } = await supabase.from("customer_notes").insert({
    org_id: membership.org_id,
    customer_id: customerId,
    author_id: user?.id ?? null,
    body,
  });
  if (error) return { error: error.message };

  revalidatePath(`/musteriler/${customerId}`);
  return { ok: true };
}

export async function deleteCustomer(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return;
  await logAudit("customer.delete", "customer", id, {});
  revalidatePath("/musteriler");
}

export async function sellPackage(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  const customerId = clean(formData.get("customer_id"));
  const packageId = clean(formData.get("package_id"));
  if (!customerId || !packageId) return { error: "Müşteri ve paket gerekli." };

  const supabase = await createClient();
  const { data: pkg } = await supabase
    .from("packages")
    .select("name, total_sessions, price, valid_days, service_id")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg) return { error: "Paket bulunamadı." };

  const expiresAt = pkg.valid_days
    ? new Date(Date.now() + pkg.valid_days * 86400000).toISOString()
    : null;

  const { error } = await supabase.from("customer_packages").insert({
    org_id: m.org_id,
    customer_id: customerId,
    package_id: packageId,
    service_id: pkg.service_id,
    name: pkg.name,
    sessions_total: pkg.total_sessions,
    price_paid: pkg.price,
    expires_at: expiresAt,
  });
  if (error) return { error: error.message };

  await logAudit("package.sell", "customer", customerId, { package: pkg.name });
  revalidatePath(`/musteriler/${customerId}`);
  return { ok: true };
}

export async function takePayment(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  const user = await getUser();
  const customerId = clean(formData.get("customer_id"));
  if (!customerId) return { error: "Müşteri gerekli." };

  const type = clean(formData.get("type")) ?? "service";
  const note = clean(formData.get("note"));

  // Geçerli ödeme satırlarını topla (numara üretmeden önce — boş gönderim sayacı tüketmesin)
  const entries: { amount: number; method: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const amount = Number(String(formData.get(`amount_${i}`) ?? "").replace(",", "."));
    const method = clean(formData.get(`method_${i}`));
    if (method && Number.isFinite(amount) && amount > 0) {
      entries.push({ amount: Math.round(amount * 100) / 100, method });
    }
  }
  if (entries.length === 0) return { error: "En az bir ödeme satırı girin." };

  const supabase = await createClient();
  // Çakışmasız atomik makbuz numarası (org+gün sıralı) — bkz. 0012_receipt_counter
  const { data: receiptNo, error: rcptErr } = await supabase.rpc(
    "next_receipt_no",
  );
  if (rcptErr || !receiptNo) {
    return { error: rcptErr?.message ?? "Makbuz numarası üretilemedi." };
  }

  const rows = entries.map((e) => ({
    org_id: m.org_id,
    customer_id: customerId,
    receipt_no: receiptNo,
    amount: e.amount,
    method: e.method,
    type,
    note,
    created_by: user?.id ?? null,
  }));

  const { error } = await supabase.from("payments").insert(rows);
  if (error) return { error: error.message };

  const total = rows.reduce((s, r) => s + r.amount, 0);
  await logAudit("payment.take", "customer", customerId, {
    receipt_no: receiptNo,
    total,
  });
  revalidatePath(`/musteriler/${customerId}`);
  return { ok: true };
}

export async function grantConsent(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  const user = await getUser();
  const customerId = clean(formData.get("customer_id"));
  const templateId = clean(formData.get("template_id"));
  if (!customerId || !templateId)
    return { error: "Müşteri ve onam metni gerekli." };

  const supabase = await createClient();
  const { data: tpl } = await supabase
    .from("consent_templates")
    .select("name, body, version")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) return { error: "Onam metni bulunamadı." };

  const { error } = await supabase.from("customer_consents").insert({
    org_id: m.org_id,
    customer_id: customerId,
    template_id: templateId,
    title: tpl.name,
    version: tpl.version,
    body_snapshot: tpl.body,
    granted_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await logAudit("consent.grant", "customer", customerId, { title: tpl.name });
  revalidatePath(`/musteriler/${customerId}`);
  return { ok: true };
}

export async function upsertAnamnesis(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  const user = await getUser();
  const customerId = clean(formData.get("customer_id"));
  if (!customerId) return { error: "Müşteri gerekli." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("customer_anamnesis")
    .select("version")
    .eq("customer_id", customerId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (last?.version ?? 0) + 1;

  const fitz = clean(formData.get("fitzpatrick"));
  const { error } = await supabase.from("customer_anamnesis").insert({
    org_id: m.org_id,
    customer_id: customerId,
    version,
    allergies: clean(formData.get("allergies")),
    chronic_conditions: clean(formData.get("chronic_conditions")),
    medications: clean(formData.get("medications")),
    pregnancy: formData.get("pregnancy") === "on",
    fitzpatrick: fitz,
    skin_type: clean(formData.get("skin_type")),
    contraindications: clean(formData.get("contraindications")),
    notes: clean(formData.get("notes")),
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await logAudit("anamnesis.update", "customer", customerId, { version });
  revalidatePath(`/musteriler/${customerId}`);
  return { ok: true };
}

export async function createTreatmentRecord(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  const user = await getUser();
  const customerId = clean(formData.get("customer_id"));
  if (!customerId) return { error: "Müşteri gerekli." };

  const supabase = await createClient();
  const procedureTypeId = clean(formData.get("procedure_type_id"));

  const parameters: Record<string, string> = {};
  if (procedureTypeId) {
    const { data: pt } = await supabase
      .from("procedure_types")
      .select("parameter_schema")
      .eq("id", procedureTypeId)
      .maybeSingle();
    const schema = Array.isArray(pt?.parameter_schema)
      ? (pt!.parameter_schema as { key: string }[])
      : [];
    for (const f of schema) {
      const v = clean(formData.get(`param_${f.key}`));
      if (v) parameters[f.key] = v;
    }
  }

  const { data: record, error } = await supabase
    .from("treatment_records")
    .insert({
      org_id: m.org_id,
      customer_id: customerId,
      procedure_type_id: procedureTypeId,
      staff_id: clean(formData.get("staff_id")),
      area: clean(formData.get("area")),
      soap_subjective: clean(formData.get("soap_subjective")),
      soap_objective: clean(formData.get("soap_objective")),
      soap_assessment: clean(formData.get("soap_assessment")),
      soap_plan: clean(formData.get("soap_plan")),
      parameters,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !record) return { error: error?.message ?? "Kayıt başarısız." };

  // Kullanılan sarf malzeme + lot → tetikleyici stok düşer (lot izlenebilirliği)
  const usageRows: {
    org_id: string;
    treatment_record_id: string;
    product_id: string;
    batch_id: string;
    quantity: number;
    created_by: string | null;
  }[] = [];
  for (let i = 0; i < 6; i++) {
    const productId = clean(formData.get(`usage_product_${i}`));
    const batchId = clean(formData.get(`usage_batch_${i}`));
    const q = Number(String(formData.get(`usage_qty_${i}`) ?? "").replace(",", "."));
    if (productId && batchId && Number.isFinite(q) && q > 0) {
      usageRows.push({
        org_id: m.org_id,
        treatment_record_id: record.id,
        product_id: productId,
        batch_id: batchId,
        quantity: q,
        created_by: user?.id ?? null,
      });
    }
  }

  if (usageRows.length > 0) {
    const { error: usageErr } = await supabase
      .from("treatment_product_usage")
      .insert(usageRows);
    if (usageErr) {
      // Stok düşümü başarısızsa (örn. lotta yeterli yok) kaydı geri al
      await supabase
        .from("treatment_records")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", record.id);
      return { error: usageErr.message };
    }
  }

  await logAudit("treatment.create", "customer", customerId, {
    procedure_type_id: procedureTypeId,
    products: usageRows.length,
  });
  revalidatePath(`/musteriler/${customerId}`);
  revalidatePath("/stok");
  return { ok: true };
}

const PHOTO_BUCKET = "treatment-photos";
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const SNIFF_MIME: Record<"jpg" | "png" | "webp", string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Client'ın bildirdiği MIME sahteci olabilir → gerçek baytlardan tür çıkar. */
function sniffImage(b: Uint8Array): "jpg" | "png" | "webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "jpg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  )
    return "png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  )
    return "webp";
  return null;
}

export async function uploadTreatmentPhoto(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  const user = await getUser();
  const customerId = clean(formData.get("customer_id"));
  if (!customerId) return { error: "Müşteri gerekli." };

  const kind = clean(formData.get("kind"));
  if (kind !== "before" && kind !== "after")
    return { error: "Foto türü geçersiz." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Dosya seçin." };
  if (file.size > MAX_PHOTO_BYTES)
    return { error: "Dosya 10MB'tan büyük olamaz." };
  if (!PHOTO_MIME[file.type])
    return { error: "Yalnız JPEG, PNG veya WebP yüklenebilir." };

  // İçeriği gerçek baytlardan doğrula (bildirilen MIME'ye güvenme) — uzantı sniff'ten gelir.
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ext = sniffImage(head);
  if (!ext)
    return { error: "Dosya geçerli bir JPEG/PNG/WebP görseli değil." };

  const supabase = await createClient();

  // KVKK: onam alınmamışsa foto yüklenemez (Faz 1.5 onam kontrolü)
  const { count } = await supabase
    .from("customer_consents")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);
  if (!count)
    return {
      error: "Foto yüklemek için önce müşteriden onam alınmalı (Onam sekmesi).",
    };

  const path = `${m.org_id}/${customerId}/${randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: SNIFF_MIME[ext], upsert: false });
  if (upErr) return { error: upErr.message };

  const { error } = await supabase.from("treatment_photos").insert({
    org_id: m.org_id,
    customer_id: customerId,
    treatment_record_id: clean(formData.get("treatment_record_id")),
    kind,
    storage_path: path,
    caption: clean(formData.get("caption")),
    created_by: user?.id ?? null,
  });
  if (error) {
    // Meta kaydı başarısızsa yüklenen dosyayı geri al (yetim dosya bırakma)
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { error: error.message };
  }

  await logAudit("photo.upload", "customer", customerId, { kind });
  revalidatePath(`/musteriler/${customerId}`);
  return { ok: true };
}

export async function deleteTreatmentPhoto(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  const customerId = clean(formData.get("customer_id"));
  const path = clean(formData.get("storage_path"));
  if (!id || !customerId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("treatment_photos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return;

  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  await logAudit("photo.delete", "customer", customerId, {});
  revalidatePath(`/musteriler/${customerId}`);
}
