import { z } from "zod";
import { contactInfoSchema, coordinatesSchema } from "@/schemas/contact.schema";

export const hospitalProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    address: z.string().trim().min(5).max(300),
    location: coordinatesSchema,
    has24hEmergency: z.boolean().default(false),
  })
  .merge(contactInfoSchema.pick({ contactPhone: true }));

export type HospitalProfileInput = z.infer<typeof hospitalProfileSchema>;

export const orgRejectSchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
});

export type OrgRejectInput = z.infer<typeof orgRejectSchema>;
