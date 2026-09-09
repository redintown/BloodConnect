import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireAuth, requireRole } from "@/services/authService";
import { createAdminClient } from "@/lib/supabase/server";
import { bloodRequestService } from "@/services/bloodRequestService";
import { mapDonorResponseRpcError } from "@/lib/matches/responseRules";
import type { BloodGroup } from "@/lib/constants/bloodGroups";
import type {
  BloodRequestStatus,
  DonorResponseStatus,
  RequestUrgency,
} from "@/lib/constants/requestStatus";
import type { AcceptedMatchContact, DonorInboxMatch } from "@/types/domain";

/**
 * Phase 5 donor response workflow. Consumes Phase 4 MATCHED rows.
 * Does not run matching and does not send notifications.
 */

export interface MatchResponseService {
  listMatchesForDonor(userId: string): Promise<DonorInboxMatch[]>;
  acceptMatch(matchId: string, userId: string): Promise<void>;
  declineMatch(matchId: string, userId: string): Promise<void>;
  markOnTheWay(matchId: string, userId: string): Promise<void>;
  getAcceptedMatchContact(matchId: string, viewerUserId: string): Promise<AcceptedMatchContact>;
}

async function resolveOwnDonorId(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("donor_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw AppError.server(error);
  if (!data) throw AppError.notFound("Complete your donor profile before responding to requests.");
  return (data as { id: string }).id;
}

export const matchResponseService: MatchResponseService = {
  async listMatchesForDonor(userId) {
    const user = await requireRole("DONOR");
    if (user.id !== userId) throw AppError.unauthorized("Unauthorized");

    const donorId = await resolveOwnDonorId(userId);
    const admin = createAdminClient();

    const { data: matches, error } = await admin
      .from("blood_request_matches")
      .select("id, blood_request_id, donor_id, score, distance_meters, status, notified_at, responded_at, created_at")
      .eq("donor_id", donorId)
      .order("created_at", { ascending: false });

    if (error) throw AppError.server(error);

    const rows =
      (matches as
        | {
            id: string;
            blood_request_id: string;
            donor_id: string;
            score: number | null;
            distance_meters: number | null;
            status: DonorResponseStatus;
            notified_at: string | null;
            responded_at: string | null;
            created_at: string;
          }[]
        | null) ?? [];

    if (rows.length === 0) return [];

    const requestIds = [...new Set(rows.map((row) => row.blood_request_id))];
    const { data: requests, error: requestError } = await admin
      .from("blood_requests")
      .select(
        "id, blood_group, quantity_units, urgency, required_by, hospital_name_freeform, status, contact_name, contact_phone, is_emergency"
      )
      .in("id", requestIds);

    if (requestError) throw AppError.server(requestError);

    type RequestJoin = {
      id: string;
      blood_group: BloodGroup;
      quantity_units: number;
      urgency: RequestUrgency;
      required_by: string | null;
      hospital_name_freeform: string | null;
      status: BloodRequestStatus;
      contact_name: string;
      contact_phone: string;
      is_emergency: boolean | null;
    };

    const requestMap = new Map(((requests as RequestJoin[] | null) ?? []).map((r) => [r.id, r]));

    const { data: emergencyNotes, error: noteError } = await admin
      .from("notifications")
      .select("id, blood_request_id, match_id")
      .eq("recipient_id", userId)
      .eq("kind", "EMERGENCY_RESPONSE")
      .eq("channel", "IN_APP")
      .in("blood_request_id", requestIds);

    if (noteError) throw AppError.server(noteError);

    const emergencyByMatch = new Map(
      (
        (emergencyNotes as
          | { id: string; blood_request_id: string; match_id: string | null }[]
          | null) ?? []
      )
        .filter((n) => n.match_id)
        .map((n) => [n.match_id as string, n.id])
    );

    const inbox: DonorInboxMatch[] = [];
    for (const row of rows) {
      const request = requestMap.get(row.blood_request_id);
      if (!request) continue;
      inbox.push({
        matchId: row.id,
        bloodRequestId: row.blood_request_id,
        donorId: row.donor_id,
        matchStatus: row.status,
        score: row.score != null ? Number(row.score) : null,
        distanceMeters: row.distance_meters != null ? Number(row.distance_meters) : null,
        respondedAt: row.responded_at,
        emergencyNotificationId: emergencyByMatch.get(row.id) ?? null,
        request: {
          bloodGroup: request.blood_group,
          quantityUnits: request.quantity_units,
          urgency: request.urgency,
          requiredBy: request.required_by,
          hospitalNameFreeform: request.hospital_name_freeform,
          status: request.status,
          isEmergency: Boolean(request.is_emergency),
        },
      });
    }

    return inbox;
  },

  async acceptMatch(matchId, userId) {
    const user = await requireRole("DONOR");
    if (user.id !== userId) throw AppError.unauthorized("Unauthorized");
    await bloodRequestService.markDonorAccepted(matchId, userId);

    // Phase 7: donor acceptance wins — stop any open escalation.
    // On failure, force-reconcile so OPEN does not linger on a terminal request.
    try {
      const admin = createAdminClient();
      const { data: match } = await admin
        .from("blood_request_matches")
        .select("blood_request_id")
        .eq("id", matchId)
        .maybeSingle();
      const requestId = (match as { blood_request_id: string } | null)?.blood_request_id;
      if (requestId) {
        const { escalationService } = await import("@/services/escalationService");
        try {
          await escalationService.resolveEscalation(requestId, "DONOR_ACCEPTED");
        } catch (error) {
          console.error("[matchResponseService] resolveEscalation after accept failed", error);
          await escalationService.reconcileTerminalEscalations([requestId]);
        }
      }
    } catch (error) {
      console.error("[matchResponseService] escalation close after accept failed", error);
    }
  },

  async declineMatch(matchId, userId) {
    const user = await requireRole("DONOR");
    if (user.id !== userId) throw AppError.unauthorized("Unauthorized");

    const admin = createAdminClient();
    const { error } = await admin.rpc("decline_blood_request_match", {
      p_match_id: matchId,
      p_donor_user_id: userId,
    });

    if (error) throw mapDonorResponseRpcError(error);
  },

  async markOnTheWay(matchId, userId) {
    const user = await requireRole("DONOR");
    if (user.id !== userId) throw AppError.unauthorized("Unauthorized");
    await bloodRequestService.markDonorOnTheWay(matchId, userId);
  },

  async getAcceptedMatchContact(matchId, viewerUserId) {
    const user = await requireAuth();
    if (user.id !== viewerUserId) throw AppError.unauthorized("Unauthorized");

    const admin = createAdminClient();
    const { data: match, error } = await admin
      .from("blood_request_matches")
      .select("id, blood_request_id, donor_id, status, distance_meters")
      .eq("id", matchId)
      .maybeSingle();

    if (error) throw AppError.server(error);
    if (!match) throw AppError.notFound("Match not found.");

    const matchRow = match as {
      id: string;
      blood_request_id: string;
      donor_id: string;
      status: string;
      distance_meters: number | null;
    };

    if (matchRow.status !== "ACCEPTED") {
      throw AppError.unauthorized("Contact is only available after a donor accepts.");
    }

    const { data: request, error: requestError } = await admin
      .from("blood_requests")
      .select(
        "id, requester_id, blood_group, quantity_units, urgency, hospital_name_freeform, contact_name, contact_phone, status, notes, required_by"
      )
      .eq("id", matchRow.blood_request_id)
      .maybeSingle();

    if (requestError) throw AppError.server(requestError);
    if (!request) throw AppError.notFound("Request not found.");

    const requestRow = request as {
      id: string;
      requester_id: string;
      blood_group: BloodGroup;
      quantity_units: number;
      urgency: RequestUrgency;
      hospital_name_freeform: string | null;
      contact_name: string;
      contact_phone: string;
      status: BloodRequestStatus;
      notes: string | null;
      required_by: string | null;
    };

    const { data: donor, error: donorError } = await admin
      .from("donor_profiles")
      .select("id, user_id, blood_group")
      .eq("id", matchRow.donor_id)
      .maybeSingle();

    if (donorError) throw AppError.server(donorError);
    if (!donor) throw AppError.notFound("Donor not found.");

    const donorRow = donor as { id: string; user_id: string; blood_group: BloodGroup };

    const isRequester = requestRow.requester_id === viewerUserId;
    const isAcceptedDonor = donorRow.user_id === viewerUserId;
    if (!isRequester && !isAcceptedDonor) {
      throw AppError.unauthorized("You don't have permission to view this contact.");
    }

    const { data: donorProfile, error: profileError } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", donorRow.user_id)
      .maybeSingle();

    if (profileError) throw AppError.server(profileError);
    const profileRow = (donorProfile as { full_name: string; phone: string | null } | null) ?? null;

    const contact: AcceptedMatchContact = {
      matchId: matchRow.id,
      bloodRequestId: requestRow.id,
      requestStatus: requestRow.status,
      matchStatus: "ACCEPTED",
    };

    if (isRequester) {
      contact.donor = {
        name: profileRow?.full_name ?? "Donor",
        phone: profileRow?.phone ?? null,
        bloodGroup: donorRow.blood_group,
        distanceKm:
          matchRow.distance_meters != null ? Number(matchRow.distance_meters) / 1000 : null,
      };
    }

    if (isAcceptedDonor) {
      contact.request = {
        contactName: requestRow.contact_name,
        contactPhone: requestRow.contact_phone,
        hospitalNameFreeform: requestRow.hospital_name_freeform,
        bloodGroup: requestRow.blood_group,
        quantityUnits: requestRow.quantity_units,
        urgency: requestRow.urgency,
        requiredBy: requestRow.required_by,
        notes: requestRow.notes,
      };
    }

    return contact;
  },
};
