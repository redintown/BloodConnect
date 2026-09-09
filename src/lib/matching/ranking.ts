import type { BloodRequest } from "@/types/domain";
import type { MatchCandidateRow } from "@/lib/matching/criteria";
import {
  MATCH_MAX_CANDIDATES,
  MATCH_SEARCH_RADII_METERS,
  scoreMatchCandidate,
} from "@/lib/matching/scoring";

export type ScoredMatchCandidate = MatchCandidateRow & { score: number };

/**
 * Expanding radii 5→15→30 km; stop early at MAX candidates; never beyond 30 km.
 * Pure function — unit-tested without Supabase.
 */
export function selectRankedCandidates(
  request: BloodRequest,
  byRadius: Map<number, MatchCandidateRow[]>
): ScoredMatchCandidate[] {
  const seen = new Map<string, MatchCandidateRow>();

  for (const radius of MATCH_SEARCH_RADII_METERS) {
    const batch = byRadius.get(radius) ?? [];
    for (const candidate of batch) {
      if (!seen.has(candidate.donorId)) {
        seen.set(candidate.donorId, candidate);
      }
    }
    if (seen.size >= MATCH_MAX_CANDIDATES) break;
  }

  const scored = [...seen.values()].map((candidate) => ({
    ...candidate,
    score: scoreMatchCandidate({
      distanceMeters: candidate.distanceMeters,
      verificationStatus: candidate.verificationStatus,
      isAvailableAtNight: candidate.isAvailableAtNight,
      requestRequiredBy: request.requiredBy,
    }),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters;
    return a.donorId.localeCompare(b.donorId);
  });

  return scored.slice(0, MATCH_MAX_CANDIDATES);
}

/** Whether a re-run may refresh score/distance for this existing match status. */
export function canRefreshMatchRow(status: string): boolean {
  // Never revive EXPIRED (accept race) or touch terminal ACCEPTED/DECLINED.
  return status === "MATCHED" || status === "NOTIFIED" || status === "VIEWED";
}

/** Request statuses that may receive new/open match rows. */
export function canPersistMatchesForRequestStatus(status: string): boolean {
  return status === "PENDING" || status === "MATCHING" || status === "NO_MATCH_FOUND";
}

export const INITIAL_MATCH_STATUS = "MATCHED" as const;
