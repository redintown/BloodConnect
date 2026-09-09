import { z } from "zod";

export const donorRejectSchema = z.object({
  donorId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
});

export type DonorRejectInput = z.infer<typeof donorRejectSchema>;

