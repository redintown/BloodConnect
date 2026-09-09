import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireAuth } from "@/services/authService";
import { createAdminClient } from "@/lib/supabase/server";
import { bloodRequestService } from "@/services/bloodRequestService";
import { notificationService } from "@/services/notificationService";
import { isCompatible } from "@/lib/matching/compatibility";
import {
  EMERGENCY_SEARCH_MAX_METERS,
  passesEmergencyCandidateCriteria,
  type EmergencyCandidateRow,
} from "@/lib/matching/emergencyCriteria";
import { canPersistMatchesForRequestStatus, canRefreshMatchRow, INITIAL_MATCH_STATUS } from "@/lib/matching/ranking";
import { assertOwnsRequest } from "@/lib/requests/statusRules";
import { BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import { toCoarseDistanceBandKm } from "@/lib/matching/distancePrivacy";
import type { VerificationStatus } from "@/lib/constants/verification";
import type { BloodRequest } from "@/types/domain";

/**
 * Phase 6 Emergency Response orchestration.
 * Separate from Phase 4 matching — does not require is_available.
 * Does not implement Phase 7 escalation.
 */

interface RpcEmergencyCandidate {
  donor_id: string;
  user_id: string;
  blood_group: BloodGroup;
  is_eligible: boolean;
  verification_status: VerificationStatus;
  is_available: boolean;
  emergency_response_enabled: boolean;
  emergency_radius_km: number;
  distance_meters: number;
}

interface ExistingMatchRow {
  id: string;
  donor_id: string;
  status: string;
}

export interface EmergencyRunResult {
  candidateCount: number;
  notifiedCount: number;
}

export interface EmergencyResponseService {
  runForRequest(requestId: string, requesterId: string): Promise<EmergencyRunResult>;
}

function toCandidate(row: RpcEmergencyCandidate): EmergencyCandidateRow {
  return {
    donorId: row.donor_id,
    userId: row.user_id,
    bloodGroup: row.blood_group,
    isEligible: row.is_eligible,
    verificationStatus: row.verification_status,
    isAvailable: row.is_available,
    emergencyResponseEnabled: row.emergency_response_enabled,
    emergencyRadiusKm: Number(row.emergency_radius_km),
    distanceMeters: Number(row.distance_meters),
  };
}

function safeEmergencyPayload(request: BloodRequest, distanceMeters: number) {
  return {
    bloodGroup: request.bloodGroup,
    bloodGroupLabel: BLOOD_GROUP_LABELS[request.bloodGroup],
    quantityUnits: request.quantityUnits,
    urgency: request.urgency,
    hospitalName: request.hospitalNameFreeform,
    requiredBy: request.requiredBy,
    approximateDistanceKm: toCoarseDistanceBandKm(distanceMeters),
    isEmergency: true,
  };
}

async function findCandidates(request: BloodRequest): Promise<EmergencyCandidateRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("find_emergency_response_candidates", {
    p_lat: request.location.latitude,
    p_lng: request.location.longitude,
    p_requester_id: request.requesterId,
    p_max_radius_meters: EMERGENCY_SEARCH_MAX_METERS,
  });

  if (error) throw AppError.server(error);

  return ((data as RpcEmergencyCandidate[] | null) ?? [])
    .map(toCandidate)
    .filter((candidate) =>
      passesEmergencyCandidateCriteria(candidate, request.bloodGroup, request.requesterId)
    )
    // Defense in depth: compatibility already in filter, keep explicit.
    .filter((candidate) => isCompatible(candidate.bloodGroup, request.bloodGroup));
}

async function upsertEmergencyMatches(
  requestId: string,
  candidates: EmergencyCandidateRow[]
): Promise<Array<{ matchId: string; candidate: EmergencyCandidateRow }>> {
  const admin = createAdminClient();

  const { data: requestRow, error: requestError } = await admin
    .from("blood_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) throw AppError.server(requestError);
  if (!requestRow || !canPersistMatchesForRequestStatus((requestRow as { status: string }).status)) {
    return [];
  }

  const { data: existing, error: readError } = await admin
    .from("blood_request_matches")
    .select("id, donor_id, status")
    .eq("blood_request_id", requestId);

  if (readError) throw AppError.server(readError);

  const existingByDonor = new Map(
    ((existing as ExistingMatchRow[] | null) ?? []).map((row) => [row.donor_id, row])
  );

  const results: Array<{ matchId: string; candidate: EmergencyCandidateRow }> = [];

  for (const candidate of candidates) {
    const { data: liveRequest, error: liveError } = await admin
      .from("blood_requests")
      .select("status")
      .eq("id", requestId)
      .maybeSingle();
    if (liveError) throw AppError.server(liveError);
    if (!liveRequest || !canPersistMatchesForRequestStatus((liveRequest as { status: string }).status)) {
      return results;
    }

    const prior = existingByDonor.get(candidate.donorId);

    if (prior) {
      if (["ACCEPTED", "DECLINED", "EXPIRED"].includes(prior.status)) {
        continue;
      }

      // Reuse open Phase 4/5 rows without resetting an already-notified match.
      if (["MATCHED", "NOTIFIED", "VIEWED"].includes(prior.status)) {
        const { error } = await admin
          .from("blood_request_matches")
          .update({
            distance_meters: candidate.distanceMeters,
          })
          .eq("id", prior.id)
          .eq("blood_request_id", requestId)
          .in("status", ["MATCHED", "NOTIFIED", "VIEWED"]);
        if (error) {
          if ((error.message ?? "").includes("BC_REQUEST_TERMINAL")) return results;
          throw AppError.server(error);
        }
        results.push({ matchId: prior.id, candidate });
        continue;
      }

      if (!canRefreshMatchRow(prior.status)) {
        continue;
      }

      const { error } = await admin
        .from("blood_request_matches")
        .update({
          distance_meters: candidate.distanceMeters,
          status: INITIAL_MATCH_STATUS,
          notified_at: null,
          responded_at: null,
        })
        .eq("id", prior.id)
        .eq("blood_request_id", requestId)
        .in("status", ["MATCHED", "NOTIFIED", "VIEWED"]);
      if (error) {
        if ((error.message ?? "").includes("BC_REQUEST_TERMINAL")) return results;
        throw AppError.server(error);
      }
      results.push({ matchId: prior.id, candidate });
      continue;
    }

    const { data, error } = await admin
      .from("blood_request_matches")
      .insert({
        blood_request_id: requestId,
        donor_id: candidate.donorId,
        score: null,
        distance_meters: candidate.distanceMeters,
        status: INITIAL_MATCH_STATUS,
        notified_at: null,
        responded_at: null,
      })
      .select("id")
      .single();

    if (error) {
      // Unique (blood_request_id, donor_id) race: reload and reuse.
      if (error.code === "23505") {
        const { data: again, error: againError } = await admin
          .from("blood_request_matches")
          .select("id, status")
          .eq("blood_request_id", requestId)
          .eq("donor_id", candidate.donorId)
          .maybeSingle();
        if (againError) throw AppError.server(againError);
        if (again && ["MATCHED", "NOTIFIED", "VIEWED"].includes((again as { status: string }).status)) {
          results.push({ matchId: (again as { id: string }).id, candidate });
        }
        continue;
      }
      if ((error.message ?? "").includes("BC_REQUEST_TERMINAL")) return results;
      throw AppError.server(error);
    }

    results.push({ matchId: (data as { id: string }).id, candidate });
  }

  return results;
}

async function notifyEmergencyMatches(
  request: BloodRequest,
  rows: Array<{ matchId: string; candidate: EmergencyCandidateRow }>
): Promise<number> {
  const admin = createAdminClient();
  let notified = 0;

  for (const { matchId, candidate } of rows) {
    await notificationService.notify(
      {
        recipientId: candidate.userId,
        bloodRequestId: request.id,
        matchId,
        kind: "EMERGENCY_RESPONSE",
        title: "Emergency blood request",
        body: `${BLOOD_GROUP_LABELS[request.bloodGroup]} urgently needed nearby.`,
        data: safeEmergencyPayload(request, candidate.distanceMeters),
      },
      "IN_APP"
    );

    const now = new Date().toISOString();
    const { error } = await admin
      .from("blood_request_matches")
      .update({ status: "NOTIFIED", notified_at: now })
      .eq("id", matchId)
      .in("status", ["MATCHED", "NOTIFIED"]);

    if (error) throw AppError.server(error);
    notified += 1;
  }

  return notified;
}

export const emergencyResponseService: EmergencyResponseService = {
  async runForRequest(requestId, requesterId) {
    const user = await requireAuth();
    assertOwnsRequest(user.id, requesterId);

    const request = await bloodRequestService.getById(requestId);
    if (!request) throw AppError.notFound("Request not found.");
    assertOwnsRequest(request.requesterId, requesterId);

    if (!request.isEmergency) {
      return { candidateCount: 0, notifiedCount: 0 };
    }

    const candidates = await findCandidates(request);
    if (candidates.length === 0) {
      return { candidateCount: 0, notifiedCount: 0 };
    }

    // Ensure request is MATCHING so Phase 5 accept path works.
    if (request.status === "PENDING" || request.status === "NO_MATCH_FOUND") {
      await bloodRequestService.markMatching(requestId);
    }

    const persisted = await upsertEmergencyMatches(requestId, candidates);
    const notifiedCount = await notifyEmergencyMatches(request, persisted);

    return { candidateCount: candidates.length, notifiedCount };
  },
};
