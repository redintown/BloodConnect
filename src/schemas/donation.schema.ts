import { z } from "zod";

export const recordDonationSchema = z.object({
  donorId: z.string().uuid(),
  bloodRequestId: z.string().uuid(),
  bloodRequestMatchId: z.string().uuid(),
  donatedAt: z.string().datetime({ offset: true }).optional(),
  quantityMl: z.number().int().positive().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type RecordDonationInput = z.infer<typeof recordDonationSchema>;
