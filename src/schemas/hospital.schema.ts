import { z } from "zod";
import { contactInfoSchema, coordinatesSchema } from "@/schemas/contact.schema";

export const hospitalProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    address: z.string().trim().min(5).max(300),
    location: coordinatesSchema.optional().nullable(),
    has24hEmergency: z.boolean().default(false),
  })
  .merge(contactInfoSchema.pick({ contactPhone: true }));

export type HospitalProfileInput = z.infer<typeof hospitalProfileSchema>;
