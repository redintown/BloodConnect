import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notificationService } from "@/services/notificationService";
import { orgRejectSchema } from "@/schemas/hospital.schema";
import { donorRejectSchema } from "@/schemas/donorVerification.schema";
import { z } from "zod";
import type { VerificationStatus } from "@/lib/constants/verification";
import type { OrganizationType } from "@/lib/escalation/constants";
import type { BloodGroup } from "@/lib/constants/bloodGroups";

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

export interface PendingDonor {
  donorId: string;
  donorName: string;
  bloodGroup: BloodGroup;
  lastDonationDate: string | null;
  isAvailable: boolean;
  isAvailableAtNight: boolean;
  locationSummary: string | null;
  verificationStatus: VerificationStatus; // should be PENDING
  updatedAt: string; // used as "submitted time" proxy
}

export interface VerificationService {
  isDonorEligibleForVerification(donorId: string): Promise<boolean>;
  isHospitalEligibleForVerification(hospitalId: string): Promise<boolean>;
  isBloodBankEligibleForVerification(bankId: string): Promise<boolean>;
  listPendingOrganizations(): Promise<PendingOrganization[]>;
  listPendingDonors(): Promise<PendingDonor[]>;
  submitDonorVerification(): Promise<void>;
  verifyDonor(donorId: string): Promise<void>;
  rejectDonor(donorId: string, reason: string): Promise<void>;
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

function donorLocationSummaryFromRow(location: unknown): string | null {
  return location ? "Location on file" : "Location missing";
}

async function notifyDonor(params: {
  recipientId: string | null;
  result: "VERIFIED" | "REJECTED";
  rejectionReason?: string;
}): Promise<void> {
  if (!params.recipientId) return;

  const title =
    params.result === "VERIFIED" ? "Donor verified" : "Donor verification rejected";
  const body =
    params.result === "VERIFIED"
      ? "Your donor profile was verified."
      : `Your donor profile was rejected. ${(params.rejectionReason ?? "").trim()}`.trim();

  await notificationService.notify(
    {
      recipientId: params.recipientId,
      kind: "DONOR_VERIFICATION",
      title,
      body,
      data: {
        result: params.result,
        ...(params.result === "REJECTED" && params.rejectionReason
          ? { rejectionReason: params.rejectionReason }
          : {}),
      },
    },
    "IN_APP"
  );
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
  async isDonorEligibleForVerification(donorId: string) {
    await requireRole("ADMIN");
    if (!z.string().uuid().safeParse(donorId).success) return false;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("donor_profiles")
      .select("id")
      .eq("id", donorId)
      .maybeSingle();
    if (error) throw AppError.server(error);
    return Boolean(data);
  },

  async submitDonorVerification() {
    const donorUser = await requireRole("DONOR");

    const { data: donor, error: donorError } = await createClient()
      .from("donor_profiles")
      .select("id, verification_status")
      .eq("user_id", donorUser.id)
      .maybeSingle();

    if (donorError) throw AppError.server(donorError);
    if (!donor) throw AppError.notFound("Donor profile not found.");

    const oldStatus = donor.verification_status as VerificationStatus;

    const supabase = createClient();
    const { error } = await supabase.rpc("submit_own_donor_verification");
    if (error) {
      const message = error.message ?? "";
      if (message.includes("BC_NOT_FOUND")) throw AppError.notFound("Donor profile not found.");
      if (message.includes("BC_CONFLICT")) throw AppError.conflict("Unable to submit verification.");
      if (message.includes("BC_VALIDATION")) throw AppError.validation("Invalid input");
      throw AppError.server(error);
    }

    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: donorUser.id,
      action: "DONOR_VERIFICATION_SUBMITTED",
      entity_type: "donor_profiles",
      entity_id: donor.id,
      metadata: {
        oldStatus,
        newStatus: "PENDING",
      },
    });
  },

  async listPendingDonors() {
    await requireRole("ADMIN");
    const admin = createAdminClient();

    const { data: donorRows, error } = await admin
      .from("donor_profiles")
      .select(
        "id, user_id, blood_group, last_donation_date, verification_status, updated_at, location, donor_availability(is_available, is_available_at_night)"
      )
      .eq("verification_status", "PENDING")
      .order("updated_at", { ascending: true });

    if (error) throw AppError.server(error);

    const donors = (donorRows as any[] | null) ?? [];
    const userIds = [...new Set(donors.map((d) => d.user_id).filter(Boolean))];

    const { data: profileRows, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    if (profileError) throw AppError.server(profileError);

    const profileMap = new Map<string, string>(
      (((profileRows as any[] | null) ?? []).map((p) => [p.id, p.full_name])) as Array<
        [string, string]
      >
    );

    return donors.map((row) => {
      const availabilityRaw = row.donor_availability;
      const availability = Array.isArray(availabilityRaw) ? availabilityRaw[0] : availabilityRaw;

      return {
        donorId: row.id,
        donorName: profileMap.get(row.user_id) ?? "Donor",
        bloodGroup: row.blood_group as BloodGroup,
        lastDonationDate: row.last_donation_date as string | null,
        isAvailable: Boolean(availability?.is_available),
        isAvailableAtNight: Boolean(availability?.is_available_at_night),
        locationSummary: donorLocationSummaryFromRow(row.location),
        verificationStatus: row.verification_status as VerificationStatus,
        updatedAt: row.updated_at as string,
      } satisfies PendingDonor;
    });
  },

  async verifyDonor(donorId: string) {
    const adminUser = await requireRole("ADMIN");
    const parsed = z.string().uuid().safeParse(donorId);
    if (!parsed.success) throw AppError.validation("Invalid input");

    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("donor_profiles")
      .select("id, user_id, verification_status")
      .eq("id", parsed.data)
      .maybeSingle();
    if (readError) throw AppError.server(readError);
    if (!existing) throw AppError.notFound("Donor not found.");

    const row = existing as { id: string; user_id: string; verification_status: VerificationStatus };
    if (row.verification_status !== "PENDING") {
      throw AppError.conflict("Only pending donors can be verified.");
    }

    const { data: updated, error } = await admin
      .from("donor_profiles")
      .update({
        verification_status: "VERIFIED",
        verified_at: new Date().toISOString(),
        verified_by: adminUser.id,
        rejection_reason: null,
        verification_notes: null,
      })
      .eq("id", row.id)
      .eq("verification_status", "PENDING")
      .select("id, user_id")
      .maybeSingle();
    if (error) throw AppError.server(error);
    if (!updated) {
      throw AppError.conflict("Only pending donors can be verified.");
    }

    const updatedRow = updated as { id: string; user_id: string };

    await admin.from("audit_logs").insert({
      actor_id: adminUser.id,
      action: "DONOR_VERIFICATION_VERIFIED",
      entity_type: "donor_profiles",
      entity_id: updatedRow.id,
      metadata: {
        oldStatus: "PENDING",
        newStatus: "VERIFIED",
      },
    });

    await notifyDonor({
      recipientId: updatedRow.user_id,
      result: "VERIFIED",
    });
  },

  async rejectDonor(donorId: string, reason: string) {
    const adminUser = await requireRole("ADMIN");
    const parsed = donorRejectSchema.safeParse({ donorId, reason });
    if (!parsed.success) throw AppError.validation("Invalid input");

    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("donor_profiles")
      .select("id, user_id, verification_status")
      .eq("id", parsed.data.donorId)
      .maybeSingle();
    if (readError) throw AppError.server(readError);
    if (!existing) throw AppError.notFound("Donor not found.");

    const row = existing as { id: string; user_id: string; verification_status: VerificationStatus };
    if (row.verification_status !== "PENDING") {
      throw AppError.conflict("Only pending donors can be rejected.");
    }

    const { data: updated, error } = await admin
      .from("donor_profiles")
      .update({
        verification_status: "REJECTED",
        verified_at: null,
        verified_by: null,
        rejection_reason: parsed.data.reason,
        verification_notes: null,
      })
      .eq("id", row.id)
      .eq("verification_status", "PENDING")
      .select("id, user_id")
      .maybeSingle();
    if (error) throw AppError.server(error);
    if (!updated) {
      throw AppError.conflict("Only pending donors can be rejected.");
    }

    const updatedRow = updated as { id: string; user_id: string };

    await admin.from("audit_logs").insert({
      actor_id: adminUser.id,
      action: "DONOR_VERIFICATION_REJECTED",
      entity_type: "donor_profiles",
      entity_id: updatedRow.id,
      metadata: {
        oldStatus: "PENDING",
        newStatus: "REJECTED",
        rejectionReason: parsed.data.reason,
      },
    });

    await notifyDonor({
      recipientId: updatedRow.user_id,
      result: "REJECTED",
      rejectionReason: parsed.data.reason,
    });
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

    const { data: updated, error } = await admin
      .from("hospitals")
      .update({
        verification_status: "VERIFIED",
        verified_at: new Date().toISOString(),
        verified_by: adminUser.id,
        rejection_reason: null,
        verification_notes: null,
      })
      .eq("id", hospitalId)
      .eq("verification_status", "PENDING")
      .select("id, user_id")
      .maybeSingle();
    if (error) throw AppError.server(error);
    if (!updated) {
      throw AppError.conflict("Only pending organizations can be verified.");
    }

    const updatedRow = updated as { id: string; user_id: string | null };
    await notifyOwner({
      recipientId: updatedRow.user_id,
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

    const { data: updated, error } = await admin
      .from("hospitals")
      .update({
        verification_status: "REJECTED",
        verified_at: null,
        verified_by: null,
        rejection_reason: parsed.data.reason,
        verification_notes: null,
      })
      .eq("id", hospitalId)
      .eq("verification_status", "PENDING")
      .select("id, user_id")
      .maybeSingle();
    if (error) throw AppError.server(error);
    if (!updated) {
      throw AppError.conflict("Only pending organizations can be rejected.");
    }

    const updatedRow = updated as { id: string; user_id: string | null };
    await notifyOwner({
      recipientId: updatedRow.user_id,
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

    const { data: updated, error } = await admin
      .from("blood_banks")
      .update({
        verification_status: "VERIFIED",
        verified_at: new Date().toISOString(),
        verified_by: adminUser.id,
        rejection_reason: null,
        verification_notes: null,
      })
      .eq("id", bankId)
      .eq("verification_status", "PENDING")
      .select("id, user_id")
      .maybeSingle();
    if (error) throw AppError.server(error);
    if (!updated) {
      throw AppError.conflict("Only pending organizations can be verified.");
    }

    const updatedRow = updated as { id: string; user_id: string | null };
    await notifyOwner({
      recipientId: updatedRow.user_id,
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

    const { data: updated, error } = await admin
      .from("blood_banks")
      .update({
        verification_status: "REJECTED",
        verified_at: null,
        verified_by: null,
        rejection_reason: parsed.data.reason,
        verification_notes: null,
      })
      .eq("id", bankId)
      .eq("verification_status", "PENDING")
      .select("id, user_id")
      .maybeSingle();
    if (error) throw AppError.server(error);
    if (!updated) {
      throw AppError.conflict("Only pending organizations can be rejected.");
    }

    const updatedRow = updated as { id: string; user_id: string | null };
    await notifyOwner({
      recipientId: updatedRow.user_id,
      organizationType: "BLOOD_BANK",
      result: "REJECTED",
      rejectionReason: parsed.data.reason,
    });
  },
};
