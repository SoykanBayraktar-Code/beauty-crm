import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Standart LOKAL Supabase demo anahtarları — her makinedeki `supabase start`
 * stack'inde aynıdır, gerçek bir sır DEĞİLDİR. Testler yalnız 127.0.0.1'e bağlanır.
 * CI/farklı ortam için env ile override edilebilir.
 */
export const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const baseAuth = { autoRefreshToken: false, persistSession: false } as const;

/** RLS'i atlayan servis-rol istemcisi — yalnız test KURULUMU/temizliği için. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: baseAuth });
}

/** Kimliksiz (anon) istemci — RLS public-rol olarak uygulanır. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: baseAuth });
}

/** Belirli kullanıcı olarak oturum açmış istemci — RLS o kullanıcıya uygulanır. */
export async function signInAs(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: baseAuth });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`signInAs(${email}) başarısız: ${error?.message}`);
  }
  return c;
}
