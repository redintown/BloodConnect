import "server-only";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors/AppError";
import { requireAnyRole, requireAuth, requireRole } from "@/services/authService";
import type { AppRole } from "@/lib/constants/roles";
import type { User } from "@supabase/supabase-js";

/**
 * Route-group layouts call this once so individual pages don't repeat
 * authorization checks. Unauthenticated visitors go to login; signed-in
 * users missing the role go to /unauthorized.
 */
export async function protectPage(options?: {
  role?: AppRole;
  anyOf?: AppRole[];
}): Promise<User> {
  try {
    if (options?.anyOf) return await requireAnyRole(options.anyOf);
    if (options?.role) return await requireRole(options.role);
    return await requireAuth();
  } catch (error) {
    if (error instanceof AppError && error.code === "AUTHENTICATION_ERROR") {
      redirect("/login");
    }
    if (error instanceof AppError && error.code === "AUTHORIZATION_ERROR") {
      redirect("/unauthorized");
    }
    throw error;
  }
}
