"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMembership } from "@/lib/auth/dal";
import { logAudit } from "@/lib/audit";

export type SettingsState = { error?: string; ok?: boolean } | undefined;

const clean = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

const ORG_ROLES = ["owner", "reception", "specialist", "accountant"] as const;
type OrgRole = (typeof ORG_ROLES)[number];

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

// ── Personel & rol yönetimi (owner-only) ──

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Yönetici yeni personel hesabı açar (geçici şifre) + rol + staff kaydı. */
export async function inviteMember(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const m = await requireMembership();
  if (m.role !== "owner")
    return { error: "Yalnız yönetici personel ekleyebilir." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "") as OrgRole;
  const password = String(formData.get("password") ?? "");

  if (fullName.length < 2) return { error: "Ad soyad en az 2 karakter olmalı." };
  if (!emailRe.test(email)) return { error: "Geçerli bir e-posta girin." };
  if (!ORG_ROLES.includes(role)) return { error: "Geçersiz rol." };
  if (password.length < 8)
    return { error: "Geçici şifre en az 8 karakter olmalı." };

  const admin = createAdminClient();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) {
    return {
      error: /registered|exists|duplicate/i.test(cErr?.message ?? "")
        ? "Bu e-posta zaten kayıtlı."
        : (cErr?.message ?? "Hesap oluşturulamadı."),
    };
  }

  const { data: member, error: mErr } = await admin
    .from("org_members")
    .insert({ org_id: m.org_id, user_id: created.user.id, role })
    .select("id")
    .single();
  if (mErr || !member) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return { error: mErr?.message ?? "Üyelik oluşturulamadı." };
  }

  const { error: sErr } = await admin
    .from("staff")
    .insert({ org_id: m.org_id, member_id: member.id, full_name: fullName });
  if (sErr) {
    // Üyelik açıldı ama staff açılamadı → geri al (yetim kullanıcı bırakma)
    await admin.from("org_members").delete().eq("id", member.id);
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return { error: sErr.message };
  }

  await logAudit("member.invite", "org_member", member.id, { role, email });
  revalidatePath("/ayarlar");
  return { ok: true };
}

export async function updateMemberRole(formData: FormData) {
  const m = await requireMembership();
  if (m.role !== "owner") return;
  const memberId = clean(formData.get("member_id"));
  const role = String(formData.get("role") ?? "") as OrgRole;
  if (!memberId || !ORG_ROLES.includes(role)) return;
  if (memberId === m.member_id) return; // kendi rolünü değiştiremez (kilitlenme)

  const supabase = await createClient();
  const { error } = await supabase
    .from("org_members")
    .update({ role })
    .eq("id", memberId);
  if (error) return;
  await logAudit("member.role_change", "org_member", memberId, { role });
  revalidatePath("/ayarlar");
}

export async function deactivateMember(formData: FormData) {
  const m = await requireMembership();
  if (m.role !== "owner") return;
  const memberId = clean(formData.get("member_id"));
  if (!memberId || memberId === m.member_id) return; // kendini pasifleştiremez

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("org_members")
    .update({ deleted_at: now })
    .eq("id", memberId);
  if (error) return;
  await supabase.from("staff").update({ deleted_at: now }).eq("member_id", memberId);
  await logAudit("member.deactivate", "org_member", memberId, {});
  revalidatePath("/ayarlar");
}
