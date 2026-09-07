import { z } from "zod";
import { BLOOD_GROUPS } from "@/lib/constants/bloodGroups";
import { coordinatesSchema } from "@/schemas/contact.schema";
import { availabilitySchema } from "@/schemas/availability.schema";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const donorProfileSchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: "Select a blood group." }) }),
  lastDonationDate: z
    .union([z.string().date(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || value <= todayIsoDate(), {
      message: "Last donation date can't be in the future.",
    }),
  location: coordinatesSchema.optional().nullable(),
  availability: availabilitySchema.optional(),
});

export type DonorProfileInput = z.infer<typeof donorProfileSchema>;
