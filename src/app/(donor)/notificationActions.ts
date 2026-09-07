"use server";

import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { notificationService } from "@/services/notificationService";

function actionError(error: unknown): { error: string } {
  if (error instanceof AppError) return { error: error.userMessage };
  return { error: "Something went wrong" };
}

/** Phase 6: mark own IN_APP notification read — separate from Phase 5 match actions. */
export async function markNotificationReadAction(
  notificationId: string
): Promise<{ error: string } | { ok: true }> {
  try {
    const user = await requireRole("DONOR");
    await notificationService.markRead(notificationId, user.id);
  } catch (error) {
    return actionError(error);
  }

  return { ok: true };
}
