import { AppError } from "@/lib/errors/AppError";
import type { BloodRequestStatus, DonorResponseStatus, RequestUrgency } from "@/lib/constants/requestStatus";
import type { DonorInboxMatch } from "@/types/domain";

/** Match statuses a donor may still accept or decline. */
export const RESPONDABLE_MATCH_STATUSES: readonly DonorResponseStatus[] = [
  "MATCHED",
  "NOTIFIED",
  "VIEWED",
];

const URGENCY_RANK: Record<RequestUrgency, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MODERATE: 2,
};

/** Match statuses that are terminal for donor response. */
export const TERMINAL_MATCH_STATUSES: readonly DonorResponseStatus[] = [
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
];

/** Open competing matches that expire when another donor accepts. */
export const EXPIREABLE_OPEN_MATCH_STATUSES: readonly DonorResponseStatus[] = [
  "MATCHED",
  "NOTIFIED",
  "VIEWED",
];

export function canDonorRespond(matchStatus: string): boolean {
  return (RESPONDABLE_MATCH_STATUSES as readonly string[]).includes(matchStatus);
}

export function isTerminalMatchStatus(matchStatus: string): boolean {
  return (TERMINAL_MATCH_STATUSES as readonly string[]).includes(matchStatus);
}

/** Request must still be MATCHING for accept/decline. */
export function canRespondToRequestStatus(requestStatus: BloodRequestStatus): boolean {
  return requestStatus === "MATCHING";
}

/**
 * Inbox rows that should trigger the donor portal match popup
 * (and Accept/Decline). Pure — safe for unit tests.
 */
export function isActionableDonorMatch(match: Pick<DonorInboxMatch, "matchStatus" | "request">): boolean {
  return canDonorRespond(match.matchStatus) && canRespondToRequestStatus(match.request.status);
}

/** Filter actionable matches for the donor dashboard popup. */
export function selectActionableDonorMatches(matches: DonorInboxMatch[]): DonorInboxMatch[] {
  return matches.filter(isActionableDonorMatch);
}

/**
 * Highest urgency first; emergency requests before normal; then soonest requiredBy;
 * then highest score. Used so a single popup shows the most important request.
 */
export function sortDonorMatchesByPopupPriority(matches: DonorInboxMatch[]): DonorInboxMatch[] {
  return [...matches].sort((a, b) => {
    const emergencyDiff = Number(b.request.isEmergency) - Number(a.request.isEmergency);
    if (emergencyDiff !== 0) return emergencyDiff;

    const urgencyDiff = URGENCY_RANK[a.request.urgency] - URGENCY_RANK[b.request.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    const aBy = a.request.requiredBy ? new Date(a.request.requiredBy).getTime() : Number.POSITIVE_INFINITY;
    const bBy = b.request.requiredBy ? new Date(b.request.requiredBy).getTime() : Number.POSITIVE_INFINITY;
    if (aBy !== bBy) return aBy - bBy;

    const aScore = a.score ?? Number.NEGATIVE_INFINITY;
    const bScore = b.score ?? Number.NEGATIVE_INFINITY;
    if (bScore !== aScore) return bScore - aScore;

    return a.matchId.localeCompare(b.matchId);
  });
}

export function shouldShowDonorMatchPopup(matches: DonorInboxMatch[]): boolean {
  return selectActionableDonorMatches(matches).length > 0;
}

/** Closing / "Maybe Later" never mutates match status — presentation only. */
export function closingPopupChangesMatchStatus(): boolean {
  return false;
}

export function canMarkDonorOnTheWay(
  requestStatus: BloodRequestStatus,
  matchStatus: string
): boolean {
  return requestStatus === "DONOR_ACCEPTED" && matchStatus === "ACCEPTED";
}

export function canConfirmDonationReceived(requestStatus: BloodRequestStatus): boolean {
  return requestStatus === "DONOR_ON_THE_WAY";
}

export function assertCanDonorRespond(
  matchStatus: string,
  requestStatus: BloodRequestStatus
): void {
  if (!canRespondToRequestStatus(requestStatus)) {
    throw AppError.conflict("This request can no longer accept a donor response.");
  }
  if (!canDonorRespond(matchStatus)) {
    throw AppError.conflict("This match can no longer be answered.");
  }
}

/** Maps Phase 5 RPC exception messages to AppError. */
export function mapDonorResponseRpcError(error: { message?: string } | null | undefined): AppError {
  const message = error?.message ?? "";
  if (message.includes("BC_UNAUTHORIZED")) {
    return AppError.unauthorized("You don't have permission to do that.");
  }
  if (message.includes("BC_NOT_FOUND")) {
    return AppError.notFound("Match or request not found.");
  }
  if (message.includes("BC_VALIDATION")) {
    return AppError.validation("Invalid input");
  }
  if (message.includes("BC_INELIGIBLE")) {
    return AppError.conflict("You are not currently eligible to donate.");
  }
  if (message.includes("BC_UNAVAILABLE")) {
    return AppError.conflict("Set yourself as available before accepting.");
  }
  if (message.includes("BC_INCOMPATIBLE")) {
    return AppError.conflict("Your blood group is not compatible with this request.");
  }
  if (message.includes("BC_MATCH_TERMINAL") || message.includes("BC_MATCH_NOT_ACCEPTED")) {
    return AppError.conflict("This match can no longer be answered.");
  }
  if (message.includes("BC_REQUEST_NOT_MATCHING") || message.includes("BC_INVALID_STATUS")) {
    return AppError.conflict("This request is not in a valid state for that action.");
  }
  if (message.includes("BC_NO_ACCEPTED_MATCH")) {
    return AppError.conflict("No accepted donor was found for this request.");
  }
  if (message.includes("BC_DUPLICATE_DONATION")) {
    return AppError.conflict("A donation has already been recorded for this request.");
  }
  return AppError.server(error);
}
