"use server";

import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors/AppError";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { landingRouteForRoles } from "@/lib/constants/roles";
import { loginSchema, registerSchema } from "@/schemas/auth.schema";
import {
  getCurrentUserRoles,
  loginUser,
  logoutUser,
  registerUser,
} from "@/services/authService";

function actionError(error: unknown): { error: string } {
  if (error instanceof AppError) return { error: error.userMessage };
  return { error: "Something went wrong" };
}

export async function loginAction(
  input: unknown,
  next?: string
): Promise<{ error: string } | void> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await loginUser(parsed.data);
  } catch (error) {
    return actionError(error);
  }

  const roles = await getCurrentUserRoles();
  redirect(getSafeRedirectPath(next, landingRouteForRoles(roles)));
}

export async function registerAction(
  input: unknown
): Promise<{ error: string } | { needsEmailConfirmation: true } | void> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  try {
    const result = await registerUser(parsed.data);
    if (!result.session) {
      return { needsEmailConfirmation: true };
    }
  } catch (error) {
    return actionError(error);
  }

  const roles = await getCurrentUserRoles();
  redirect(getSafeRedirectPath(undefined, landingRouteForRoles(roles)));
}

export async function logoutAction() {
  try {
    await logoutUser();
  } catch {
    // Always send the user to a public page; middleware will drop a dead session.
  }
  redirect("/");
}
