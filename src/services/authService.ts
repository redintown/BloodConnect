import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors/AppError";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@/schemas/auth.schema";
import {
  isSelfAssignableRole,
  type AppRole,
  type SelfAssignableRole,
} from "@/lib/constants/roles";
import {
  assertAuthenticated,
  ensureHasAnyRole,
  ensureHasRole,
} from "@/lib/auth/authorization";
import { mapAuthError } from "@/lib/auth/mapAuthError";

/**
 * Owns auth.users, profiles (signup bootstrap), and user_roles.
 * Authorization helpers here are the source of truth for privileged
 * service methods and route-group layouts — never a client-side flag.
 */

type MutatingClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>;
  };
};

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

function profileFromUser(user: User) {
  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" && metadata.full_name.trim().length > 0
      ? metadata.full_name.trim()
      : "User";
  const phone = typeof metadata.phone === "string" && metadata.phone.trim().length > 0 ? metadata.phone.trim() : null;
  return { id: user.id, full_name: fullName, phone };
}

async function insertProfile(supabase: MutatingClient, user: User): Promise<boolean> {
  const { error } = await supabase.from("profiles").insert(profileFromUser(user));
  if (!error || isUniqueViolation(error)) return true;
  return false;
}

async function insertRole(supabase: MutatingClient, userId: string, role: SelfAssignableRole): Promise<boolean> {
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (!error || isUniqueViolation(error)) return true;
  return false;
}

async function tryAdminInsertProfile(user: User): Promise<boolean> {
  try {
    return await insertProfile(createAdminClient(), user);
  } catch (cause) {
    // Missing service-role key or browser-guard — caller decides whether
    // the trigger already created the row.
    if (cause instanceof AppError) throw cause;
    return false;
  }
}

async function tryAdminInsertRole(userId: string, role: SelfAssignableRole): Promise<boolean> {
  try {
    return await insertRole(createAdminClient(), userId, role);
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    return false;
  }
}

/**
 * Creates the profiles row if missing. Safe to retry (unique id).
 * Prefers the RLS-scoped user client; falls back to the service-role
 * client when there is no session yet (email confirmation).
 */
export async function ensureProfile(user: User): Promise<void> {
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    const created = (await insertProfile(supabase, user)) || (await tryAdminInsertProfile(user));
    if (!created) throw AppError.server(readError);
    return;
  }

  if (existing) return;

  const created = (await insertProfile(supabase, user)) || (await tryAdminInsertProfile(user));
  if (!created) throw AppError.server();
}

/**
 * Assigns a single initial role. ADMIN is rejected even if a caller bypasses
 * the Zod schema. Idempotent on (user_id, role).
 */
export async function assignInitialRole(userId: string, role: unknown): Promise<void> {
  if (!isSelfAssignableRole(role)) {
    throw AppError.unauthorized("Unauthorized");
  }

  const assigned = (await insertRole(createClient(), userId, role)) || (await tryAdminInsertRole(userId, role));
  if (assigned) return;

  const roles = await getCurrentUserRoles();
  if (roles.includes(role)) return;

  throw AppError.server();
}

async function bootstrapAccount(user: User, initialRole?: unknown): Promise<void> {
  await ensureProfile(user);

  const roles = await getCurrentUserRoles();
  if (roles.length > 0) return;

  const hint =
    initialRole ??
    (typeof user.user_metadata?.initial_role === "string" ? user.user_metadata.initial_role : undefined);

  if (isSelfAssignableRole(hint)) {
    await assignInitialRole(user.id, hint);
  }
}

export async function registerUser(input: RegisterInput) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw AppError.validation("Invalid input");
  }
  if (!isSelfAssignableRole(parsed.data.initialRole)) {
    throw AppError.unauthorized("Unauthorized");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        initial_role: parsed.data.initialRole,
      },
    },
  });

  if (error) throw mapAuthError(error);
  if (!data.user) throw AppError.server();

  try {
    await bootstrapAccount(data.user, parsed.data.initialRole);
  } catch (cause) {
    // Auth user exists; profile/role retries happen on next login via
    // bootstrapAccount. Don't leak setup details.
    if (data.session) {
      throw cause instanceof AppError ? cause : AppError.server(cause);
    }
  }

  return { user: data.user, session: data.session };
}

export async function loginUser(input: LoginInput) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    throw AppError.validation("Invalid input");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) throw mapAuthError(error);
  if (!data.user) throw AppError.unauthenticated("Invalid credentials");

  await bootstrapAccount(data.user);
  return data.user;
}

export async function logoutUser() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw mapAuthError(error);
}

export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // A missing/invalid session is not a server failure — callers treat null
  // as logged-out. mapAuthError is reserved for login/signup mutations.
  if (error || !user) return null;
  return user;
}

/**
 * Returns the caller's roles from `user_roles`. This — not any client-side
 * flag — is the source of truth for authorization checks in services and
 * route handlers.
 */
export async function getCurrentUserRoles(): Promise<AppRole[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

  if (error) throw AppError.server(error);

  return (data ?? []).map((row: { role: AppRole }) => row.role);
}

/** Throws if there is no authenticated session. */
export async function requireAuth(): Promise<User> {
  return assertAuthenticated(await getCurrentUser());
}

/** Throws AppError.unauthorized() if the current user lacks `role`. */
export async function requireRole(role: AppRole): Promise<User> {
  const user = await requireAuth();
  ensureHasRole(await getCurrentUserRoles(), role);
  return user;
}

/** Throws if the current user has none of the listed roles. */
export async function requireAnyRole(roles: AppRole[]): Promise<User> {
  const user = await requireAuth();
  ensureHasAnyRole(await getCurrentUserRoles(), roles);
  return user;
}
