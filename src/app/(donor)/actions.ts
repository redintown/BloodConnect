"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";
import { matchResponseService } from "@/services/matchResponseService";
import { donorProfileSchema } from "@/schemas/donor.schema";
import { availabilitySchema } from "@/schemas/availability.schema";

function actionError(error: unknown): { error: string } {
  if (error instanceof AppError) return { error: error.userMessage };
  return { error: "Something went wrong" };
}

function revalidateDonorPaths() {
  revalidatePath("/donor");
  revalidatePath("/donor/requests");
  revalidatePath("/donor/history");
  revalidatePath("/donor/availability");
  revalidatePath("/requests");
}

export async function saveDonorProfileAction(input: unknown): Promise<{ error: string } | { ok: true }> {
  const parsed = donorProfileSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  try {
    const user = await requireRole("DONOR");
    await donorService.upsertProfile(user.id, parsed.data);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/donor");
  revalidatePath("/donor/profile");
  revalidatePath("/donor/availability");
  return { ok: true };
}

export async function saveDonorAvailabilityAction(input: unknown): Promise<{ error: string } | { ok: true }> {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  try {
    const user = await requireRole("DONOR");
    await donorService.setAvailability(user.id, parsed.data.isAvailable, parsed.data.isAvailableAtNight);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/donor");
  revalidatePath("/donor/availability");
  return { ok: true };
}

export async function acceptMatchAction(
  matchId: string
): Promise<{ error: string } | { ok: true }> {
  try {
    const user = await requireRole("DONOR");
    await matchResponseService.acceptMatch(matchId, user.id);
  } catch (error) {
    return actionError(error);
  }

  revalidateDonorPaths();
  return { ok: true };
}

export async function declineMatchAction(
  matchId: string
): Promise<{ error: string } | { ok: true }> {
  try {
    const user = await requireRole("DONOR");
    await matchResponseService.declineMatch(matchId, user.id);
  } catch (error) {
    return actionError(error);
  }

  revalidateDonorPaths();
  return { ok: true };
}

export async function markOnTheWayAction(
  matchId: string
): Promise<{ error: string } | { ok: true }> {
  try {
    const user = await requireRole("DONOR");
    await matchResponseService.markOnTheWay(matchId, user.id);
  } catch (error) {
    return actionError(error);
  }

  revalidateDonorPaths();
  return { ok: true };
}
