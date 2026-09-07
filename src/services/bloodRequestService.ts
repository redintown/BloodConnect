import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireAuth } from "@/services/authService";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { locationService } from "@/services/locationService";
import {
  createBloodRequestSchema,
  type CreateBloodRequestInput,
} from "@/schemas/bloodRequest.schema";
import {
  assertOwnsRequest,
  canRequesterCancel,
  canRequesterEdit,
  EXPIRABLE_REQUEST_STATUSES,
  initialRequestStatus,
  isOverdueForExpiry,
} from "@/lib/requests/statusRules";
import type { BloodGroup } from "@/lib/constants/bloodGroups";
import type { BloodRequestStatus, RequestUrgency } from "@/lib/constants/requestStatus";
import type { BloodRequest, Coordinates } from "@/types/domain";

/**
 * Owns the blood_requests table and its status transitions. The status
 * enum lives in lib/constants/requestStatus.ts — this service is the only
 * place allowed to write a new status, so transition rules stay in one
 * spot instead of being re-implemented per UI action.
 *
 * Match-table writes are owned by the matching module; this service still owns
 * all blood_requests status transitions (including MATCHING / NO_MATCH_FOUND).
 */

interface BloodRequestRow {
  id: string;
  requester_id: string;
  blood_group: BloodGroup;
  quantity_units: number;
  urgency: RequestUrgency;
  required_by: string | null;
  hospital_id: string | null;
  hospital_name_freeform: string | null;
  contact_name: string;
  contact_phone: string;
  status: BloodRequestStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

const REQUEST_COLUMNS =
  "id, requester_id, blood_group, quantity_units, urgency, required_by, hospital_id, hospital_name_freeform, contact_name, contact_phone, status, notes, created_at, updated_at, expires_at";

export interface BloodRequestService {
  create(requesterId: string, input: CreateBloodRequestInput): Promise<BloodRequest>;
  update(requestId: string, requesterId: string, patch: Partial<CreateBloodRequestInput>): Promise<BloodRequest>;
  cancel(requestId: string, requesterId: string): Promise<void>;
  getById(requestId: string): Promise<BloodRequest | null>;
  listForRequester(requesterId: string): Promise<BloodRequest[]>;
  /** Called by a trusted server context, not by end-user status updates. */
  expireOverdue(): Promise<number>;
  /** System transition: PENDING → MATCHING (also allowed when already MATCHING / from NO_MATCH_FOUND). */
  markMatching(requestId: string): Promise<void>;
  /** System transition: PENDING | MATCHING → NO_MATCH_FOUND. */
  markNoMatchFound(requestId: string): Promise<void>;
}

async function assertActingRequester(requesterId: string) {
  const user = await requireAuth();
  assertOwnsRequest(user.id, requesterId);
  return user;
}

async function readOwnRequestLocation(requestId: string): Promise<Coordinates> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("own_request_location", {
    p_request_id: requestId,
  });
  if (error) throw AppError.server(error);
  const row = Array.isArray(data) ? data[0] : data;
  const coords = locationService.decodeWgs84Point(row);
  if (!coords) {
    throw AppError.server(new Error("Missing request location"));
  }
  return coords;
}

async function writeOwnRequestLocation(requestId: string, location: Coordinates): Promise<void> {
  // encodeWgs84Point documents the WGS84 contract; the RPC owns PostGIS writes.
  locationService.encodeWgs84Point(location);
  const supabase = createClient();
  const { error } = await supabase.rpc("set_own_request_location", {
    p_request_id: requestId,
    p_lat: location.latitude,
    p_lng: location.longitude,
  });
  if (error) throw AppError.server(error);
}

async function toDomain(row: BloodRequestRow): Promise<BloodRequest> {
  return {
    id: row.id,
    requesterId: row.requester_id,
    bloodGroup: row.blood_group,
    quantityUnits: row.quantity_units,
    urgency: row.urgency,
    requiredBy: row.required_by,
    hospitalId: row.hospital_id,
    hospitalNameFreeform: row.hospital_name_freeform,
    location: await readOwnRequestLocation(row.id),
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

async function loadOwnRow(requestId: string, requesterId: string): Promise<BloodRequestRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blood_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .eq("requester_id", requesterId)
    .maybeSingle();

  if (error) throw AppError.server(error);
  return (data as BloodRequestRow | null) ?? null;
}

function expiresAtFromInput(input: CreateBloodRequestInput): string | null {
  return input.requiredBy ?? null;
}

export const bloodRequestService: BloodRequestService = {
  async create(requesterId, input) {
    await assertActingRequester(requesterId);

    const parsed = createBloodRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input");
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_own_blood_request", {
      p_blood_group: parsed.data.bloodGroup,
      p_quantity_units: parsed.data.quantityUnits,
      p_urgency: parsed.data.urgency,
      p_lat: parsed.data.location.latitude,
      p_lng: parsed.data.location.longitude,
      p_contact_name: parsed.data.contactName,
      p_contact_phone: parsed.data.contactPhone,
      p_hospital_id: parsed.data.hospitalId ?? null,
      p_hospital_name_freeform: parsed.data.hospitalNameFreeform ?? null,
      p_required_by: parsed.data.requiredBy ?? null,
      p_notes: parsed.data.notes ?? null,
      p_expires_at: expiresAtFromInput(parsed.data),
    });

    if (error || !data) throw AppError.server(error);

    const requestId = typeof data === "string" ? data : String(data);
    const created = await bloodRequestService.getById(requestId);
    if (!created) throw AppError.server();
    if (created.status !== initialRequestStatus()) {
      throw AppError.server(new Error("Request did not start as PENDING"));
    }
    return created;
  },

  async update(requestId, requesterId, patch) {
    await assertActingRequester(requesterId);

    const existing = await loadOwnRow(requestId, requesterId);
    if (!existing) throw AppError.notFound("Request not found.");
    if (!canRequesterEdit(existing.status)) {
      throw AppError.conflict("This request can no longer be edited.");
    }

    const merged = {
      bloodGroup: patch.bloodGroup ?? existing.blood_group,
      quantityUnits: patch.quantityUnits ?? existing.quantity_units,
      urgency: patch.urgency ?? existing.urgency,
      requiredBy: patch.requiredBy !== undefined ? patch.requiredBy : existing.required_by,
      hospitalId: patch.hospitalId !== undefined ? patch.hospitalId : existing.hospital_id,
      hospitalNameFreeform:
        patch.hospitalNameFreeform !== undefined
          ? patch.hospitalNameFreeform
          : existing.hospital_name_freeform,
      location: patch.location ?? (await readOwnRequestLocation(requestId)),
      contactName: patch.contactName ?? existing.contact_name,
      contactPhone: patch.contactPhone ?? existing.contact_phone,
      notes: patch.notes !== undefined ? patch.notes : existing.notes,
    };

    const parsed = createBloodRequestSchema.safeParse(merged);
    if (!parsed.success) {
      throw AppError.validation("Invalid input");
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("blood_requests")
      .update({
        blood_group: parsed.data.bloodGroup,
        quantity_units: parsed.data.quantityUnits,
        urgency: parsed.data.urgency,
        required_by: parsed.data.requiredBy ?? null,
        hospital_id: parsed.data.hospitalId ?? null,
        hospital_name_freeform: parsed.data.hospitalNameFreeform ?? null,
        contact_name: parsed.data.contactName,
        contact_phone: parsed.data.contactPhone,
        notes: parsed.data.notes ?? null,
        expires_at: expiresAtFromInput(parsed.data),
      })
      .eq("id", requestId)
      .eq("requester_id", requesterId)
      .eq("status", "PENDING");

    if (error) throw AppError.server(error);

    if (patch.location) {
      await writeOwnRequestLocation(requestId, parsed.data.location);
    }

    const updated = await bloodRequestService.getById(requestId);
    if (!updated) throw AppError.notFound("Request not found.");
    return updated;
  },

  async cancel(requestId, requesterId) {
    await assertActingRequester(requesterId);

    const existing = await loadOwnRow(requestId, requesterId);
    if (!existing) throw AppError.notFound("Request not found.");
    if (!canRequesterCancel(existing.status)) {
      throw AppError.conflict("This request can no longer be cancelled.");
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("blood_requests")
      .update({ status: "CANCELLED" })
      .eq("id", requestId)
      .eq("requester_id", requesterId);

    if (error) throw AppError.server(error);
  },

  async getById(requestId) {
    const user = await requireAuth();
    const row = await loadOwnRow(requestId, user.id);
    if (!row) return null;
    return toDomain(row);
  },

  async listForRequester(requesterId) {
    await assertActingRequester(requesterId);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("blood_requests")
      .select(REQUEST_COLUMNS)
      .eq("requester_id", requesterId)
      .order("created_at", { ascending: false });

    if (error) throw AppError.server(error);

    const rows = (data as BloodRequestRow[] | null) ?? [];
    return Promise.all(rows.map((row) => toDomain(row)));
  },

  async expireOverdue() {
    // System operation: bypasses the authenticated-user status restriction.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blood_requests")
      .select("id, status, expires_at")
      .not("expires_at", "is", null)
      .in("status", [...EXPIRABLE_REQUEST_STATUSES]);

    if (error) throw AppError.server(error);

    const now = new Date();
    const overdueIds = ((data as { id: string; status: BloodRequestStatus; expires_at: string }[] | null) ?? [])
      .filter((row) => isOverdueForExpiry(row.status, row.expires_at, now))
      .map((row) => row.id);

    if (overdueIds.length === 0) return 0;

    const { error: updateError } = await admin
      .from("blood_requests")
      .update({ status: "EXPIRED" })
      .in("id", overdueIds)
      .in("status", [...EXPIRABLE_REQUEST_STATUSES]);

    if (updateError) throw AppError.server(updateError);
    return overdueIds.length;
  },

  async markMatching(requestId) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blood_requests")
      .select("id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (error) throw AppError.server(error);
    if (!data) throw AppError.notFound("Request not found.");

    const status = (data as { status: BloodRequestStatus }).status;
    if (status === "MATCHING") return;
    if (status !== "PENDING" && status !== "NO_MATCH_FOUND") {
      throw AppError.conflict("This request cannot enter MATCHING.");
    }

    const { error: updateError } = await admin
      .from("blood_requests")
      .update({ status: "MATCHING" })
      .eq("id", requestId)
      .in("status", ["PENDING", "NO_MATCH_FOUND"]);

    if (updateError) throw AppError.server(updateError);
  },

  async markNoMatchFound(requestId) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blood_requests")
      .select("id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (error) throw AppError.server(error);
    if (!data) throw AppError.notFound("Request not found.");

    const status = (data as { status: BloodRequestStatus }).status;
    if (status === "NO_MATCH_FOUND") return;
    if (status !== "PENDING" && status !== "MATCHING") {
      throw AppError.conflict("This request cannot enter NO_MATCH_FOUND.");
    }

    const { error: updateError } = await admin
      .from("blood_requests")
      .update({ status: "NO_MATCH_FOUND" })
      .eq("id", requestId)
      .in("status", ["PENDING", "MATCHING"]);

    if (updateError) throw AppError.server(updateError);
  },
};
