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
import { isObfuscatedDuplicateSignUp } from "@/lib/auth/signUpGuards";

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
 * Session-bound: userId must match the authenticated session (blocks service-role
 * role inserts for an arbitrary other user).
 */
export async function assignInitialRole(userId: string, role: unknown): Promise<void> {
  if (!isSelfAssignableRole(role)) {
    throw AppError.unauthorized("Unauthorized");
  }

  const session = await getCurrentUser();
  if (!session || session.id !== userId) {
    throw AppError.unauthorized("Unauthorized");
  }

  const assigned = (await insertRole(createClient(), userId, role)) || (await tryAdminInsertRole(userId, role));
  if (assigned) return;

  const roles = await getCurrentUserRoles();
  if (roles.includes(role)) return;

  throw AppError.server();
}

/** TEMP diagnostic — remove after registration debug. Never logs secrets. */
function logRegisterDiag(step: string, detail?: Record<string, unknown>) {
  console.error("[register-diag]", step, detail ?? {});
}

function summarizeCaughtError(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    const cause = error.cause;
    const causeObj =
      typeof cause === "object" && cause !== null ? (cause as Record<string, unknown>) : null;
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      causeName: causeObj && typeof causeObj.name === "string" ? causeObj.name : undefined,
      causeMessage: causeObj && typeof causeObj.message === "string" ? causeObj.message : undefined,
      causeCode: causeObj && typeof causeObj.code === "string" ? causeObj.code : undefined,
      causeStatus: causeObj && typeof causeObj.status === "number" ? causeObj.status : undefined,
      causeDetails: causeObj && typeof causeObj.details === "string" ? causeObj.details : undefined,
      causeHint: causeObj && typeof causeObj.hint === "string" ? causeObj.hint : undefined,
    };
  }
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    return {
      name: typeof err.name === "string" ? err.name : undefined,
      message: typeof err.message === "string" ? err.message : undefined,
      code: typeof err.code === "string" ? err.code : undefined,
      details: typeof err.details === "string" ? err.details : undefined,
      hint: typeof err.hint === "string" ? err.hint : undefined,
      status: typeof err.status === "number" ? err.status : undefined,
    };
  }
  return { message: String(error) };
}

async function bootstrapAccount(user: User, initialRole?: unknown): Promise<void> {
  logRegisterDiag("profile creation started", { userId: user.id });
  await ensureProfile(user);
  logRegisterDiag("profile creation result", { userId: user.id, ok: true });

  logRegisterDiag("role bootstrap started", { userId: user.id });
  const roles = await getCurrentUserRoles();
  if (roles.length > 0) {
    logRegisterDiag("role bootstrap result", { userId: user.id, roles, skippedAssign: true });
    return;
  }

  const hint =
    initialRole ??
    (typeof user.user_metadata?.initial_role === "string" ? user.user_metadata.initial_role : undefined);

  if (isSelfAssignableRole(hint)) {
    await assignInitialRole(user.id, hint);
    const after = await getCurrentUserRoles();
    logRegisterDiag("role bootstrap result", { userId: user.id, roles: after, assigned: hint });
  } else {
    logRegisterDiag("role bootstrap result", { userId: user.id, roles, assigned: null });
  }

  // Registration does not create donor_profiles; that happens later on the donor profile page.
  logRegisterDiag("donor profile/bootstrap", {
    userId: user.id,
    skipped: true,
    reason: "not part of auth registration; donor_profiles created later",
  });
}

export async function registerUser(input: RegisterInput) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw AppError.validation("Invalid input");
  }
  if (!isSelfAssignableRole(parsed.data.initialRole)) {
    throw AppError.unauthorized("Unauthorized");
  }
  logRegisterDiag("registerUser validation passed", { initialRole: parsed.data.initialRole });

  const supabase = createClient();
  logRegisterDiag("signUp started", { initialRole: parsed.data.initialRole });
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

  if (error) {
    logRegisterDiag("signUp result", {
      ok: false,
      ...summarizeCaughtError(error),
    });
    throw mapAuthError(error);
  }
  if (!data.user) {
    logRegisterDiag("signUp result", { ok: false, reason: "no user returned" });
    throw AppError.server();
  }

  logRegisterDiag("signUp result", {
    ok: true,
    userId: data.user.id,
    hasSession: Boolean(data.session),
    identitiesCount: Array.isArray(data.user.identities) ? data.user.identities.length : null,
  });

  // Confirm-email projects: duplicate emails return a fake user (empty
  // identities) instead of an error. Do not treat that as a new signup.
  if (isObfuscatedDuplicateSignUp(data.user)) {
    logRegisterDiag("signUp obfuscated duplicate detected", { userId: data.user.id });
    throw AppError.conflict("Email already registered");
  }

  try {
    await bootstrapAccount(data.user, parsed.data.initialRole);
  } catch (cause) {
    logRegisterDiag("bootstrapAccount caught error", {
      userId: data.user.id,
      hasSession: Boolean(data.session),
      ...summarizeCaughtError(cause),
    });
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
