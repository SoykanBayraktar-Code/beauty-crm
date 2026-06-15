"use server";

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
  const { error } = id
    ? await supabase.from("customers").update(payload).eq("id", id)
    : await supabase.from("customers").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/musteriler");
  if (id) revalidatePath(`/musteriler/${id}`);
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
  await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
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

  const rows: {
    org_id: string;
    customer_id: string;
    receipt_no: string;
    amount: number;
    method: string;
    type: string;
    note: string | null;
    created_by: string | null;
  }[] = [];

  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const receiptNo = `MKB-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;

  for (let i = 0; i < 3; i++) {
    const amount = Number(String(formData.get(`amount_${i}`) ?? "").replace(",", "."));
    const method = clean(formData.get(`method_${i}`));
    if (method && Number.isFinite(amount) && amount > 0) {
      rows.push({
        org_id: m.org_id,
        customer_id: customerId,
        receipt_no: receiptNo,
        amount: Math.round(amount * 100) / 100,
        method,
        type,
        note,
        created_by: user?.id ?? null,
      });
    }
  }

  if (rows.length === 0) return { error: "En az bir ödeme satırı girin." };

  const supabase = await createClient();
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

  const { error } = await supabase.from("treatment_records").insert({
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
  });
  if (error) return { error: error.message };

  await logAudit("treatment.create", "customer", customerId, {
    procedure_type_id: procedureTypeId,
  });
  revalidatePath(`/musteriler/${customerId}`);
  return { ok: true };
}
