import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireAuth } from "@/services/authService";
import { createAdminClient } from "@/lib/supabase/server";
import { bloodRequestService } from "@/services/bloodRequestService";
import { isCompatible } from "@/lib/matching/compatibility";
import {
  passesHardMatchingCriteria,
  type MatchCandidateRow,
} from "@/lib/matching/criteria";
import { MATCH_MAX_CANDIDATES, MATCH_SEARCH_RADII_METERS } from "@/lib/matching/scoring";
import {
  canPersistMatchesForRequestStatus,
  canRefreshMatchRow,
  INITIAL_MATCH_STATUS,
  selectRankedCandidates,
} from "@/lib/matching/ranking";
import { toCoarseDistanceBandKm } from "@/lib/matching/distancePrivacy";
import { assertOwnsRequest, canRunMatching } from "@/lib/requests/statusRules";
import type { BloodGroup } from "@/lib/constants/bloodGroups";
import type { VerificationStatus } from "@/lib/constants/verification";
import type { BloodRequest, DonorPublicSummary } from "@/types/domain";

/**
 * Matching engine: who is a good match — not how to reach them.
 * Persistence uses the service-role client; never writes notifications.
 */

interface RpcCandidate {
  donor_id: string;
  blood_group: BloodGroup;
  is_eligible: boolean;
  verification_status: VerificationStatus;
  is_available: boolean;
  is_available_at_night: boolean;
  distance_meters: number;
}

interface ExistingMatchRow {
  id: string;
  donor_id: string;
  status: string;
}

export interface MatchingService {
  isCompatible(donorBloodGroup: BloodGroup, recipientBloodGroup: BloodGroup): boolean;
  /** Ranked public summaries only (no persistence). */
  matchDonors(request: BloodRequest): Promise<DonorPublicSummary[]>;
  /**
   * Owner-triggered matching: find, score, persist MATCHED rows, update request status.
   */
  runMatchingForRequest(requestId: string, requesterId: string): Promise<DonorPublicSummary[]>;
  /** Owner-readable ranked matches already stored for a request. */
  listMatchesForRequester(requestId: string, requesterId: string): Promise<DonorPublicSummary[]>;
}

function toCandidate(row: RpcCandidate): MatchCandidateRow {
  return {
    donorId: row.donor_id,
    bloodGroup: row.blood_group,
    isEligible: row.is_eligible,
    verificationStatus: row.verification_status,
    isAvailable: row.is_available,
    isAvailableAtNight: row.is_available_at_night,
    distanceMeters: Number(row.distance_meters),
    locationPresent: true,
  };
}

function toPublicSummary(
  candidate: MatchCandidateRow,
  distanceMeters: number
): DonorPublicSummary {
  return {
    id: candidate.donorId,
    bloodGroup: candidate.bloodGroup,
    isAvailable: candidate.isAvailable,
    isAvailableAtNight: candidate.isAvailableAtNight,
    verificationStatus: candidate.verificationStatus,
    // Coarse band only — exact meters used for ranking stay server-side.
    distanceKm: toCoarseDistanceBandKm(distanceMeters),
  };
}

async function fetchCandidatesAtRadius(
  request: BloodRequest,
  radiusMeters: number
): Promise<MatchCandidateRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("find_nearby_match_candidates", {
    p_lat: request.location.latitude,
    p_lng: request.location.longitude,
    p_requester_id: request.requesterId,
    p_radius_meters: radiusMeters,
  });

  if (error) throw AppError.server(error);

  return ((data as RpcCandidate[] | null) ?? [])
    .map(toCandidate)
    .filter((candidate) =>
      passesHardMatchingCriteria(candidate, request.bloodGroup, request.requesterId)
    );
}

/**
 * Expanding radii 5→15→30 km; stop early at MAX candidates; never beyond 30 km.
 */
async function collectCandidates(request: BloodRequest): Promise<ReturnType<typeof selectRankedCandidates>> {
  const byRadius = new Map<number, MatchCandidateRow[]>();

  for (const radius of MATCH_SEARCH_RADII_METERS) {
    const rows = await fetchCandidatesAtRadius(request, radius);
    byRadius.set(radius, rows);
    const unique = new Set<string>();
    for (const list of byRadius.values()) {
      for (const row of list) unique.add(row.donorId);
    }
    if (unique.size >= MATCH_MAX_CANDIDATES) break;
  }

  return selectRankedCandidates(request, byRadius);
}

function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

function isTerminalMatchGuardError(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = error?.message ?? "";
  return message.includes("BC_REQUEST_TERMINAL");
}

async function persistMatches(
  requestId: string,
  ranked: Array<MatchCandidateRow & { score: number }>
): Promise<void> {
  const admin = createAdminClient();

  // Phase 10B: skip persistence if request is already terminal/accepted.
  const { data: requestRow, error: requestError } = await admin
    .from("blood_requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) throw AppError.server(requestError);
  if (!requestRow) throw AppError.notFound("Request not found.");
  if (!canPersistMatchesForRequestStatus((requestRow as { status: string }).status)) {
    return;
  }

  const { data: existing, error: readError } = await admin
    .from("blood_request_matches")
    .select("id, donor_id, status")
    .eq("blood_request_id", requestId);

  if (readError) throw AppError.server(readError);

  const existingByDonor = new Map(
    ((existing as ExistingMatchRow[] | null) ?? []).map((row) => [row.donor_id, row])
  );

  for (const candidate of ranked) {
    // Re-check before each write — closes late accept races mid-loop.
    const { data: liveRequest, error: liveError } = await admin
      .from("blood_requests")
      .select("status")
      .eq("id", requestId)
      .maybeSingle();
    if (liveError) throw AppError.server(liveError);
    if (!liveRequest || !canPersistMatchesForRequestStatus((liveRequest as { status: string }).status)) {
      return;
    }

    const prior = existingByDonor.get(candidate.donorId);
    if (prior && !canRefreshMatchRow(prior.status)) {
      continue;
    }

    if (prior) {
      const { error } = await admin
        .from("blood_request_matches")
        .update({
          score: candidate.score,
          distance_meters: candidate.distanceMeters,
          status: INITIAL_MATCH_STATUS,
        })
        .eq("id", prior.id)
        .eq("blood_request_id", requestId)
        .in("status", ["MATCHED", "NOTIFIED", "VIEWED"]);
      if (error) {
        if (isTerminalMatchGuardError(error)) return;
        throw AppError.server(error);
      }
    } else {
      const { error } = await admin.from("blood_request_matches").insert({
        blood_request_id: requestId,
        donor_id: candidate.donorId,
        score: candidate.score,
        distance_meters: candidate.distanceMeters,
        status: INITIAL_MATCH_STATUS,
        notified_at: null,
        responded_at: null,
      });
      if (error) {
        // Unique (blood_request_id, donor_id) race: concurrent matching — idempotent.
        if (isUniqueViolation(error)) continue;
        if (isTerminalMatchGuardError(error)) return;
        throw AppError.server(error);
      }
    }
  }
}

export const matchingService: MatchingService = {
  isCompatible,

  async matchDonors(request) {
    const ranked = await collectCandidates(request);
    return ranked.map((candidate) => toPublicSummary(candidate, candidate.distanceMeters));
  },

  async runMatchingForRequest(requestId, requesterId) {
    const user = await requireAuth();
    assertOwnsRequest(user.id, requesterId);

    const request = await bloodRequestService.getById(requestId);
    if (!request) throw AppError.notFound("Request not found.");
    assertOwnsRequest(request.requesterId, requesterId);

    if (!canRunMatching(request.status)) {
      throw AppError.conflict("This request cannot be matched in its current status.");
    }

    const ranked = await collectCandidates(request);
    await persistMatches(requestId, ranked);

    if (ranked.length > 0) {
      await bloodRequestService.markMatching(requestId);
    } else {
      await bloodRequestService.markNoMatchFound(requestId);
    }

    return ranked.map((candidate) => toPublicSummary(candidate, candidate.distanceMeters));
  },

  async listMatchesForRequester(requestId, requesterId) {
    const user = await requireAuth();
    assertOwnsRequest(user.id, requesterId);

    const request = await bloodRequestService.getById(requestId);
    if (!request) throw AppError.notFound("Request not found.");
    assertOwnsRequest(request.requesterId, requesterId);

    const admin = createAdminClient();
    const { data: matches, error } = await admin
      .from("blood_request_matches")
      .select("id, donor_id, distance_meters, score, status")
      .eq("blood_request_id", requestId)
      .order("score", { ascending: false });

    if (error) throw AppError.server(error);

    const rows =
      (matches as
        | { id: string; donor_id: string; distance_meters: number | null; score: number | null; status: string }[]
        | null) ?? [];
    if (rows.length === 0) return [];

    const donorIds = rows.map((row) => row.donor_id);
    const { data: donors, error: donorError } = await admin
      .from("donor_profiles")
      .select("id, blood_group, verification_status, donor_availability(is_available, is_available_at_night)")
      .in("id", donorIds);

    if (donorError) throw AppError.server(donorError);

    type DonorJoin = {
      id: string;
      blood_group: BloodGroup;
      verification_status: VerificationStatus;
      donor_availability:
        | { is_available: boolean; is_available_at_night: boolean }
        | { is_available: boolean; is_available_at_night: boolean }[]
        | null;
    };

    const donorMap = new Map(((donors as DonorJoin[] | null) ?? []).map((d) => [d.id, d]));

    const summaries: DonorPublicSummary[] = [];
    for (const row of rows) {
      const donor = donorMap.get(row.donor_id);
      if (!donor) continue;
      const availabilityRaw = donor.donor_availability;
      const availability = Array.isArray(availabilityRaw) ? availabilityRaw[0] : availabilityRaw;
      summaries.push({
        id: donor.id,
        bloodGroup: donor.blood_group,
        isAvailable: availability?.is_available ?? false,
        isAvailableAtNight: availability?.is_available_at_night ?? false,
        verificationStatus: donor.verification_status,
        distanceKm:
          row.distance_meters != null ? toCoarseDistanceBandKm(Number(row.distance_meters)) : null,
        matchId: row.id,
        matchStatus: row.status as DonorPublicSummary["matchStatus"],
      });
    }

    return summaries;
  },
};
