import type { BloodGroup } from "@/lib/constants/bloodGroups";
import { BLOOD_GROUPS } from "@/lib/constants/bloodGroups";

/**
 * Whole-blood donor → recipient compatibility.
 * Key = recipient blood group; value = set of acceptable donor groups.
 */
export const COMPATIBLE_DONORS_BY_RECIPIENT: Record<BloodGroup, readonly BloodGroup[]> = {
  O_NEG: ["O_NEG"],
  O_POS: ["O_NEG", "O_POS"],
  A_NEG: ["O_NEG", "A_NEG"],
  A_POS: ["O_NEG", "O_POS", "A_NEG", "A_POS"],
  B_NEG: ["O_NEG", "B_NEG"],
  B_POS: ["O_NEG", "O_POS", "B_NEG", "B_POS"],
  AB_NEG: ["O_NEG", "A_NEG", "B_NEG", "AB_NEG"],
  AB_POS: [...BLOOD_GROUPS],
};

/** True when a donor of `donorBloodGroup` can give to a recipient of `recipientBloodGroup`. */
export function isCompatible(donorBloodGroup: BloodGroup, recipientBloodGroup: BloodGroup): boolean {
  return COMPATIBLE_DONORS_BY_RECIPIENT[recipientBloodGroup].includes(donorBloodGroup);
}
