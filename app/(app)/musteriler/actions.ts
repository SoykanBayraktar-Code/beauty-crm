"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership, getUser } from "@/lib/auth/dal";
import { logAudit } from "@/lib/audit";
import { MAX_PHOTO_BYTES, PHOTO_MIME, SNIFF_MIME, sniffImage } from "@/lib/image";

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
  await requireMembership(); // yetki kapısı (org/created_by RPC içinde auth.uid()'den)
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
  // F-7: makbuz no üretimi + satır insert'leri TEK transaction (atomik).
  // Insert başarısızsa sayaç artışı da geri alınır → makbuz numarası boşluğu olmaz.
  const { data: receiptNo, error } = await supabase.rpc("record_payment", {
    p_customer_id: customerId,
    p_type: type,
    p_note: note,
    p_lines: entries,
  });
  if (error || !receiptNo) {
    return { error: error?.message ?? "Ödeme kaydedilemedi." };
  }

  const total = entries.reduce((s, e) => s + e.amount, 0);
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
  await requireMembership();
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

  // Kullanılan sarf malzeme + lot satırlarını topla.
  const usage: { product_id: string; batch_id: string; quantity: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const productId = clean(formData.get(`usage_product_${i}`));
    const batchId = clean(formData.get(`usage_batch_${i}`));
    const q = Number(String(formData.get(`usage_qty_${i}`) ?? "").replace(",", "."));
    if (productId && batchId && Number.isFinite(q) && q > 0) {
      usage.push({ product_id: productId, batch_id: batchId, quantity: q });
    }
  }

  // H2: klinik kayıt + stok kullanımı TEK transaction (record_treatment RPC).
  // usage patlarsa (örn. yetersiz stok) treatment_records insert'i de geri alınır
  // → stoktan düşmemiş "fantom" SOAP kaydı oluşmaz.
  const { data: recordId, error } = await supabase.rpc("record_treatment", {
    p_customer_id: customerId,
    p_procedure_type_id: procedureTypeId,
    p_staff_id: clean(formData.get("staff_id")),
    p_area: clean(formData.get("area")),
    p_soap: {
      subjective: clean(formData.get("soap_subjective")),
      objective: clean(formData.get("soap_objective")),
      assessment: clean(formData.get("soap_assessment")),
      plan: clean(formData.get("soap_plan")),
    },
    p_parameters: parameters,
    p_usage: usage,
  });
  if (error || !recordId) return { error: error?.message ?? "Kayıt başarısız." };

  await logAudit("treatment.create", "customer", customerId, {
    procedure_type_id: procedureTypeId,
    products: usage.length,
  });
  revalidatePath(`/musteriler/${customerId}`);
  revalidatePath("/stok");
  return { ok: true };
}

const PHOTO_BUCKET = "treatment-photos";

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

// F-3: Klinik erişim yetkilendirme — yalnız yönetici, bir uzmana bir hastanın
// klinik kaydına erişim açar (randevu dışı). RLS de owner-only zorlar (savunma katmanı).
export async function grantClinicalAccess(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  if (m.role !== "owner")
    return { error: "Yalnız yönetici klinik erişim yetkisi açabilir." };
  const user = await getUser();
  const customerId = clean(formData.get("customer_id"));
  const granteeId = clean(formData.get("grantee_id"));
  if (!customerId || !granteeId) return { error: "Hasta ve uzman gerekli." };

  const daysRaw = clean(formData.get("expires_days"));
  const days = daysRaw ? Math.max(1, Math.round(Number(daysRaw))) : null;
  const expiresAt =
    days && Number.isFinite(days)
      ? new Date(Date.now() + days * 86400000).toISOString()
      : null;

  const supabase = await createClient();
  const { error } = await supabase.from("clinical_access_grants").insert({
    org_id: m.org_id,
    customer_id: customerId,
    grantee_id: granteeId,
    granted_by: user?.id ?? null,
    reason: clean(formData.get("reason")),
    expires_at: expiresAt,
  });
  if (error) return { error: error.message };

  await logAudit("clinical_access.grant", "customer", customerId, {
    grantee_id: granteeId,
    expires_at: expiresAt,
  });
  revalidatePath(`/musteriler/${customerId}`);
  return { ok: true };
}

// ── KVKK veri-sahibi araçları (owner-only) ──

/** Unutulma hakkı (yumuşak): kimlik bilgilerini siler, klinik/finans kaydı yasal
 *  saklama için kalır ama kişi tanımlanamaz hale gelir. */
export async function anonymizeCustomer(
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  if (m.role !== "owner") return { error: "Yalnız yönetici yapabilir." };
  const id = clean(formData.get("id"));
  if (!id) return { error: "Müşteri gerekli." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      full_name: "Anonimleştirilmiş Müşteri",
      phone: null,
      email: null,
      birth_date: null,
      gender: null,
      source: null,
      tags: [],
      notes: "[KVKK kapsamında anonimleştirildi]",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  // Serbest-metin PII içeren notları maskele
  const { error: nErr } = await supabase
    .from("customer_notes")
    .update({ body: "[anonimleştirildi]" })
    .eq("customer_id", id);
  if (nErr) return { error: nErr.message };

  await logAudit("customer.anonymize", "customer", id, {});
  revalidatePath("/musteriler");
  revalidatePath(`/musteriler/${id}`);
  return { ok: true };
}

/** Unutulma hakkı (tam): müşteriyi ve tüm ilişkili kayıtları kalıcı siler (cascade) +
 *  Storage fotoğraflarını kaldırır. Geri alınamaz. */
export async function deleteCustomerPermanently(
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  if (m.role !== "owner") return { error: "Yalnız yönetici yapabilir." };
  const id = clean(formData.get("id"));
  if (!id) return { error: "Müşteri gerekli." };

  const supabase = await createClient();
  // Storage fotoğraf yollarını sil (cascade DB satırını siler ama dosyayı silmez)
  const { data: photos } = await supabase
    .from("treatment_photos")
    .select("storage_path")
    .eq("customer_id", id);
  const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: rmErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(paths);
    // M5/KVKK: dosyalar silinemezse cascade DB silmeyi YAPMA — aksi halde
    // silinmesi gereken kişisel-veri fotoğrafları yetim kalır (KVKK ihlali).
    if (rmErr) {
      await logAudit("customer.delete_permanent_failed", "customer", id, {
        error: rmErr.message,
        photos: paths.length,
      });
      return {
        error: `Fotoğraflar silinemedi (${rmErr.message}). İşlem durduruldu, tekrar deneyin.`,
      };
    }
  }

  // Audit'i silmeden ÖNCE yaz (entity_id sonra kalır)
  await logAudit("customer.delete_permanent", "customer", id, {
    photos: paths.length,
  });

  const { error: delErr } = await supabase
    .from("customers")
    .delete()
    .eq("id", id); // cascade tüm ilişkili kayıtlar
  if (delErr) {
    await logAudit("customer.delete_permanent_failed", "customer", id, {
      error: delErr.message,
    });
    return { error: delErr.message };
  }
  revalidatePath("/musteriler");
  return { ok: true };
}

// ── Kaydedilmiş segmentler (gelişmiş filtre) ──
export async function saveSegment(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const m = await requireMembership();
  const user = await getUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Segment adı en az 2 karakter olmalı." };

  let criteria: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(formData.get("criteria") ?? "{}"));
    if (parsed && typeof parsed === "object") criteria = parsed;
  } catch {
    return { error: "Filtre kriteri okunamadı." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("segments").insert({
    org_id: m.org_id,
    name,
    criteria,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  await logAudit("segment.save", "segment", null, { name });
  revalidatePath("/musteriler");
  return { ok: true };
}

export async function deleteSegment(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("segments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/musteriler");
}

export async function revokeClinicalAccess(formData: FormData) {
  const m = await requireMembership();
  if (m.role !== "owner") return;
  const id = clean(formData.get("id"));
  const customerId = clean(formData.get("customer_id"));
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinical_access_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return;

  await logAudit("clinical_access.revoke", "customer", customerId, {});
  if (customerId) revalidatePath(`/musteriler/${customerId}`);
}
