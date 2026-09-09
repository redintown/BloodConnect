"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { inventoryService } from "@/services/inventoryService";
import { adjustInventorySchema } from "@/schemas/inventory.schema";
import type { OrganizationType } from "@/lib/escalation/constants";

function actionError(error: unknown): { error: string } {
  if (error instanceof AppError) return { error: error.userMessage };
  return { error: "Something went wrong" };
}

export async function adjustOwnInventoryAction(
  organizationType: OrganizationType,
  input: unknown
): Promise<
  | { error: string }
  | {
      ok: true;
      bloodGroup: string;
      unitsAvailable: number;
      oldUnits: number;
      newUnits: number;
      delta: number;
    }
> {
  const parsed = adjustInventorySchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };
  if (organizationType !== "HOSPITAL" && organizationType !== "BLOOD_BANK") {
    return { error: "Invalid input" };
  }

  try {
    if (organizationType === "HOSPITAL") {
      await requireRole("HOSPITAL");
    } else {
      await requireRole("BLOOD_BANK");
    }

    const result = await inventoryService.adjustInventory(organizationType, parsed.data);

    if (organizationType === "HOSPITAL") {
      revalidatePath("/hospital/inventory");
      revalidatePath("/hospital");
    } else {
      revalidatePath("/blood-bank/inventory");
      revalidatePath("/blood-bank");
    }

    return {
      ok: true,
      bloodGroup: result.item.bloodGroup,
      unitsAvailable: result.item.unitsAvailable,
      oldUnits: result.oldUnits,
      newUnits: result.newUnits,
      delta: result.delta,
    };
  } catch (error) {
    return actionError(error);
  }
}
