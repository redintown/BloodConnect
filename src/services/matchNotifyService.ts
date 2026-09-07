import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { createAdminClient } from "@/lib/supabase/server";
import { bloodRequestService } from "@/services/bloodRequestService";
import {
  notificationService,
  type NotificationPayload,
} from "@/services/notificationService";
import { BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import type { BloodRequest } from "@/types/domain";

/**
 * Post-match notification orchestration (Phase 6).
 * Kept outside matchingService so Phase 4 algorithm stays notification-free.
 */

interface MatchNotifyRow {
  id: string;
  donor_id: string;
  status: string;
  distance_meters: number | null;
  notified_at: string | null;
}

interface DonorUserRow {
  id: string;
  user_id: string;
}

function safeMatchPayload(request: BloodRequest, distanceMeters: number | null) {
  return {
    bloodGroup: request.bloodGroup,
    bloodGroupLabel: BLOOD_GROUP_LABELS[request.bloodGroup as BloodGroup] ?? request.bloodGroup,
    quantityUnits: request.quantityUnits,
    urgency: request.urgency,
    hospitalName: request.hospitalNameFreeform,
    requiredBy: request.requiredBy,
    approximateDistanceKm:
      distanceMeters != null ? Math.round((distanceMeters / 1000) * 10) / 10 : null,
    isEmergency: request.isEmergency,
  };
}

export async function notifyMatchedDonorsForRequest(
  requestId: string,
  requesterId: string
): Promise<number> {
  const request = await bloodRequestService.getById(requestId);
  if (!request) throw AppError.notFound("Request not found.");
  if (request.requesterId !== requesterId) {
    throw AppError.unauthorized("Unauthorized");
  }

  const admin = createAdminClient();
  const { data: matches, error } = await admin
    .from("blood_request_matches")
    .select("id, donor_id, status, distance_meters, notified_at")
    .eq("blood_request_id", requestId)
    .eq("status", "MATCHED");

  if (error) throw AppError.server(error);

  const rows = (matches as MatchNotifyRow[] | null) ?? [];
  if (rows.length === 0) return 0;

  const donorIds = rows.map((row) => row.donor_id);
  const { data: donors, error: donorError } = await admin
    .from("donor_profiles")
    .select("id, user_id")
    .in("id", donorIds);

  if (donorError) throw AppError.server(donorError);

  const donorMap = new Map(
    ((donors as DonorUserRow[] | null) ?? []).map((d) => [d.id, d.user_id])
  );

  const payloads: NotificationPayload[] = [];
  const toMarkNotified: string[] = [];

  for (const row of rows) {
    const recipientId = donorMap.get(row.donor_id);
    if (!recipientId) continue;

    payloads.push({
      recipientId,
      bloodRequestId: requestId,
      matchId: row.id,
      kind: "MATCH_NOTIFY",
      title: "Blood request match",
      body: `${BLOOD_GROUP_LABELS[request.bloodGroup]} needed nearby — tap to respond.`,
      data: safeMatchPayload(request, row.distance_meters),
    });
    toMarkNotified.push(row.id);
  }

  await notificationService.notifyBatch(payloads, "IN_APP");

  if (toMarkNotified.length > 0) {
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("blood_request_matches")
      .update({ status: "NOTIFIED", notified_at: now })
      .in("id", toMarkNotified)
      .eq("blood_request_id", requestId)
      .eq("status", "MATCHED");

    if (updateError) throw AppError.server(updateError);
  }

  return toMarkNotified.length;
}
