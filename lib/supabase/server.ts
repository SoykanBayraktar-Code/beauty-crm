import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Sunucu (Server Component / Route Handler / Server Action) Supabase istemcisi.
 * Next.js 16'da `cookies()` async olduğu için await edilir.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component'ten çağrıldığında yazma engellenir;
            // oturum yenileme proxy.ts'te yapıldığı için yok sayılabilir.
          }
        },
      },
    },
  );
}
