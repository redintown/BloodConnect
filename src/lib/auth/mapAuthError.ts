import { AppError } from "@/lib/errors/AppError";

function readField(error: unknown, key: string): string {
  if (typeof error !== "object" || error === null || !(key in error)) return "";
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value.toLowerCase() : "";
}

/**
 * Maps Supabase/Auth failures onto safe AppError messages. Never returns
 * the original provider/database text — that can leak internals.
 */
export function mapAuthError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const code = readField(error, "code");
  const message = readField(error, "message");
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
