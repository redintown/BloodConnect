import { BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";

/**
 * Phase 8C inventory hints for escalation.
 * Exact counts are for the owning organization only.
 * Requesters only get a non-quantitative availability phrase.
 */

export function unitsForBloodGroup(
  unitsByGroup: ReadonlyMap<BloodGroup, number>,
  bloodGroup: string
): number {
  return unitsByGroup.get(bloodGroup as BloodGroup) ?? 0;
}

/** Owning organization may see exact own stock. */
export function formatOwnInventoryHint(bloodGroup: BloodGroup, unitsAvailable: number): string {
  const label = BLOOD_GROUP_LABELS[bloodGroup] ?? bloodGroup;
  if (unitsAvailable <= 0) {
    return `${label} — no units currently available (hint only; not a guarantee)`;
  }
  return `${label} — ${unitsAvailable} unit${unitsAvailable === 1 ? "" : "s"} currently available (hint only; not a guarantee)`;
}

/**
 * Requester-facing copy when an org responded CAN_SUPPLY.
 * Never include exact counts.
 */
export function formatRequesterCanSupplyInventoryHint(): string {
  return "Inventory may be available (not reserved or guaranteed)";
}
