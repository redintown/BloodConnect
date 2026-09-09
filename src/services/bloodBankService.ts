import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { locationService } from "@/services/locationService";
import { bloodBankProfileSchema, type BloodBankProfileInput } from "@/schemas/bloodBank.schema";
import type { VerificationStatus } from "@/lib/constants/verification";
import type { BloodBank, Coordinates } from "@/types/domain";

/**
 * Owns blood_banks.
 * Session-bound owner operations — never trust client userId for auth.
 * Inventory is owned by inventoryService (Phase 8B).
 */

type BloodBankRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  emergency_hours: string | null;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
};

export interface BloodBankService {
  getOwnProfile(): Promise<BloodBank | null>;
  createOwnProfile(input: BloodBankProfileInput): Promise<BloodBank>;
  updateOwnProfile(input: BloodBankProfileInput): Promise<BloodBank>;
  submitVerification(): Promise<BloodBank>;
  getOwnLinkedOrg(): Promise<{ id: string; name: string } | null>;
  getNamesByIds(ids: string[]): Promise<Map<string, string>>;
}

function mapOrgRpcError(error: { message?: string }): AppError {
  const message = error.message ?? "";
  if (message.includes("BC_UNAUTHORIZED") || message.includes("Not authenticated")) {
    return AppError.unauthorized("Unauthorized");
  }
  if (message.includes("BC_NOT_FOUND")) return AppError.notFound("Blood bank profile not found.");
  if (message.includes("BC_CONFLICT") || message.includes("already exists")) {
    return AppError.conflict("A blood bank profile already exists for this account.");
  }
  if (message.includes("BC_VALIDATION") || message.includes("Owners cannot")) {
    return AppError.validation("Invalid input");
  }
  if (message.includes("user_id is immutable")) {
    return AppError.unauthorized("Unauthorized");
  }
  return AppError.server(error);
}

async function readOwnLocation(): Promise<Coordinates | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("own_blood_bank_location");
  if (error) throw AppError.server(error);
  const row = Array.isArray(data) ? data[0] : data;
  return locationService.decodeWgs84Point(row);
}

async function loadOwnRow(): Promise<BloodBankRow | null> {
  const user = await requireRole("BLOOD_BANK");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blood_banks")
    .select("id, name, phone, address, emergency_hours, verification_status, rejection_reason")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw AppError.server(error);
  return (data as BloodBankRow | null) ?? null;
}

async function toDomain(row: BloodBankRow): Promise<BloodBank> {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    location: await readOwnLocation(),
    emergencyHours: row.emergency_hours,
    verificationStatus: row.verification_status,
    rejectionReason: row.rejection_reason,
  };
}

export const bloodBankService: BloodBankService = {
  async getOwnLinkedOrg() {
    const user = await requireRole("BLOOD_BANK");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blood_banks")
      .select("id, name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw AppError.server(error);
    return (data as { id: string; name: string } | null) ?? null;
  },

  async getNamesByIds(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    const map = new Map<string, string>();
    if (unique.length === 0) return map;

    const admin = createAdminClient();
    const { data, error } = await admin.from("blood_banks").select("id, name").in("id", unique);
    if (error) throw AppError.server(error);
    for (const row of (data as { id: string; name: string }[] | null) ?? []) {
      map.set(row.id, row.name);
    }
    return map;
  },

  async getOwnProfile() {
    const row = await loadOwnRow();
    if (!row) return null;
    return toDomain(row);
  },

  async createOwnProfile(input) {
    await requireRole("BLOOD_BANK");
    const parsed = bloodBankProfileSchema.safeParse(input);
    if (!parsed.success) throw AppError.validation("Invalid input");

    const supabase = createClient();
    const { error } = await supabase.rpc("create_own_blood_bank_profile", {
      p_name: parsed.data.name,
      p_phone: parsed.data.contactPhone,
      p_address: parsed.data.address,
      p_lat: parsed.data.location.latitude,
      p_lng: parsed.data.location.longitude,
      p_emergency_hours: parsed.data.emergencyHours ?? null,
    });
    if (error) throw mapOrgRpcError(error);

    const profile = await this.getOwnProfile();
    if (!profile) throw AppError.server();
    return profile;
  },

  async updateOwnProfile(input) {
    await requireRole("BLOOD_BANK");
    const parsed = bloodBankProfileSchema.safeParse(input);
    if (!parsed.success) throw AppError.validation("Invalid input");

    const supabase = createClient();
    const { error } = await supabase.rpc("update_own_blood_bank_profile", {
      p_name: parsed.data.name,
      p_phone: parsed.data.contactPhone,
      p_address: parsed.data.address,
      p_lat: parsed.data.location.latitude,
      p_lng: parsed.data.location.longitude,
      p_emergency_hours: parsed.data.emergencyHours ?? null,
    });
    if (error) throw mapOrgRpcError(error);

    const profile = await this.getOwnProfile();
    if (!profile) throw AppError.notFound("Blood bank profile not found.");
    return profile;
  },

  async submitVerification() {
    await requireRole("BLOOD_BANK");
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_own_blood_bank_verification");
    if (error) throw mapOrgRpcError(error);

    const profile = await this.getOwnProfile();
    if (!profile) throw AppError.notFound("Blood bank profile not found.");
    return profile;
  },
};
