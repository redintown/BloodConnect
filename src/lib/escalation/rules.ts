import type { BloodRequestStatus, DonorResponseStatus, RequestUrgency } from "@/lib/constants/requestStatus";
import {
  ESCALATION_ADMIN_FOLLOWUP_WINDOW_MS,
  ESCALATION_DONOR_RESPONSE_WINDOW_MS,
  type EscalationReason,
} from "@/lib/escalation/constants";

const OPEN_FOR_ESCALATION: readonly BloodRequestStatus[] = ["MATCHING", "NO_MATCH_FOUND"];
const TERMINAL_STOP: readonly BloodRequestStatus[] = [
  "DONOR_ACCEPTED",
  "DONOR_ON_THE_WAY",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
];

export function isRequestOpenForEscalation(status: BloodRequestStatus): boolean {
  return (OPEN_FOR_ESCALATION as readonly string[]).includes(status);
}

export function isRequestTerminalForEscalation(status: BloodRequestStatus): boolean {
  return (TERMINAL_STOP as readonly string[]).includes(status);
}

export function hasAcceptedDonorMatch(
  matchStatuses: readonly DonorResponseStatus[] | readonly string[]
): boolean {
  return matchStatuses.some((status) => status === "ACCEPTED");
}

export function deriveEscalationReason(input: {
  matchCount: number;
  matchStatuses: readonly string[];
  manual: boolean;
}): EscalationReason {
  if (input.manual) return "MANUAL";
  if (input.matchCount === 0) return "NO_MATCH";
  const open = input.matchStatuses.filter((s) =>
    ["MATCHED", "NOTIFIED", "VIEWED"].includes(s)
  );
  const declinedOrExpired = input.matchStatuses.filter((s) =>
    ["DECLINED", "EXPIRED"].includes(s)
  );
  if (open.length === 0 && declinedOrExpired.length === input.matchStatuses.length) {
    return "ALL_DECLINED";
  }
  return "NO_RESPONSE";
}

/**
 * Earliest deadline among donor window end and optional request deadlines.
 * Returns null when automatic escalation is disabled for the urgency.
 */
export function computeDonorEscalationDueAt(input: {
  urgency: RequestUrgency;
  outreachStartedAt: Date;
  requiredBy: string | null | undefined;
  expiresAt: string | null | undefined;
  now?: Date;
}): Date | null {
  const windowMs = ESCALATION_DONOR_RESPONSE_WINDOW_MS[input.urgency];
  if (windowMs == null) return null;

  let due = new Date(input.outreachStartedAt.getTime() + windowMs);

  for (const raw of [input.requiredBy, input.expiresAt]) {
    if (!raw) continue;
    const cap = new Date(raw);
    if (!Number.isNaN(cap.getTime()) && cap.getTime() < due.getTime()) {
      due = cap;
    }
  }

  return due;
}

export function isDonorEscalationDue(input: {
  urgency: RequestUrgency;
  outreachStartedAt: Date;
  requiredBy: string | null | undefined;
  expiresAt: string | null | undefined;
  now?: Date;
}): boolean {
  const due = computeDonorEscalationDueAt(input);
  if (!due) return false;
  const now = input.now ?? new Date();
  return now.getTime() >= due.getTime();
}

export function isAdminFollowupDue(input: {
  urgency: RequestUrgency;
  orgEscalationTriggeredAt: Date;
  requiredBy: string | null | undefined;
  expiresAt: string | null | undefined;
  now?: Date;
}): boolean {
  const windowMs = ESCALATION_ADMIN_FOLLOWUP_WINDOW_MS[input.urgency];
  if (windowMs == null) return false;

  let due = new Date(input.orgEscalationTriggeredAt.getTime() + windowMs);
  for (const raw of [input.requiredBy, input.expiresAt]) {
    if (!raw) continue;
    const cap = new Date(raw);
    if (!Number.isNaN(cap.getTime()) && cap.getTime() < due.getTime()) {
      due = cap;
    }
  }

  const now = input.now ?? new Date();
  return now.getTime() >= due.getTime();
}

export function canRequesterEscalateNow(input: {
  isEmergency: boolean;
  status: BloodRequestStatus;
  hasAcceptedDonor: boolean;
  hasActiveEscalation: boolean;
}): boolean {
  if (!input.isEmergency) return false;
  if (!isRequestOpenForEscalation(input.status)) return false;
  if (input.hasAcceptedDonor) return false;
  if (input.hasActiveEscalation) return false;
  return true;
}
