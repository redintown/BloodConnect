import { z } from "zod";
import { BLOOD_GROUPS } from "@/lib/constants/bloodGroups";
import { REQUEST_URGENCIES } from "@/lib/constants/requestStatus";
import { contactInfoSchema, coordinatesSchema } from "@/schemas/contact.schema";

export const createBloodRequestSchema = z
  .object({
    bloodGroup: z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: "Select a blood group." }) }),
    quantityUnits: z.coerce.number().int().min(1).max(20),
    urgency: z.enum(REQUEST_URGENCIES),
    requiredBy: z.string().datetime().optional().nullable(),
    hospitalId: z.string().uuid().optional().nullable(),
    hospitalNameFreeform: z.string().trim().max(200).optional().nullable(),
    location: coordinatesSchema,
    notes: z.string().trim().max(500).optional().nullable(),
    /** Explicit opt-in — never inferred from urgency alone. */
    isEmergency: z.boolean().default(false),
  })
  .merge(contactInfoSchema)
  .refine((data) => data.hospitalId || data.hospitalNameFreeform, {
    message: "Select a hospital or enter one manually.",
    path: ["hospitalNameFreeform"],
  });

export type CreateBloodRequestInput = z.infer<typeof createBloodRequestSchema>;
