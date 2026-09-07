"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/config/env";

/**
 * Browser-side Supabase client. Uses only the public anon key — RLS is what
 * keeps this safe. Never import this from server-only code paths that need
 * the service-role key.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL(),
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY()
  );
}
