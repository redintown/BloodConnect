"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { verificationService } from "@/services/verificationService";
import { orgRejectSchema } from "@/schemas/hospital.schema";
import { z } from "zod";

function actionError(error: unknown): { error: string } {
  if (error instanceof AppError) return { error: error.userMessage };
  return { error: "Something went wrong" };
}

const verifySchema = z.object({
  organizationType: z.enum(["HOSPITAL", "BLOOD_BANK"]),
  organizationId: z.string().uuid(),
});

export async function verifyOrganizationAction(
  organizationType: string,
  organizationId: string
): Promise<{ error: string } | { ok: true }> {
  const parsed = verifySchema.safeParse({ organizationType, organizationId });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await requireRole("ADMIN");
    if (parsed.data.organizationType === "HOSPITAL") {
      await verificationService.verifyHospital(parsed.data.organizationId);
    } else {
      await verificationService.verifyBloodBank(parsed.data.organizationId);
    }
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/verification");
  return { ok: true };
}

export async function rejectOrganizationAction(
  organizationType: string,
  organizationId: string,
  reason: string
): Promise<{ error: string } | { ok: true }> {
  const typeParsed = verifySchema.safeParse({ organizationType, organizationId });
  const reasonParsed = orgRejectSchema.safeParse({ organizationId, reason });
  if (!typeParsed.success || !reasonParsed.success) return { error: "Invalid input" };

  try {
    await requireRole("ADMIN");
    if (typeParsed.data.organizationType === "HOSPITAL") {
      await verificationService.rejectHospital(
        typeParsed.data.organizationId,
        reasonParsed.data.reason
      );
    } else {
      await verificationService.rejectBloodBank(
        typeParsed.data.organizationId,
        reasonParsed.data.reason
      );
    }
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/verification");
  return { ok: true };
}
