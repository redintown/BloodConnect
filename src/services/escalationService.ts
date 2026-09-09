import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireAuth, requireRole } from "@/services/authService";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notificationService } from "@/services/notificationService";
import { hospitalService } from "@/services/hospitalService";
import { bloodBankService } from "@/services/bloodBankService";
import { BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";
import type { EscalationLevel } from "@/lib/constants/verification";
import type {
  BloodRequestStatus,
  DonorResponseStatus,
  RequestUrgency,
} from "@/lib/constants/requestStatus";
import {
  ESCALATION_ORG_SEARCH_RADIUS_METERS,
  type EscalationReason,
  type OrganizationType,
  type OrgEscalationResponse,
} from "@/lib/escalation/constants";
import {
  canRequesterEscalateNow,
  deriveEscalationReason,
  hasAcceptedDonorMatch,
  isAdminFollowupDue,
  isDonorEscalationDue,
  isRequestOpenForEscalation,
  isRequestTerminalForEscalation,
} from "@/lib/escalation/rules";
import type { EmergencyEvent, EmergencyEventTarget } from "@/types/domain";

interface RequestEscalationRow {
  id: string;
  requester_id: string;
  blood_group: string;
  quantity_units: number;
  urgency: RequestUrgency;
  required_by: string | null;
  hospital_name_freeform: string | null;
  status: BloodRequestStatus;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_emergency: boolean;
}

interface MatchStatusRow {
  status: DonorResponseStatus;
  notified_at: string | null;
  created_at: string;
}

interface OrgRpcRow {
  organization_type: OrganizationType;
  organization_id: string;
  user_id: string;
  name: string;
  distance_meters: number;
}

interface EventRow {
  id: string;
  blood_request_id: string;
  level: EscalationLevel;
  status: EmergencyEvent["status"];
  triggered_at: string;
  resolved_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

export interface EscalationSummary {
  active: EmergencyEvent | null;
  history: EmergencyEvent[];
  targets: EmergencyEventTarget[];
  orgContactedCount: number;
  acknowledgedCount: number;
  canSupplyCount: number;
  canEscalateNow: boolean;
}

export interface EscalationService {
  shouldEscalate(requestId: string, options?: { manual?: boolean }): Promise<boolean>;
  triggerEscalation(
    requestId: string,
    options?: { manual?: boolean; actorUserId?: string }
  ): Promise<EmergencyEvent | null>;
  processDueEscalations(): Promise<{ processed: number; escalated: number; reconciled: number }>;
  resolveEscalation(requestId: string, reason: string): Promise<void>;
  cancelEscalation(requestId: string, reason: string): Promise<void>;
  /** Force-close OPEN escalations whose requests are already terminal. */
  reconcileTerminalEscalations(requestIds?: string[]): Promise<number>;
  getActiveEscalation(requestId: string): Promise<EmergencyEvent | null>;
  getEscalationSummary(requestId: string, viewerUserId: string): Promise<EscalationSummary>;
  listInboxForOrganization(
    organizationType: OrganizationType
  ): Promise<
    Array<{
      target: EmergencyEventTarget;
      event: EmergencyEvent;
      request: {
        id: string;
        bloodGroup: string;
        quantityUnits: number;
        urgency: RequestUrgency;
        isEmergency: boolean;
        requiredBy: string | null;
        hospitalNameFreeform: string | null;
        status: BloodRequestStatus;
      };
    }>
  >;
  respondAsOrganization(
    targetId: string,
    response: Exclude<OrgEscalationResponse, "PENDING">,
    notes?: string | null
  ): Promise<void>;
  listAdminOpenEscalations(): Promise<
    Array<{ event: EmergencyEvent; requestStatus: BloodRequestStatus; bloodGroup: string }>
  >;
}

function toEvent(row: EventRow): EmergencyEvent {
  return {
    id: row.id,
    bloodRequestId: row.blood_request_id,
    level: row.level,
    status: row.status,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at,
    notes: row.notes,
    metadata: row.metadata ?? {},
  };
}

async function loadRequest(admin: ReturnType<typeof createAdminClient>, requestId: string) {
  const { data, error } = await admin
    .from("blood_requests")
    .select(
      "id, requester_id, blood_group, quantity_units, urgency, required_by, hospital_name_freeform, status, created_at, updated_at, expires_at, is_emergency"
    )
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw AppError.server(error);
  return (data as RequestEscalationRow | null) ?? null;
}

async function loadMatchStatuses(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string
): Promise<MatchStatusRow[]> {
  const { data, error } = await admin
    .from("blood_request_matches")
    .select("status, notified_at, created_at")
    .eq("blood_request_id", requestId);
  if (error) throw AppError.server(error);
  return (data as MatchStatusRow[] | null) ?? [];
}

async function loadActiveEvent(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string
): Promise<EmergencyEvent | null> {
  const { data, error } = await admin
    .from("emergency_events")
    .select("id, blood_request_id, level, status, triggered_at, resolved_at, notes, metadata")
    .eq("blood_request_id", requestId)
    .eq("status", "OPEN")
    .in("level", ["BLOOD_BANKS_HOSPITALS", "ADMIN_INTERVENTION"])
    .maybeSingle();
  if (error) throw AppError.server(error);
  return data ? toEvent(data as EventRow) : null;
}

function outreachStartedAt(request: RequestEscalationRow, matches: MatchStatusRow[]): Date {
  const notified = matches
    .map((m) => m.notified_at)
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime());
  if (notified.length > 0) {
    return new Date(Math.min(...notified));
  }
  return new Date(request.updated_at || request.created_at);
}

function safeOrgPayload(
  request: RequestEscalationRow,
  distanceMeters: number | null,
  level: EscalationLevel
) {
  return {
    bloodGroup: request.blood_group,
    bloodGroupLabel: BLOOD_GROUP_LABELS[request.blood_group as keyof typeof BLOOD_GROUP_LABELS],
    quantityUnits: request.quantity_units,
    urgency: request.urgency,
    isEmergency: true,
    hospitalName: request.hospital_name_freeform,
    requiredBy: request.required_by,
    approximateDistanceKm:
      distanceMeters != null ? Math.round((distanceMeters / 1000) * 10) / 10 : null,
    escalationLevel: level,
    requestId: request.id,
  };
}

async function closeActiveEscalation(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string,
  status: "RESOLVED" | "CANCELLED",
  reason: string
): Promise<void> {
  const active = await loadActiveEvent(admin, requestId);
  if (!active) return;

  const { error } = await admin
    .from("emergency_events")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      metadata: {
        ...active.metadata,
        closeReason: reason,
      },
    })
    .eq("id", active.id)
    .eq("status", "OPEN");

  if (error) throw AppError.server(error);
}

async function notifyRequester(
  request: RequestEscalationRow,
  title: string,
  body: string,
  data: Record<string, unknown>,
  kind:
    | "ESCALATION_REQUESTER"
    | "ESCALATION_REQUESTER_ORG_RESPONSE"
    | "ESCALATION_REQUESTER_ADMIN" = "ESCALATION_REQUESTER"
): Promise<void> {
  await notificationService.notify(
    {
      recipientId: request.requester_id,
      bloodRequestId: request.id,
      kind,
      title,
      body,
      data,
    },
    "IN_APP"
  );
}

/**
 * Closes OPEN org/admin escalations when the linked request is already terminal.
 * Safety net for accept/cancel races and cron reconciliation.
 */
async function reconcileTerminalEscalations(
  admin: ReturnType<typeof createAdminClient>,
  requestIds?: string[]
): Promise<number> {
  let query = admin
    .from("emergency_events")
    .select("id, blood_request_id")
    .eq("status", "OPEN")
    .in("level", ["BLOOD_BANKS_HOSPITALS", "ADMIN_INTERVENTION"]);

  if (requestIds && requestIds.length > 0) {
    query = query.in("blood_request_id", requestIds);
  }

  const { data, error } = await query;
  if (error) throw AppError.server(error);

  const rows = (data as { id: string; blood_request_id: string }[] | null) ?? [];
  let closed = 0;
  for (const row of rows) {
    const request = await loadRequest(admin, row.blood_request_id);
    if (!request) continue;
    if (!isRequestTerminalForEscalation(request.status)) continue;
    const reason =
      request.status === "DONOR_ACCEPTED" || request.status === "DONOR_ON_THE_WAY"
        ? "DONOR_ACCEPTED"
        : request.status === "COMPLETED"
          ? "REQUEST_COMPLETED"
          : request.status === "CANCELLED"
            ? "REQUEST_CANCELLED"
            : "REQUEST_EXPIRED";
    await closeActiveEscalation(admin, row.blood_request_id, "RESOLVED", reason);
    closed += 1;
  }
  return closed;
}

async function assertCanCloseEscalation(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string
): Promise<void> {
  const request = await loadRequest(admin, requestId);
  if (!request) throw AppError.notFound("Request not found.");

  // System path after donor accept / cancel / complete / expire.
  if (isRequestTerminalForEscalation(request.status)) return;

  // Manual admin resolve/cancel while request still open.
  await requireRole("ADMIN");
}

async function createOrgEscalation(
  admin: ReturnType<typeof createAdminClient>,
  request: RequestEscalationRow,
  reason: EscalationReason,
  manual: boolean
): Promise<EmergencyEvent | null> {
  // Re-check under fresh read (race: donor accept / cancel).
  const fresh = await loadRequest(admin, request.id);
  if (!fresh) return null;
  if (!fresh.is_emergency) return null;
  if (!isRequestOpenForEscalation(fresh.status)) return null;

  const matches = await loadMatchStatuses(admin, request.id);
  if (hasAcceptedDonorMatch(matches.map((m) => m.status))) return null;

  const existing = await loadActiveEvent(admin, request.id);
  if (existing) return existing;

  const { data: orgs, error: orgError } = await admin.rpc("find_nearby_escalation_organizations", {
    p_request_id: request.id,
    p_radius_meters: ESCALATION_ORG_SEARCH_RADIUS_METERS,
  });
  if (orgError) throw AppError.server(orgError);

  const orgRows = (orgs as OrgRpcRow[] | null) ?? [];

  const { data: eventData, error: eventError } = await admin
    .from("emergency_events")
    .insert({
      blood_request_id: request.id,
      level: "BLOOD_BANKS_HOSPITALS",
      status: "OPEN",
      metadata: {
        reason,
        manual,
        organizationCount: orgRows.length,
      },
      notes: null,
    })
    .select("id, blood_request_id, level, status, triggered_at, resolved_at, notes, metadata")
    .single();

  if (eventError) {
    // Unique open-active index: concurrent create.
    if (eventError.code === "23505") {
      return loadActiveEvent(admin, request.id);
    }
    throw AppError.server(eventError);
  }

  const event = toEvent(eventData as EventRow);

  // Final guard before fan-out.
  const again = await loadRequest(admin, request.id);
  if (
    !again ||
    !isRequestOpenForEscalation(again.status) ||
    hasAcceptedDonorMatch((await loadMatchStatuses(admin, request.id)).map((m) => m.status))
  ) {
    await closeActiveEscalation(admin, request.id, "RESOLVED", "DONOR_OR_TERMINAL_BEFORE_NOTIFY");
    return null;
  }

  for (const org of orgRows) {
    const { data: target, error: targetError } = await admin
      .from("emergency_event_targets")
      .upsert(
        {
          emergency_event_id: event.id,
          organization_type: org.organization_type,
          organization_id: org.organization_id,
          status: "PENDING",
          distance_meters: org.distance_meters,
        },
        { onConflict: "emergency_event_id,organization_type,organization_id" }
      )
      .select("id")
      .maybeSingle();

    if (targetError) throw AppError.server(targetError);

    await notificationService.notify(
      {
        recipientId: org.user_id,
        bloodRequestId: request.id,
        kind: "ESCALATION_ORG",
        title: "Emergency blood request escalated",
        body: `${BLOOD_GROUP_LABELS[request.blood_group as keyof typeof BLOOD_GROUP_LABELS] ?? request.blood_group} needed — organization escalation.`,
        data: {
          ...safeOrgPayload(request, org.distance_meters, "BLOOD_BANKS_HOSPITALS"),
          targetId: (target as { id: string } | null)?.id ?? null,
          organizationType: org.organization_type,
          organizationId: org.organization_id,
          organizationName: org.name,
        },
      },
      "IN_APP"
    );
  }

  await notifyRequester(
    request,
    "Request escalated",
    orgRows.length > 0
      ? `Your emergency request was escalated to ${orgRows.length} nearby hospital${orgRows.length === 1 ? "" : "s"}/blood bank${orgRows.length === 1 ? "" : "s"}.`
      : "Your emergency request was escalated. No nearby verified organizations were found yet — an admin may follow up.",
    {
      escalationLevel: "BLOOD_BANKS_HOSPITALS",
      organizationCount: orgRows.length,
      reason,
    }
  );

  // If no orgs, leave OPEN so admin follow-up can pick it up.
  return event;
}

async function promoteToAdmin(
  admin: ReturnType<typeof createAdminClient>,
  request: RequestEscalationRow,
  prior: EmergencyEvent
): Promise<EmergencyEvent | null> {
  const fresh = await loadRequest(admin, request.id);
  if (!fresh || !fresh.is_emergency || !isRequestOpenForEscalation(fresh.status)) {
    return null;
  }
  const matches = await loadMatchStatuses(admin, request.id);
  if (hasAcceptedDonorMatch(matches.map((m) => m.status))) {
    await closeActiveEscalation(admin, request.id, "RESOLVED", "DONOR_ACCEPTED");
    return null;
  }

  // Close org stage, open admin stage (one OPEN at a time).
  await closeActiveEscalation(admin, request.id, "RESOLVED", "PROMOTED_TO_ADMIN");

  const { data: eventData, error } = await admin
    .from("emergency_events")
    .insert({
      blood_request_id: request.id,
      level: "ADMIN_INTERVENTION",
      status: "OPEN",
      metadata: {
        reason: "NO_RESPONSE",
        priorEventId: prior.id,
      },
    })
    .select("id, blood_request_id, level, status, triggered_at, resolved_at, notes, metadata")
    .single();

  if (error) {
    if (error.code === "23505") return loadActiveEvent(admin, request.id);
    throw AppError.server(error);
  }

  const event = toEvent(eventData as EventRow);

  const { data: admins, error: adminError } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "ADMIN");
  if (adminError) throw AppError.server(adminError);

  for (const row of (admins as { user_id: string }[] | null) ?? []) {
    await notificationService.notify(
      {
        recipientId: row.user_id,
        bloodRequestId: request.id,
        kind: "ESCALATION_ADMIN",
        title: "Admin escalation required",
        body: `Emergency request ${request.id.slice(0, 8)} needs admin intervention.`,
        data: safeOrgPayload(request, null, "ADMIN_INTERVENTION"),
      },
      "IN_APP"
    );
  }

  await notifyRequester(
    request,
    "Admin reviewing your request",
    "Nearby organizations have not resolved the emergency. An admin has been notified.",
    { escalationLevel: "ADMIN_INTERVENTION" },
    "ESCALATION_REQUESTER_ADMIN"
  );

  return event;
}

export const escalationService: EscalationService = {
  async shouldEscalate(requestId, options) {
    const admin = createAdminClient();
    const request = await loadRequest(admin, requestId);
    if (!request?.is_emergency) return false;
    if (!isRequestOpenForEscalation(request.status)) return false;

    const matches = await loadMatchStatuses(admin, requestId);
    if (hasAcceptedDonorMatch(matches.map((m) => m.status))) return false;

    const active = await loadActiveEvent(admin, requestId);
    if (active) return false;

    if (options?.manual) return true;

    return isDonorEscalationDue({
      urgency: request.urgency,
      outreachStartedAt: outreachStartedAt(request, matches),
      requiredBy: request.required_by,
      expiresAt: request.expires_at,
    });
  },

  async triggerEscalation(requestId, options) {
    const admin = createAdminClient();
    const request = await loadRequest(admin, requestId);
    if (!request) throw AppError.notFound("Request not found.");

    const manual = Boolean(options?.manual);
    if (manual) {
      const user = await requireAuth();
      if (request.requester_id !== user.id) {
        throw AppError.unauthorized("Unauthorized");
      }
      if (options?.actorUserId && options.actorUserId !== user.id) {
        throw AppError.unauthorized("Unauthorized");
      }
    }

    if (!request.is_emergency) {
      throw AppError.conflict("Only emergency requests can be escalated.");
    }
    if (isRequestTerminalForEscalation(request.status)) {
      throw AppError.conflict("This request can no longer be escalated.");
    }
    if (!isRequestOpenForEscalation(request.status)) {
      throw AppError.conflict("This request is not open for escalation.");
    }

    const matches = await loadMatchStatuses(admin, requestId);
    if (hasAcceptedDonorMatch(matches.map((m) => m.status))) {
      await closeActiveEscalation(admin, requestId, "RESOLVED", "DONOR_ACCEPTED");
      throw AppError.conflict("A donor has already accepted this request.");
    }

    const active = await loadActiveEvent(admin, requestId);
    if (active) return active;

    if (!manual) {
      const due = isDonorEscalationDue({
        urgency: request.urgency,
        outreachStartedAt: outreachStartedAt(request, matches),
        requiredBy: request.required_by,
        expiresAt: request.expires_at,
      });
      if (!due) return null;
    }

    const reason = deriveEscalationReason({
      matchCount: matches.length,
      matchStatuses: matches.map((m) => m.status),
      manual,
    });

    return createOrgEscalation(admin, request, reason, manual);
  },

  async processDueEscalations() {
    const admin = createAdminClient();
    const reconciled = await reconcileTerminalEscalations(admin);

    const { data, error } = await admin
      .from("blood_requests")
      .select(
        "id, requester_id, blood_group, quantity_units, urgency, required_by, hospital_name_freeform, status, created_at, updated_at, expires_at, is_emergency"
      )
      .eq("is_emergency", true)
      .in("status", ["MATCHING", "NO_MATCH_FOUND"]);

    if (error) throw AppError.server(error);

    const rows = (data as RequestEscalationRow[] | null) ?? [];
    let processed = 0;
    let escalated = 0;

    for (const request of rows) {
      processed += 1;
      const matches = await loadMatchStatuses(admin, request.id);
      if (hasAcceptedDonorMatch(matches.map((m) => m.status))) {
        await closeActiveEscalation(admin, request.id, "RESOLVED", "DONOR_ACCEPTED");
        continue;
      }

      const active = await loadActiveEvent(admin, request.id);

      if (!active) {
        if (
          isDonorEscalationDue({
            urgency: request.urgency,
            outreachStartedAt: outreachStartedAt(request, matches),
            requiredBy: request.required_by,
            expiresAt: request.expires_at,
          })
        ) {
          const event = await createOrgEscalation(
            admin,
            request,
            deriveEscalationReason({
              matchCount: matches.length,
              matchStatuses: matches.map((m) => m.status),
              manual: false,
            }),
            false
          );
          if (event) escalated += 1;
        }
        continue;
      }

      if (
        active.level === "BLOOD_BANKS_HOSPITALS" &&
        isAdminFollowupDue({
          urgency: request.urgency,
          orgEscalationTriggeredAt: new Date(active.triggeredAt),
          requiredBy: request.required_by,
          expiresAt: request.expires_at,
        })
      ) {
        const promoted = await promoteToAdmin(admin, request, active);
        if (promoted) escalated += 1;
      }
    }

    return { processed, escalated, reconciled };
  },

  async resolveEscalation(requestId, reason) {
    const admin = createAdminClient();
    await assertCanCloseEscalation(admin, requestId);
    await closeActiveEscalation(admin, requestId, "RESOLVED", reason);
  },

  async cancelEscalation(requestId, reason) {
    const admin = createAdminClient();
    await assertCanCloseEscalation(admin, requestId);
    await closeActiveEscalation(admin, requestId, "CANCELLED", reason);
  },

  async reconcileTerminalEscalations(requestIds) {
    const admin = createAdminClient();
    return reconcileTerminalEscalations(admin, requestIds);
  },

  async getActiveEscalation(requestId) {
    const user = await requireAuth();
    const admin = createAdminClient();
    const request = await loadRequest(admin, requestId);
    if (!request) throw AppError.notFound("Request not found.");

    if (request.requester_id !== user.id) {
      await requireRole("ADMIN");
    }

    return loadActiveEvent(admin, requestId);
  },

  async getEscalationSummary(requestId, viewerUserId) {
    const user = await requireAuth();
    if (user.id !== viewerUserId) throw AppError.unauthorized("Unauthorized");

    const admin = createAdminClient();
    const request = await loadRequest(admin, requestId);
    if (!request) throw AppError.notFound("Request not found.");

    const isOwner = request.requester_id === viewerUserId;
    let adminOk = false;
    try {
      const adminUser = await requireRole("ADMIN");
      adminOk = adminUser.id === viewerUserId;
    } catch {
      adminOk = false;
    }

    if (!isOwner && !adminOk) {
      throw AppError.unauthorized("Unauthorized");
    }

    const { data: events, error } = await admin
      .from("emergency_events")
      .select("id, blood_request_id, level, status, triggered_at, resolved_at, notes, metadata")
      .eq("blood_request_id", requestId)
      .order("triggered_at", { ascending: false });
    if (error) throw AppError.server(error);

    const history = ((events as EventRow[] | null) ?? []).map(toEvent);
    const active = history.find((e) => e.status === "OPEN") ?? null;

    const eventIds = history.map((e) => e.id);
    let targets: EmergencyEventTarget[] = [];
    if (eventIds.length > 0) {
      const { data: targetRows, error: targetError } = await admin
        .from("emergency_event_targets")
        .select(
          "id, emergency_event_id, organization_type, organization_id, status, distance_meters, responded_at, notes"
        )
        .in("emergency_event_id", eventIds);
      if (targetError) throw AppError.server(targetError);

      const raw =
        (targetRows as
          | {
              id: string;
              emergency_event_id: string;
              organization_type: OrganizationType;
              organization_id: string;
              status: OrgEscalationResponse;
              distance_meters: number | null;
              responded_at: string | null;
              notes: string | null;
            }[]
          | null) ?? [];

      const hospitalIds = raw.filter((t) => t.organization_type === "HOSPITAL").map((t) => t.organization_id);
      const bankIds = raw.filter((t) => t.organization_type === "BLOOD_BANK").map((t) => t.organization_id);

      const [hospitalNames, bankNames] = await Promise.all([
        hospitalService.getNamesByIds(hospitalIds),
        bloodBankService.getNamesByIds(bankIds),
      ]);

      const nameMap = new Map<string, string>();
      for (const [id, name] of hospitalNames) nameMap.set(`HOSPITAL:${id}`, name);
      for (const [id, name] of bankNames) nameMap.set(`BLOOD_BANK:${id}`, name);

      targets = raw.map((t) => ({
        id: t.id,
        emergencyEventId: t.emergency_event_id,
        organizationType: t.organization_type,
        organizationId: t.organization_id,
        organizationName: nameMap.get(`${t.organization_type}:${t.organization_id}`) ?? "Organization",
        status: t.status,
        distanceMeters: t.distance_meters != null ? Number(t.distance_meters) : null,
        respondedAt: t.responded_at,
        notes: t.notes,
      }));
    }

    const matches = await loadMatchStatuses(admin, requestId);
    const hasAccepted = hasAcceptedDonorMatch(matches.map((m) => m.status));

    return {
      active,
      history,
      targets,
      orgContactedCount: targets.length,
      acknowledgedCount: targets.filter((t) => t.status === "ACKNOWLEDGED" || t.status === "CAN_SUPPLY").length,
      canSupplyCount: targets.filter((t) => t.status === "CAN_SUPPLY").length,
      canEscalateNow: canRequesterEscalateNow({
        isEmergency: request.is_emergency,
        status: request.status,
        hasAcceptedDonor: hasAccepted,
        hasActiveEscalation: Boolean(active),
      }),
    };
  },

  async listInboxForOrganization(organizationType) {
    await requireRole(organizationType === "HOSPITAL" ? "HOSPITAL" : "BLOOD_BANK");
    const admin = createAdminClient();

    const org =
      organizationType === "HOSPITAL"
        ? await hospitalService.getOwnLinkedOrg()
        : await bloodBankService.getOwnLinkedOrg();
    if (!org) return [];

    const orgId = org.id;

    const { data: targets, error } = await admin
      .from("emergency_event_targets")
      .select(
        "id, emergency_event_id, organization_type, organization_id, status, distance_meters, responded_at, notes"
      )
      .eq("organization_type", organizationType)
      .eq("organization_id", orgId);
    if (error) throw AppError.server(error);

    const targetRows =
      (targets as
        | {
            id: string;
            emergency_event_id: string;
            organization_type: OrganizationType;
            organization_id: string;
            status: OrgEscalationResponse;
            distance_meters: number | null;
            responded_at: string | null;
            notes: string | null;
          }[]
        | null) ?? [];

    if (targetRows.length === 0) return [];

    const eventIds = [...new Set(targetRows.map((t) => t.emergency_event_id))];
    const { data: events, error: eventError } = await admin
      .from("emergency_events")
      .select("id, blood_request_id, level, status, triggered_at, resolved_at, notes, metadata")
      .in("id", eventIds);
    if (eventError) throw AppError.server(eventError);

    const eventMap = new Map(((events as EventRow[] | null) ?? []).map((e) => [e.id, toEvent(e)]));
    const requestIds = [...new Set(((events as EventRow[] | null) ?? []).map((e) => e.blood_request_id))];

    const { data: requests, error: requestError } = await admin
      .from("blood_requests")
      .select(
        "id, blood_group, quantity_units, urgency, required_by, hospital_name_freeform, status, is_emergency"
      )
      .in("id", requestIds);
    if (requestError) throw AppError.server(requestError);

    type ReqRow = {
      id: string;
      blood_group: string;
      quantity_units: number;
      urgency: RequestUrgency;
      required_by: string | null;
      hospital_name_freeform: string | null;
      status: BloodRequestStatus;
      is_emergency: boolean;
    };
    const requestMap = new Map(((requests as ReqRow[] | null) ?? []).map((r) => [r.id, r]));

    const inbox = [];
    for (const t of targetRows) {
      const event = eventMap.get(t.emergency_event_id);
      if (!event) continue;
      // Prefer open escalations; still show recent responses on open/resolved events.
      const request = requestMap.get(event.bloodRequestId);
      if (!request) continue;
      inbox.push({
        target: {
          id: t.id,
          emergencyEventId: t.emergency_event_id,
          organizationType: t.organization_type,
          organizationId: t.organization_id,
          organizationName: org.name,
          status: t.status,
          distanceMeters: t.distance_meters != null ? Number(t.distance_meters) : null,
          respondedAt: t.responded_at,
          notes: t.notes,
        },
        event,
        request: {
          id: request.id,
          bloodGroup: request.blood_group,
          quantityUnits: request.quantity_units,
          urgency: request.urgency,
          isEmergency: request.is_emergency,
          requiredBy: request.required_by,
          hospitalNameFreeform: request.hospital_name_freeform,
          status: request.status,
        },
      });
    }

    return inbox;
  },

  async respondAsOrganization(targetId, response, notes) {
    await requireAuth();

    const supabase = createClient();
    const { error } = await supabase.rpc("respond_to_escalation_target", {
      p_target_id: targetId,
      p_response: response,
      p_notes: notes ?? null,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("BC_UNAUTHORIZED")) throw AppError.unauthorized("Unauthorized");
      if (message.includes("BC_NOT_FOUND")) throw AppError.notFound("Escalation target not found.");
      if (message.includes("BC_ESCALATION_CLOSED") || message.includes("BC_REQUEST_TERMINAL")) {
        throw AppError.conflict("This escalation can no longer be answered.");
      }
      if (message.includes("BC_VALIDATION")) throw AppError.validation("Invalid input");
      throw AppError.server(error);
    }

    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin
      .from("emergency_event_targets")
      .select("id, emergency_event_id, organization_type, organization_id, status")
      .eq("id", targetId)
      .maybeSingle();
    if (targetError) throw AppError.server(targetError);
    if (!target) return;

    const { data: event, error: eventError } = await admin
      .from("emergency_events")
      .select("id, blood_request_id")
      .eq("id", (target as { emergency_event_id: string }).emergency_event_id)
      .maybeSingle();
    if (eventError) throw AppError.server(eventError);
    if (!event) return;

    const request = await loadRequest(admin, (event as { blood_request_id: string }).blood_request_id);
    if (!request) return;

    const orgType = (target as { organization_type: OrganizationType }).organization_type;
    const orgId = (target as { organization_id: string }).organization_id;
    const names =
      orgType === "HOSPITAL"
        ? await hospitalService.getNamesByIds([orgId])
        : await bloodBankService.getNamesByIds([orgId]);
    const orgName = names.get(orgId) ?? "An organization";

    const responseLabel =
      response === "CAN_SUPPLY"
        ? "can supply blood"
        : response === "CANNOT_HELP"
          ? "cannot help"
          : "acknowledged the escalation";

    await notifyRequester(
      request,
      "Organization update",
      `${orgName} ${responseLabel}.`,
      {
        organizationResponse: response,
        organizationType: orgType,
        organizationName: orgName,
      },
      "ESCALATION_REQUESTER_ORG_RESPONSE"
    );
  },

  async listAdminOpenEscalations() {
    await requireRole("ADMIN");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("emergency_events")
      .select("id, blood_request_id, level, status, triggered_at, resolved_at, notes, metadata")
      .eq("status", "OPEN")
      .in("level", ["BLOOD_BANKS_HOSPITALS", "ADMIN_INTERVENTION"])
      .order("triggered_at", { ascending: true });
    if (error) throw AppError.server(error);

    const events = ((data as EventRow[] | null) ?? []).map(toEvent);
    if (events.length === 0) return [];

    const requestIds = events.map((e) => e.bloodRequestId);
    const { data: requests, error: requestError } = await admin
      .from("blood_requests")
      .select("id, status, blood_group")
      .in("id", requestIds);
    if (requestError) throw AppError.server(requestError);

    const map = new Map(
      ((requests as { id: string; status: BloodRequestStatus; blood_group: string }[] | null) ?? []).map(
        (r) => [r.id, r]
      )
    );

    return events.map((event) => ({
      event,
      requestStatus: map.get(event.bloodRequestId)?.status ?? "MATCHING",
      bloodGroup: map.get(event.bloodRequestId)?.blood_group ?? "?",
    }));
  },
};
