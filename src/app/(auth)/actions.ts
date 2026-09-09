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
  logRegisterDiag("registration started");
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    logRegisterDiag("validation failed");
    return { error: "Invalid input" };
  }
  logRegisterDiag("validation passed", { initialRole: parsed.data.initialRole });

  try {
    const result = await registerUser(parsed.data);
    logRegisterDiag("registerUser returned", {
      userId: result.user?.id ?? null,
      hasSession: Boolean(result.session),
    });
    if (!result.session) {
      logRegisterDiag("needs email confirmation");
      return { needsEmailConfirmation: true };
    }
  } catch (error) {
    logRegisterDiag("caught error in registerAction", summarizeCaughtError(error));
    return actionError(error);
  }

  const roles = await getCurrentUserRoles();
  logRegisterDiag("post-register roles loaded", { roles });
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
