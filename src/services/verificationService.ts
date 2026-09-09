import "server-only";
import { AppError, NotImplementedError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { createAdminClient } from "@/lib/supabase/server";
import { notificationService } from "@/services/notificationService";
import { orgRejectSchema } from "@/schemas/hospital.schema";
import type { VerificationStatus } from "@/lib/constants/verification";
import type { OrganizationType } from "@/lib/escalation/constants";

/**
 * Organization verification (Phase 8A). Donor verification remains Phase 9.
 * ADMIN-only mutations; owners cannot self-verify.
 */

export interface PendingOrganization {
  id: string;
  organizationType: OrganizationType;
  name: string;
  phone: string;
  address: string;
  has24hEmergency?: boolean;
  emergencyHours?: string | null;
  locationSummary: string | null;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationService {
  isDonorEligibleForVerification(donorId: string): Promise<boolean>;
  isHospitalEligibleForVerification(hospitalId: string): Promise<boolean>;
  isBloodBankEligibleForVerification(bankId: string): Promise<boolean>;
  listPendingOrganizations(): Promise<PendingOrganization[]>;
  verifyHospital(hospitalId: string): Promise<void>;
  rejectHospital(hospitalId: string, reason: string): Promise<void>;
  verifyBloodBank(bankId: string): Promise<void>;
  rejectBloodBank(bankId: string, reason: string): Promise<void>;
}

type OrgRow = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
  address: string;
  has_24h_emergency?: boolean;
  emergency_hours?: string | null;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
  location: unknown;
};

function locationSummaryFromRow(location: unknown): string | null {
  if (!location) return null;
  if (
    typeof location === "object" &&
    location !== null &&
    "coordinates" in location &&
    Array.isArray((location as { coordinates: unknown }).coordinates)
  ) {
    const [lng, lat] = (location as { coordinates: unknown[] }).coordinates;
    if (typeof lat === "number" && typeof lng === "number") {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }
  return "Location on file";
}

async function notifyOwner(params: {
  recipientId: string | null;
  organizationType: OrganizationType;
  result: "VERIFIED" | "REJECTED";
  rejectionReason?: string;
}): Promise<void> {
  if (!params.recipientId) return;

  const title =
    params.result === "VERIFIED" ? "Organization verified" : "Organization verification rejected";
  const body =
    params.result === "VERIFIED"
      ? `Your ${params.organizationType === "HOSPITAL" ? "hospital" : "blood bank"} profile was verified.`
      : `Your ${params.organizationType === "HOSPITAL" ? "hospital" : "blood bank"} profile was rejected. ${
          params.rejectionReason ?? ""
        }`.trim();

  await notificationService.notify(
    {
      recipientId: params.recipientId,
      kind: "ORG_VERIFICATION",
      title,
      body,
      data: {
        organizationType: params.organizationType,
        result: params.result,
        ...(params.result === "REJECTED" && params.rejectionReason
          ? { rejectionReason: params.rejectionReason }
          : {}),
      },
    },
    "IN_APP"
  );
}

export const verificationService: VerificationService = {
  async isDonorEligibleForVerification() {
    throw new NotImplementedError("verificationService.isDonorEligibleForVerification");
  },

  async isHospitalEligibleForVerification(hospitalId) {
    await requireRole("ADMIN");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("hospitals")
      .select("id, location, verification_status")
      .eq("id", hospitalId)
      .maybeSingle();
    if (error) throw AppError.server(error);
    if (!data) return false;
    const row = data as { location: unknown; verification_status: VerificationStatus };
    return row.verification_status === "PENDING" && row.location != null;
  },

  async isBloodBankEligibleForVerification(bankId) {
    await requireRole("ADMIN");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blood_banks")
      .select("id, location, verification_status")
      .eq("id", bankId)
      .maybeSingle();
    if (error) throw AppError.server(error);
    if (!data) return false;
    const row = data as { location: unknown; verification_status: VerificationStatus };
    return row.verification_status === "PENDING" && row.location != null;
  },

  async listPendingOrganizations() {
    await requireRole("ADMIN");
    const admin = createAdminClient();

    const [hospitals, banks] = await Promise.all([
      admin
        .from("hospitals")
        .select(
          "id, user_id, name, phone, address, has_24h_emergency, verification_status, created_at, updated_at, location"
        )
        .eq("verification_status", "PENDING")
        .order("updated_at", { ascending: true }),
      admin
        .from("blood_banks")
        .select(
          "id, user_id, name, phone, address, emergency_hours, verification_status, created_at, updated_at, location"
        )
        .eq("verification_status", "PENDING")
        .order("updated_at", { ascending: true }),
    ]);

    if (hospitals.error) throw AppError.server(hospitals.error);
    if (banks.error) throw AppError.server(banks.error);

    const pending: PendingOrganization[] = [];

    for (const row of (hospitals.data as OrgRow[] | null) ?? []) {
      pending.push({
        id: row.id,
        organizationType: "HOSPITAL",
        name: row.name,
        phone: row.phone,
        address: row.address,
        has24hEmergency: Boolean(row.has_24h_emergency),
        locationSummary: locationSummaryFromRow(row.location),
        verificationStatus: row.verification_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    for (const row of (banks.data as OrgRow[] | null) ?? []) {
      pending.push({
        id: row.id,
        organizationType: "BLOOD_BANK",
        name: row.name,
        phone: row.phone,
        address: row.address,
        emergencyHours: row.emergency_hours ?? null,
        locationSummary: locationSummaryFromRow(row.location),
        verificationStatus: row.verification_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    pending.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    return pending;
  },

  async verifyHospital(hospitalId) {
    const adminUser = await requireRole("ADMIN");
    if (!hospitalId) throw AppError.validation("Invalid input");

    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("hospitals")
      .select("id, user_id, verification_status")
      .eq("id", hospitalId)
      .maybeSingle();
    if (readError) throw AppError.server(readError);
    if (!existing) throw AppError.notFound("Hospital not found.");

    const row = existing as { user_id: string | null; verification_status: VerificationStatus };
    if (row.verification_status !== "PENDING") {
      throw AppError.conflict("Only pending organizations can be verified.");
    }

    const { error } = await admin
      .from("hospitals")
      .update({
        verification_status: "VERIFIED",
        verified_at: new Date().toISOString(),
        verified_by: adminUser.id,
        rejection_reason: null,
      })
      .eq("id", hospitalId)
      .eq("verification_status", "PENDING");
    if (error) throw AppError.server(error);

    await notifyOwner({
      recipientId: row.user_id,
      organizationType: "HOSPITAL",
      result: "VERIFIED",
    });
  },

  async rejectHospital(hospitalId, reason) {
    await requireRole("ADMIN");
    const parsed = orgRejectSchema.safeParse({ organizationId: hospitalId, reason });
    if (!parsed.success) throw AppError.validation("Invalid input");

    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("hospitals")
      .select("id, user_id, verification_status")
      .eq("id", hospitalId)
      .maybeSingle();
    if (readError) throw AppError.server(readError);
    if (!existing) throw AppError.notFound("Hospital not found.");

    const row = existing as { user_id: string | null; verification_status: VerificationStatus };
    if (row.verification_status !== "PENDING") {
      throw AppError.conflict("Only pending organizations can be rejected.");
    }

    const { error } = await admin
      .from("hospitals")
      .update({
        verification_status: "REJECTED",
        verified_at: null,
        verified_by: null,
        rejection_reason: parsed.data.reason,
      })
      .eq("id", hospitalId)
      .eq("verification_status", "PENDING");
    if (error) throw AppError.server(error);

    await notifyOwner({
      recipientId: row.user_id,
      organizationType: "HOSPITAL",
      result: "REJECTED",
      rejectionReason: parsed.data.reason,
    });
  },

  async verifyBloodBank(bankId) {
    const adminUser = await requireRole("ADMIN");
    if (!bankId) throw AppError.validation("Invalid input");

    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("blood_banks")
      .select("id, user_id, verification_status")
      .eq("id", bankId)
      .maybeSingle();
    if (readError) throw AppError.server(readError);
    if (!existing) throw AppError.notFound("Blood bank not found.");

    const row = existing as { user_id: string | null; verification_status: VerificationStatus };
    if (row.verification_status !== "PENDING") {
      throw AppError.conflict("Only pending organizations can be verified.");
    }

    const { error } = await admin
      .from("blood_banks")
      .update({
        verification_status: "VERIFIED",
        verified_at: new Date().toISOString(),
        verified_by: adminUser.id,
        rejection_reason: null,
      })
      .eq("id", bankId)
      .eq("verification_status", "PENDING");
    if (error) throw AppError.server(error);

    await notifyOwner({
      recipientId: row.user_id,
      organizationType: "BLOOD_BANK",
      result: "VERIFIED",
    });
  },

  async rejectBloodBank(bankId, reason) {
    await requireRole("ADMIN");
    const parsed = orgRejectSchema.safeParse({ organizationId: bankId, reason });
    if (!parsed.success) throw AppError.validation("Invalid input");

    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("blood_banks")
      .select("id, user_id, verification_status")
      .eq("id", bankId)
      .maybeSingle();
    if (readError) throw AppError.server(readError);
    if (!existing) throw AppError.notFound("Blood bank not found.");

    const row = existing as { user_id: string | null; verification_status: VerificationStatus };
    if (row.verification_status !== "PENDING") {
      throw AppError.conflict("Only pending organizations can be rejected.");
    }

    const { error } = await admin
      .from("blood_banks")
      .update({
        verification_status: "REJECTED",
        verified_at: null,
        verified_by: null,
        rejection_reason: parsed.data.reason,
      })
      .eq("id", bankId)
      .eq("verification_status", "PENDING");
    if (error) throw AppError.server(error);

    await notifyOwner({
      recipientId: row.user_id,
      organizationType: "BLOOD_BANK",
      result: "REJECTED",
      rejectionReason: parsed.data.reason,
    });
  },
};
