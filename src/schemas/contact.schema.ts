import { z } from "zod";

/** Shared by blood requests, hospital/blood-bank registration, etc. */
export const contactInfoSchema = z.object({
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number."),
});

export type ContactInfoInput = z.infer<typeof contactInfoSchema>;

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type CoordinatesInput = z.infer<typeof coordinatesSchema>;
