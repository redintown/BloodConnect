import { z } from "zod";
import { BLOOD_GROUPS } from "@/lib/constants/bloodGroups";

/** Technical bound only — prevents abuse/overflow; DB enforces non-negative stock. */
export const INVENTORY_DELTA_ABS_MAX = 10_000;

export const adjustInventorySchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS),
  delta: z
    .number({ invalid_type_error: "Delta must be an integer." })
    .int("Delta must be an integer.")
    .refine((value) => value !== 0, "Delta must not be zero.")
    .refine(
      (value) => Math.abs(value) <= INVENTORY_DELTA_ABS_MAX,
      `Delta must be between -${INVENTORY_DELTA_ABS_MAX} and ${INVENTORY_DELTA_ABS_MAX}.`
    ),
  reason: z.string().trim().max(300).optional().nullable(),
});

export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
