"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";

export type StockState = { error?: string; ok?: boolean } | undefined;

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null, def: number) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : def;
};
const numOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export async function upsertSupplier(
  _prev: StockState,
  formData: FormData,
): Promise<StockState> {
  const m = await requireMembership();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Tedarikçi adı en az 2 karakter olmalı." };

  const payload = {
    org_id: m.org_id,
    name,
    phone: clean(formData.get("phone")),
    email: clean(formData.get("email")),
    notes: clean(formData.get("notes")),
  };

  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const { error } = id
    ? await supabase.from("suppliers").update(payload).eq("id", id)
    : await supabase.from("suppliers").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/stok");
  return { ok: true };
}

export async function deleteSupplier(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[deleteSupplier] silme hatası:", error.message);
  revalidatePath("/stok");
}

export async function upsertProduct(
  _prev: StockState,
  formData: FormData,
): Promise<StockState> {
  const m = await requireMembership();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Ürün adı en az 2 karakter olmalı." };

  const category = clean(formData.get("category")) ?? "consumable";
  const payload = {
    org_id: m.org_id,
    name,
    sku: clean(formData.get("sku")),
    category: category === "retail" ? "retail" : "consumable",
    unit: clean(formData.get("unit")) ?? "adet",
    supplier_id: clean(formData.get("supplier_id")),
    reorder_level: Math.max(0, num(formData.get("reorder_level"), 0)),
    sale_price: numOrNull(formData.get("sale_price")),
    notes: clean(formData.get("notes")),
  };

  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const { error } = id
    ? await supabase.from("products").update(payload).eq("id", id)
    : await supabase.from("products").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/stok");
  return { ok: true };
}

export async function deleteProduct(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[deleteProduct] silme hatası:", error.message);
  revalidatePath("/stok");
}

export async function addBatch(
  _prev: StockState,
  formData: FormData,
): Promise<StockState> {
  const m = await requireMembership();
  const productId = clean(formData.get("product_id"));
  if (!productId) return { error: "Ürün gerekli." };

  const quantity = Math.max(0, num(formData.get("quantity"), 0));
  if (quantity <= 0) return { error: "Miktar 0'dan büyük olmalı." };

  const payload = {
    org_id: m.org_id,
    product_id: productId,
    batch_no: clean(formData.get("batch_no")),
    expiry_date: clean(formData.get("expiry_date")),
    quantity,
    unit_cost: numOrNull(formData.get("unit_cost")),
    received_at: clean(formData.get("received_at")) ?? undefined,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("product_batches").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/stok");
  return { ok: true };
}

export async function deleteBatch(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_batches")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[deleteBatch] silme hatası:", error.message);
  revalidatePath("/stok");
}
