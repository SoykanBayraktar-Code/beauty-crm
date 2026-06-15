"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership, getUser } from "@/lib/auth/dal";

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

  revalidatePath(`/musteriler/${customerId}`);
  return { ok: true };
}
