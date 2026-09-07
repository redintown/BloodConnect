import { AppError } from "@/lib/errors/AppError";
import type { AppRole } from "@/lib/constants/roles";

/** Pure helpers used by authService. Safe to unit-test without Supabase. */

export function assertAuthenticated<T>(user: T | null | undefined): T {
  if (!user) {
    throw AppError.unauthenticated();
  }
  return user;
}

export function hasRole(userRoles: readonly AppRole[], role: AppRole): boolean {
  return userRoles.includes(role);
}

export function hasAnyRole(userRoles: readonly AppRole[], required: readonly AppRole[]): boolean {
  return required.some((role) => userRoles.includes(role));
}

export function ensureHasRole(userRoles: readonly AppRole[], role: AppRole): void {
  if (!hasRole(userRoles, role)) {
    throw AppError.unauthorized("Unauthorized");
  }
}

export function ensureHasAnyRole(userRoles: readonly AppRole[], required: readonly AppRole[]): void {
  if (required.length === 0 || !hasAnyRole(userRoles, required)) {
    throw AppError.unauthorized("Unauthorized");
  }
}
