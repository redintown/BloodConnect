import { z } from "zod";
import { contactInfoSchema, coordinatesSchema } from "@/schemas/contact.schema";

export const bloodBankProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    address: z.string().trim().min(5).max(300),
    location: coordinatesSchema.optional().nullable(),
    emergencyHours: z.string().trim().max(200).optional().nullable(),
  })
  .merge(contactInfoSchema.pick({ contactPhone: true }));

export type BloodBankProfileInput = z.infer<typeof bloodBankProfileSchema>;
