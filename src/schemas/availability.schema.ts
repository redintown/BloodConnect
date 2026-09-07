import { z } from "zod";

export const availabilitySchema = z.object({
  isAvailable: z.boolean(),
  isAvailableAtNight: z.boolean(),
});

export type AvailabilityInput = z.infer<typeof availabilitySchema>;
