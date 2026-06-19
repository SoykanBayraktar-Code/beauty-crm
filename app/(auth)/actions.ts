"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export type AuthState = { error?: string } | undefined;

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});
const signUpSchema = z.object({
  email: emailSchema,
  // Supabase parolayı bcrypt ile saklar (72 bayt üst sınır).
  password: z.string().min(8, "Parola en az 8 karakter olmalı.").max(72),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const ip = await clientIp();
  // IP başına 15 dakikada 10 deneme — brute-force / credential-stuffing freni.
  const rl = rateLimit(`signin:${ip}`, 10, 15 * 60_000);
  if (!rl.ok) {
    return {
      error: `Çok fazla deneme. ${rl.retryAfterSec} saniye sonra tekrar deneyin.`,
    };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Geçerli bir e-posta ve parola girin." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  // Açık kayıt varsayılan olarak KAPALI (tek-merkez ürün). İlk kurulum için
  // ALLOW_PUBLIC_SIGNUP=true ile geçici açılır; sonrası davet-tabanlı.
  if (process.env.ALLOW_PUBLIC_SIGNUP !== "true") {
    return {
      error:
        "Yeni kayıt kapalı. Erişim için merkez yöneticinizden davet isteyin.",
    };
  }

  const ip = await clientIp();
  // IP başına saatte 5 kayıt — spam org üretimini frenler.
  const rl = rateLimit(`signup:${ip}`, 5, 60 * 60_000);
  if (!rl.ok) {
    return {
      error: `Çok fazla deneme. ${rl.retryAfterSec} saniye sonra tekrar deneyin.`,
    };
  }

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Geçerli e-posta ve parola girin.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: error.message };

  redirect("/setup");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setupOrg(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!orgName) return { error: "Merkez adı gerekli." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: orgName,
    p_full_name: fullName,
  });
  if (error) return { error: error.message };

  redirect("/dashboard");
}
