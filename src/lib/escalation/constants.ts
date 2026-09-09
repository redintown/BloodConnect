import type { RequestUrgency } from "@/lib/constants/requestStatus";

/** Bounded org discovery radius for Phase 7 (not donor matching). */
export const ESCALATION_ORG_SEARCH_RADIUS_METERS = 50_000;

/**
 * Donor-response wait before auto-escalating an emergency request to orgs.
 * MODERATE: null = automatic escalation disabled (manual only).
 */
export const ESCALATION_DONOR_RESPONSE_WINDOW_MS: Record<RequestUrgency, number | null> = {
  CRITICAL: 15 * 60 * 1000,
  HIGH: 60 * 60 * 1000,
  MODERATE: null,
};

/** Wait after BLOOD_BANKS_HOSPITALS before ADMIN_INTERVENTION. */
export const ESCALATION_ADMIN_FOLLOWUP_WINDOW_MS: Record<RequestUrgency, number | null> = {
  CRITICAL: 30 * 60 * 1000,
  HIGH: 2 * 60 * 60 * 1000,
  MODERATE: null,
};

export const ESCALATION_REASONS = ["NO_MATCH", "NO_RESPONSE", "ALL_DECLINED", "MANUAL"] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const EMERGENCY_EVENT_STATUSES = ["OPEN", "RESOLVED", "CANCELLED"] as const;
export type EmergencyEventStatus = (typeof EMERGENCY_EVENT_STATUSES)[number];

export const ORG_ESCALATION_RESPONSES = [
  "PENDING",
  "ACKNOWLEDGED",
  "CAN_SUPPLY",
  "CANNOT_HELP",
] as const;
export type OrgEscalationResponse = (typeof ORG_ESCALATION_RESPONSES)[number];

export const ORGANIZATION_TYPES = ["HOSPITAL", "BLOOD_BANK"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
