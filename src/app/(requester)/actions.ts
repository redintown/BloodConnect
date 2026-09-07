"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors/AppError";
import { requireAuth } from "@/services/authService";
import { bloodRequestService } from "@/services/bloodRequestService";
import { runMatchingWithNotifications } from "@/services/requestMatchOrchestrator";
import { createBloodRequestSchema } from "@/schemas/bloodRequest.schema";

function actionError(error: unknown): { error: string } {
  if (error instanceof AppError) return { error: error.userMessage };
  return { error: "Something went wrong" };
}

function revalidateRequesterPaths(requestId?: string) {
  revalidatePath("/requests");
  revalidatePath("/request-blood");
  revalidatePath("/donor");
  revalidatePath("/donor/requests");
  if (requestId) revalidatePath(`/requests/${requestId}`);
}

export async function createBloodRequestAction(
  input: unknown
): Promise<{ error: string } | void> {
  const parsed = createBloodRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  let requestId: string;
  try {
    const user = await requireAuth();
    const created = await bloodRequestService.create(user.id, parsed.data);
    requestId = created.id;
  } catch (error) {
    return actionError(error);
  }

  revalidateRequesterPaths(requestId);
  redirect(`/requests/${requestId}`);
}

/**
 * One-click create + Phase 4 match + Phase 6 notify/emergency orchestration.
 */
export async function createBloodRequestAndFindDonorsAction(
  input: unknown
): Promise<{ error: string } | void> {
  const parsed = createBloodRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  let requestId: string;
  let matchCount = 0;
  let emergencyNotifiedCount = 0;
  try {
    const user = await requireAuth();
    const created = await bloodRequestService.create(user.id, parsed.data);
    requestId = created.id;
    const result = await runMatchingWithNotifications(requestId, user.id);
    matchCount = result.matchCount;
    emergencyNotifiedCount = result.emergencyNotifiedCount;
  } catch (error) {
    return actionError(error);
  }

  revalidateRequesterPaths(requestId);
  redirect(
    `/requests/${requestId}?matched=${matchCount}&emergency=${emergencyNotifiedCount}`
  );
}

export async function updateBloodRequestAction(
  requestId: string,
  input: unknown
): Promise<{ error: string } | { ok: true }> {
  const parsed = createBloodRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  try {
    const user = await requireAuth();
    await bloodRequestService.update(requestId, user.id, parsed.data);
  } catch (error) {
    return actionError(error);
  }

  revalidateRequesterPaths(requestId);
  return { ok: true };
}

export async function cancelBloodRequestAction(
  requestId: string
): Promise<{ error: string } | { ok: true }> {
  try {
    const user = await requireAuth();
    await bloodRequestService.cancel(requestId, user.id);
  } catch (error) {
    return actionError(error);
  }

  revalidateRequesterPaths(requestId);
  return { ok: true };
}

export async function findMatchingDonorsAction(
  requestId: string
): Promise<{ error: string } | { ok: true; matchCount: number; emergencyNotifiedCount: number }> {
  try {
    const user = await requireAuth();
    const result = await runMatchingWithNotifications(requestId, user.id);
    revalidateRequesterPaths(requestId);
    return {
      ok: true,
      matchCount: result.matchCount,
      emergencyNotifiedCount: result.emergencyNotifiedCount,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function confirmDonationReceivedAction(
  requestId: string
): Promise<{ error: string } | { ok: true }> {
  try {
    const user = await requireAuth();
    await bloodRequestService.markCompleted(requestId, user.id);
  } catch (error) {
    return actionError(error);
  }

  revalidateRequesterPaths(requestId);
  revalidatePath("/donor/history");
  revalidatePath("/donor/requests");
  return { ok: true };
}
