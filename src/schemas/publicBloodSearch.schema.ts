import { z } from "zod";
import { BLOOD_GROUPS } from "@/lib/constants/bloodGroups";
import { coordinatesSchema } from "@/schemas/contact.schema";

export const PUBLIC_SEARCH_RADIUS_KM = [5, 10, 25, 50] as const;
export type PublicSearchRadiusKm = (typeof PUBLIC_SEARCH_RADIUS_KM)[number];

export const PUBLIC_SEARCH_ORG_TYPES = ["ALL", "HOSPITAL", "BLOOD_BANK"] as const;
export type PublicSearchOrgType = (typeof PUBLIC_SEARCH_ORG_TYPES)[number];

export const publicBloodSearchSchema = z
  .object({
    bloodGroup: z.enum(BLOOD_GROUPS),
    radiusKm: z.union([
      z.literal(5),
      z.literal(10),
      z.literal(25),
      z.literal(50),
    ]),
    organizationType: z.enum(PUBLIC_SEARCH_ORG_TYPES),
  })
  .merge(coordinatesSchema);

export type PublicBloodSearchInput = z.infer<typeof publicBloodSearchSchema>;
