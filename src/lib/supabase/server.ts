import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { env } from "@/config/env";

/**
 * Server-side Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Reads the user's session from cookies and is subject
 * to RLS — it is NOT an admin client.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL(),
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY(),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component with no request context to
            // mutate — safe to ignore because middleware refreshes sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // See note above.
          }
        },
      },
    }
  );
}

/**
 * Admin client using the service-role key, which bypasses Row Level
 * Security entirely. Restricted to trusted server contexts: escalation
 * jobs, admin-only server actions, verification workflows, and signup
 * bootstrap when no session exists yet.
 *
 * NEVER import this module from a file that could be bundled for the
 * client — the service-role key must never reach the browser.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must never be called from the browser.");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill it in."
    );
  }

  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
