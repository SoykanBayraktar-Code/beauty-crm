import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase istemcisi — RLS'i ATLAR. Yalnızca güvenilir sunucu
 * kodunda (örn. personel hesabı oluşturma) kullanılır; istemciye ASLA gönderilmez.
 * `server-only` import'u client bundle'a sızmayı derleme zamanında engeller.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
