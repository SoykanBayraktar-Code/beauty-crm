"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";

export type CatalogState = { error?: string; ok?: boolean } | undefined;

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null, def: number) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : def;
};

export async function upsertService(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const m = await requireMembership();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Hizmet adı en az 2 karakter olmalı." };

  const payload = {
    org_id: m.org_id,
    name,
    category: clean(formData.get("category")),
    duration_min: Math.max(1, Math.round(num(formData.get("duration_min"), 30))),
    price: Math.max(0, num(formData.get("price"), 0)),
  };

  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const { error } = id
    ? await supabase.from("services").update(payload).eq("id", id)
    : await supabase.from("services").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/hizmetler");
  return { ok: true };
}

export async function upsertPackage(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const m = await requireMembership();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Paket adı en az 2 karakter olmalı." };

  const validDaysRaw = clean(formData.get("valid_days"));
  const payload = {
    org_id: m.org_id,
    name,
    service_id: clean(formData.get("service_id")),
    total_sessions: Math.max(
      1,
      Math.round(num(formData.get("total_sessions"), 1)),
    ),
    price: Math.max(0, num(formData.get("price"), 0)),
    valid_days: validDaysRaw ? Math.max(1, Math.round(Number(validDaysRaw))) : null,
  };

  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const { error } = id
    ? await supabase.from("packages").update(payload).eq("id", id)
    : await supabase.from("packages").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/hizmetler");
  return { ok: true };
}

export async function deleteCatalogItem(formData: FormData) {
  await requireMembership();
  const table = String(formData.get("table") ?? "");
  const id = clean(formData.get("id"));
  if (!id || (table !== "services" && table !== "packages")) return;
  const supabase = await createClient();
  await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/hizmetler");
}

export async function upsertProcedureType(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const m = await requireMembership();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "İşlem adı en az 2 karakter olmalı." };

  let schema: unknown = [];
  try {
    schema = JSON.parse(String(formData.get("parameter_schema") ?? "[]"));
  } catch {
    return { error: "Parametre şeması geçersiz." };
  }
  if (!Array.isArray(schema)) schema = [];

  const interval = clean(formData.get("recommended_interval_days"));
  const payload = {
    org_id: m.org_id,
    name,
    category: clean(formData.get("category")),
    is_medical: formData.get("is_medical") === "on",
    requires_consent: formData.get("requires_consent") === "on",
    parameter_schema: schema,
    default_session_count: Math.max(
      1,
      Math.round(num(formData.get("default_session_count"), 1)),
    ),
    recommended_interval_days: interval ? Math.round(Number(interval)) : null,
  };

  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const { error } = id
    ? await supabase.from("procedure_types").update(payload).eq("id", id)
    : await supabase.from("procedure_types").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/hizmetler");
  return { ok: true };
}

export async function deleteProcedureType(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("procedure_types")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  revalidatePath("/hizmetler");
}
