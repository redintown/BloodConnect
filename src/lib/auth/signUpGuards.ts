import type { User } from "@supabase/supabase-js";

/**
 * Supabase Auth unique-email behavior (GoTrue):
 *
 * - Email uniqueness is enforced in `auth.users` — a second row for the same
 *   email is not created.
 * - When "Confirm email" is enabled and signUp is called for an *existing*
 *   confirmed address, Auth intentionally returns HTTP success with an
 *   obfuscated user object (typically `identities: []`) and no session, so
 *   callers cannot enumerate registered emails.
 * - When confirm email is disabled, Auth returns an error such as
 *   "User already registered" (mapped in mapAuthError).
 *
 * Detect the obfuscated success path so registration UX does not claim a
 * new account was created — and so clients cannot enumerate emails by
 * distinguishing error vs confirmation UX.
 */
export function isObfuscatedDuplicateSignUp(user: User | null | undefined): boolean {
  if (!user) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}
