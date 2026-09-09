import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { createClient } from "@/lib/supabase/server";
import { isEligibleFromLastDonation } from "@/lib/donors/eligibility";
import { locationService } from "@/services/locationService";
import { donorProfileSchema, type DonorProfileInput } from "@/schemas/donor.schema";
import { availabilitySchema, emergencySettingsSchema } from "@/schemas/availability.schema";
import {
  EMERGENCY_RADIUS_KM_DEFAULT,
} from "@/lib/matching/emergencyCriteria";
import type { BloodGroup } from "@/lib/constants/bloodGroups";
import type { VerificationStatus } from "@/lib/constants/verification";
import type { Coordinates, DonationRecord, DonorProfile } from "@/types/domain";

/**
 * Owns all reads/writes to donor_profiles + donor_availability.
 * No other module should query those tables directly — this keeps the
 * "never expose exact donor location" rule enforceable in one place.
 */

interface DonorProfileRow {
  id: string;
  user_id: string;
  blood_group: BloodGroup;
  last_donation_date: string | null;
  is_eligible: boolean;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  donor_availability:
    | {
        is_available: boolean;
        is_available_at_night: boolean;
        emergency_response_enabled?: boolean;
        emergency_radius_km?: number;
      }
    | {
        is_available: boolean;
        is_available_at_night: boolean;
        emergency_response_enabled?: boolean;
        emergency_radius_km?: number;
      }[]
    | null;
}

export interface DonorService {
  getOwnProfile(userId: string): Promise<DonorProfile | null>;
  upsertProfile(userId: string, input: DonorProfileInput): Promise<DonorProfile>;
  setAvailability(userId: string, isAvailable: boolean, isAvailableAtNight: boolean): Promise<void>;
  setEmergencySettings(
    userId: string,
    emergencyResponseEnabled: boolean,
    emergencyRadiusKm: number
  ): Promise<void>;
  getDonationHistory(userId: string): Promise<DonationRecord[]>;
}

async function assertOwnDonor(userId: string) {
  const user = await requireRole("DONOR");
  if (user.id !== userId) {
    throw AppError.unauthorized("Unauthorized");
  }
  return user;
}

function availabilityFromJoin(row: DonorProfileRow): {
  isAvailable: boolean;
  isAvailableAtNight: boolean;
  emergencyResponseEnabled: boolean;
  emergencyRadiusKm: number;
} {
  const raw = row.donor_availability;
  const availability = Array.isArray(raw) ? raw[0] : raw;
  return {
    isAvailable: availability?.is_available ?? false,
    isAvailableAtNight: availability?.is_available_at_night ?? false,
    emergencyResponseEnabled: availability?.emergency_response_enabled ?? false,
    emergencyRadiusKm: Number(availability?.emergency_radius_km ?? EMERGENCY_RADIUS_KM_DEFAULT),
  };
}

function coerceAvailability(isAvailable: boolean, isAvailableAtNight: boolean) {
  const night = Boolean(isAvailableAtNight);
  return {
    isAvailable: Boolean(isAvailable) || night,
    isAvailableAtNight: night,
  };
}

async function readOwnLocation(): Promise<Coordinates | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("own_donor_location");
  if (error) throw AppError.server(error);
  const row = Array.isArray(data) ? data[0] : data;
  return locationService.decodeWgs84Point(row);
}

async function writeOwnLocation(location: Coordinates | null | undefined): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_own_donor_location", {
    p_lat: location?.latitude ?? null,
    p_lng: location?.longitude ?? null,
  });
  if (error) throw AppError.server(error);
}

async function ensureAvailabilityRow(
  donorId: string,
  values?: { isAvailable: boolean; isAvailableAtNight: boolean }
): Promise<void> {
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase
    .from("donor_availability")
    .select("id")
    .eq("donor_id", donorId)
    .maybeSingle();

  if (readError) throw AppError.server(readError);

  if (!existing) {
    const defaults = values ?? { isAvailable: false, isAvailableAtNight: false };
    const { error } = await supabase.from("donor_availability").insert({
      donor_id: donorId,
      is_available: defaults.isAvailable,
      is_available_at_night: defaults.isAvailableAtNight,
    });
    if (error && error.code !== "23505") throw AppError.server(error);
    return;
  }

  if (!values) return;

  const { error } = await supabase
    .from("donor_availability")
    .update({
      is_available: values.isAvailable,
      is_available_at_night: values.isAvailableAtNight,
      updated_at: new Date().toISOString(),
    })
    .eq("donor_id", donorId);

  if (error) throw AppError.server(error);
}

async function loadOwnRow(userId: string): Promise<DonorProfileRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("donor_profiles")
    .select(
      "id, user_id, blood_group, last_donation_date, is_eligible, verification_status, rejection_reason, donor_availability(is_available, is_available_at_night, emergency_response_enabled, emergency_radius_km)"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw AppError.server(error);
  return (data as DonorProfileRow | null) ?? null;
}

async function toOwnProfile(row: DonorProfileRow): Promise<DonorProfile> {
  const availability = availabilityFromJoin(row);
  return {
    id: row.id,
    userId: row.user_id,
    bloodGroup: row.blood_group,
    lastDonationDate: row.last_donation_date,
    isEligible: row.is_eligible,
    verificationStatus: row.verification_status,
    rejectionReason: row.rejection_reason,
    location: await readOwnLocation(),
    isAvailable: availability.isAvailable,
    isAvailableAtNight: availability.isAvailableAtNight,
    emergencyResponseEnabled: availability.emergencyResponseEnabled,
    emergencyRadiusKm: availability.emergencyRadiusKm,
  };
}

export const donorService: DonorService = {
  async getOwnProfile(userId) {
    await assertOwnDonor(userId);
    const row = await loadOwnRow(userId);
    if (!row) return null;
    return toOwnProfile(row);
  },

  async upsertProfile(userId, input) {
    await assertOwnDonor(userId);

    const parsed = donorProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input");
    }

    const lastDonationDate = parsed.data.lastDonationDate ?? null;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("donor_profiles")
      .upsert(
        {
          user_id: userId,
          blood_group: parsed.data.bloodGroup,
          last_donation_date: lastDonationDate,
          is_eligible: isEligibleFromLastDonation(lastDonationDate),
        },
        { onConflict: "user_id" }
      )
      .select("id, user_id, blood_group, last_donation_date, is_eligible, verification_status")
      .single();

    if (error || !data) throw AppError.server(error);

    await writeOwnLocation(parsed.data.location ?? null);

    const availability = parsed.data.availability
      ? coerceAvailability(parsed.data.availability.isAvailable, parsed.data.availability.isAvailableAtNight)
      : undefined;
    await ensureAvailabilityRow(data.id, availability);

    const profile = await donorService.getOwnProfile(userId);
    if (!profile) throw AppError.server();
    return profile;
  },

  async setAvailability(userId, isAvailable, isAvailableAtNight) {
    await assertOwnDonor(userId);

    const parsed = availabilitySchema.safeParse({ isAvailable, isAvailableAtNight });
    if (!parsed.success) {
      throw AppError.validation("Invalid input");
    }

    const row = await loadOwnRow(userId);
    if (!row) {
      throw AppError.notFound("Complete your donor profile before setting availability.");
    }

    await ensureAvailabilityRow(row.id, coerceAvailability(parsed.data.isAvailable, parsed.data.isAvailableAtNight));
  },

  async setEmergencySettings(userId, emergencyResponseEnabled, emergencyRadiusKm) {
    await assertOwnDonor(userId);

    const parsed = emergencySettingsSchema.safeParse({
      emergencyResponseEnabled,
      emergencyRadiusKm,
    });
    if (!parsed.success) {
      throw AppError.validation("Invalid input");
    }

    const row = await loadOwnRow(userId);
    if (!row) {
      throw AppError.notFound("Complete your donor profile before setting emergency response.");
    }

    await ensureAvailabilityRow(row.id);

    const supabase = createClient();
    const { error } = await supabase
      .from("donor_availability")
      .update({
        emergency_response_enabled: parsed.data.emergencyResponseEnabled,
        emergency_radius_km: parsed.data.emergencyRadiusKm,
        updated_at: new Date().toISOString(),
      })
      .eq("donor_id", row.id);

    if (error) throw AppError.server(error);
  },

  async getDonationHistory(userId) {
    await assertOwnDonor(userId);
    const row = await loadOwnRow(userId);
    if (!row) return [];

    const supabase = createClient();
    const { data, error } = await supabase
      .from("donations")
      .select("id, donated_at, quantity_ml, notes")
      .eq("donor_id", row.id)
      .order("donated_at", { ascending: false });

    if (error) throw AppError.server(error);

    return (data ?? []).map(
      (donation: { id: string; donated_at: string; quantity_ml: number | null; notes: string | null }) => ({
        id: donation.id,
        donatedAt: donation.donated_at,
        quantityMl: donation.quantity_ml,
        notes: donation.notes,
      })
    );
  },
};
