"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors/AppError";
import { requireAnyRole, requireRole } from "@/services/authService";
import { escalationService } from "@/services/escalationService";
import type { OrgEscalationResponse } from "@/lib/escalation/constants";

function actionError(error: unknown): { error: string } {
  if (error instanceof AppError) return { error: error.userMessage };
  return { error: "Something went wrong" };
}

const ALLOWED: Exclude<OrgEscalationResponse, "PENDING">[] = [
  "ACKNOWLEDGED",
  "CAN_SUPPLY",
  "CANNOT_HELP",
];

export async function respondToEscalationAction(
  targetId: string,
  response: string
): Promise<{ error: string } | { ok: true }> {
  if (!ALLOWED.includes(response as Exclude<OrgEscalationResponse, "PENDING">)) {
    return { error: "Invalid input" };
  }

  try {
    await requireAnyRole(["HOSPITAL", "BLOOD_BANK", "ADMIN"]);
    await escalationService.respondAsOrganization(
      targetId,
      response as Exclude<OrgEscalationResponse, "PENDING">
    );
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/hospital/requests");
  revalidatePath("/blood-bank/requests");
  revalidatePath("/admin/escalations");
  revalidatePath("/requests");
  return { ok: true };
}

export async function adminResolveEscalationAction(
  requestId: string
): Promise<{ error: string } | { ok: true }> {
  try {
    await requireRole("ADMIN");
    await escalationService.resolveEscalation(requestId, "ADMIN_RESOLVED");
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/escalations");
  revalidatePath(`/requests/${requestId}`);
  return { ok: true };
}

export async function adminCancelEscalationAction(
  requestId: string
): Promise<{ error: string } | { ok: true }> {
  try {
    await requireRole("ADMIN");
    await escalationService.cancelEscalation(requestId, "ADMIN_CANCELLED");
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/escalations");
  revalidatePath(`/requests/${requestId}`);
  return { ok: true };
}
