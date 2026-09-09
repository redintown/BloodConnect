"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { hospitalService } from "@/services/hospitalService";
import { bloodBankService } from "@/services/bloodBankService";
import { hospitalProfileSchema } from "@/schemas/hospital.schema";
import { bloodBankProfileSchema } from "@/schemas/bloodBank.schema";

function actionError(error: unknown): { error: string } {
  if (error instanceof AppError) return { error: error.userMessage };
  return { error: "Something went wrong" };
}

export async function saveHospitalProfileAction(
  input: unknown
): Promise<{ error: string } | { ok: true; reVerificationRequired?: boolean }> {
  const parsed = hospitalProfileSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await requireRole("HOSPITAL");
    const existing = await hospitalService.getOwnProfile();
    const wasVerified = existing?.verificationStatus === "VERIFIED";
    if (existing) {
      const updated = await hospitalService.updateOwnProfile(parsed.data);
      revalidatePath("/hospital");
      revalidatePath("/hospital/profile");
      return {
        ok: true,
        reVerificationRequired: wasVerified && updated.verificationStatus === "PENDING",
      };
    }
    await hospitalService.createOwnProfile(parsed.data);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/hospital");
  revalidatePath("/hospital/profile");
  return { ok: true };
}

export async function submitHospitalVerificationAction(): Promise<
  { error: string } | { ok: true }
> {
  try {
    await requireRole("HOSPITAL");
    await hospitalService.submitVerification();
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/hospital");
  revalidatePath("/hospital/profile");
  return { ok: true };
}

export async function saveBloodBankProfileAction(
  input: unknown
): Promise<{ error: string } | { ok: true; reVerificationRequired?: boolean }> {
  const parsed = bloodBankProfileSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await requireRole("BLOOD_BANK");
    const existing = await bloodBankService.getOwnProfile();
    const wasVerified = existing?.verificationStatus === "VERIFIED";
    if (existing) {
      const updated = await bloodBankService.updateOwnProfile(parsed.data);
      revalidatePath("/blood-bank");
      revalidatePath("/blood-bank/profile");
      return {
        ok: true,
        reVerificationRequired: wasVerified && updated.verificationStatus === "PENDING",
      };
    }
    await bloodBankService.createOwnProfile(parsed.data);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/blood-bank");
  revalidatePath("/blood-bank/profile");
  return { ok: true };
}

export async function submitBloodBankVerificationAction(): Promise<
  { error: string } | { ok: true }
> {
  try {
    await requireRole("BLOOD_BANK");
    await bloodBankService.submitVerification();
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/blood-bank");
  revalidatePath("/blood-bank/profile");
  return { ok: true };
}
