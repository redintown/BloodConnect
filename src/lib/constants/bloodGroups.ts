export const BLOOD_GROUPS = [
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
] as const;

export type BloodGroup = (typeof BLOOD_GROUPS)[number];

/** Human-readable label, e.g. "O_NEG" -> "O−". */
export const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  A_POS: "A+",
  A_NEG: "A−",
  B_POS: "B+",
  B_NEG: "B−",
  AB_POS: "AB+",
  AB_NEG: "AB−",
  O_POS: "O+",
  O_NEG: "O−",
};

// NOTE: Actual donor -> recipient compatibility rules live in
// services/matchingService.ts (isCompatible), implemented in Phase 4.
// This file only centralizes the enum + display labels so nothing else
// hard-codes blood-group strings.
