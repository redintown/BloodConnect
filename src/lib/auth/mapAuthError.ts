import { AppError } from "@/lib/errors/AppError";

function readField(error: unknown, key: string): string {
  if (typeof error !== "object" || error === null || !(key in error)) return "";
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value.toLowerCase() : "";
}

function readStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  const value = (error as Record<string, unknown>).status;
  return typeof value === "number" ? value : null;
}

/**
 * Maps Supabase/Auth failures onto safe AppError messages. Never returns
 * the original provider/database text — that can leak internals.
 */
export function mapAuthError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const code = readField(error, "code");
  const message = readField(error, "message");
  const status = readStatus(error);
  const combined = `${code} ${message}`;

  if (
    code === "invalid_credentials" ||
    combined.includes("invalid login") ||
    combined.includes("invalid credentials") ||
    combined.includes("invalid email or password")
  ) {
    return AppError.unauthenticated("Invalid credentials");
  }

  if (
    code === "user_already_exists" ||
    combined.includes("already registered") ||
    combined.includes("already exists") ||
    combined.includes("user already")
  ) {
    return AppError.conflict("Email already registered");
  }

  if (combined.includes("email not confirmed") || combined.includes("email_not_confirmed")) {
    return AppError.unauthenticated("Please confirm your email before signing in.");
  }

  if (
    code === "over_email_send_rate_limit" ||
    status === 429 ||
    combined.includes("rate limit") ||
    combined.includes("too many requests")
  ) {
    return AppError.rateLimited("Too many attempts. Please try again shortly.");
  }

  if (
    code === "session_expired" ||
    combined.includes("session expired") ||
    combined.includes("session_not_found") ||
    combined.includes("refresh_token") ||
    combined.includes("jwt")
  ) {
    return AppError.unauthenticated("Session expired");
  }

  if (code === "validation_failed" || combined.includes("invalid")) {
    return AppError.validation("Invalid input");
  }

  return AppError.server(error);
}
