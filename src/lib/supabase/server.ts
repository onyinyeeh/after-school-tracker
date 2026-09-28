import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Use in Server Components, Server Actions, and Route Handlers. Respects
 * RLS as the signed-in parent — see supabase/migration.sql policies.
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
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render (not a Server Action / Route
            // Handler) — the proxy's session refresh will pick this up instead.
          }
        },
      },
    }
  );
}
