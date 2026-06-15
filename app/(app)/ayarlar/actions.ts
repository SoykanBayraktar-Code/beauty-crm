"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";

export type SettingsState = { error?: string; ok?: boolean } | undefined;

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

export async function upsertConsentTemplate(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const m = await requireMembership();
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (name.length < 2 || body.length < 5)
    return { error: "Başlık ve metin gerekli." };

  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const { error } = id
    ? await supabase
        .from("consent_templates")
        .update({ name, body })
        .eq("id", id)
    : await supabase
        .from("consent_templates")
        .insert({ org_id: m.org_id, name, body });
  if (error) return { error: error.message };

  revalidatePath("/ayarlar");
  return { ok: true };
}

export async function deleteConsentTemplate(formData: FormData) {
  await requireMembership();
  const id = clean(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("consent_templates")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  revalidatePath("/ayarlar");
}
