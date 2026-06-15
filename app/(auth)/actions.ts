"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string } | undefined;

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
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
