import { z } from "zod";
import {
  EMERGENCY_RADIUS_KM_DEFAULT,
  EMERGENCY_RADIUS_KM_MAX,
  EMERGENCY_RADIUS_KM_MIN,
} from "@/lib/matching/emergencyCriteria";

export const availabilitySchema = z.object({
  isAvailable: z.boolean(),
  isAvailableAtNight: z.boolean(),
});

export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export const emergencySettingsSchema = z.object({
  emergencyResponseEnabled: z.boolean(),
  emergencyRadiusKm: z.coerce
    .number()
    .min(EMERGENCY_RADIUS_KM_MIN)
    .max(EMERGENCY_RADIUS_KM_MAX)
    .default(EMERGENCY_RADIUS_KM_DEFAULT),
});

export type EmergencySettingsInput = z.infer<typeof emergencySettingsSchema>;
