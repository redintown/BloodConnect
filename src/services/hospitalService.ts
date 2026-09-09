import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { locationService } from "@/services/locationService";
import { hospitalProfileSchema, type HospitalProfileInput } from "@/schemas/hospital.schema";
import type { VerificationStatus } from "@/lib/constants/verification";
import type { Coordinates, Hospital } from "@/types/domain";

/**
 * Owns hospitals.
 * Session-bound owner operations — never trust client userId for auth.
 * Inventory is owned by inventoryService (Phase 8B).
 */

type HospitalRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  has_24h_emergency: boolean;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
};

export interface HospitalService {
  getOwnProfile(): Promise<Hospital | null>;
  createOwnProfile(input: HospitalProfileInput): Promise<Hospital>;
  updateOwnProfile(input: HospitalProfileInput): Promise<Hospital>;
  submitVerification(): Promise<Hospital>;
  getOwnLinkedOrg(): Promise<{ id: string; name: string } | null>;
  getNamesByIds(ids: string[]): Promise<Map<string, string>>;
}

function mapOrgRpcError(error: { message?: string }): AppError {
  const message = error.message ?? "";
  if (message.includes("BC_UNAUTHORIZED") || message.includes("Not authenticated")) {
    return AppError.unauthorized("Unauthorized");
  }
  if (message.includes("BC_NOT_FOUND")) return AppError.notFound("Hospital profile not found.");
  if (message.includes("BC_CONFLICT") || message.includes("already exists")) {
    return AppError.conflict("A hospital profile already exists for this account.");
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
  const { data, error } = await supabase.rpc("own_hospital_location");
  if (error) throw AppError.server(error);
  const row = Array.isArray(data) ? data[0] : data;
  return locationService.decodeWgs84Point(row);
}

async function loadOwnRow(): Promise<HospitalRow | null> {
  const user = await requireRole("HOSPITAL");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hospitals")
    .select("id, name, phone, address, has_24h_emergency, verification_status, rejection_reason")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw AppError.server(error);
  return (data as HospitalRow | null) ?? null;
}

async function toDomain(row: HospitalRow): Promise<Hospital> {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    location: await readOwnLocation(),
    has24hEmergency: row.has_24h_emergency,
    verificationStatus: row.verification_status,
    rejectionReason: row.rejection_reason,
  };
}

export const hospitalService: HospitalService = {
  async getOwnLinkedOrg() {
    const user = await requireRole("HOSPITAL");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("hospitals")
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
    const { data, error } = await admin.from("hospitals").select("id, name").in("id", unique);
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
    await requireRole("HOSPITAL");
    const parsed = hospitalProfileSchema.safeParse(input);
    if (!parsed.success) throw AppError.validation("Invalid input");

    const supabase = createClient();
    const { error } = await supabase.rpc("create_own_hospital_profile", {
      p_name: parsed.data.name,
      p_phone: parsed.data.contactPhone,
      p_address: parsed.data.address,
      p_lat: parsed.data.location.latitude,
      p_lng: parsed.data.location.longitude,
      p_has_24h_emergency: parsed.data.has24hEmergency,
    });
    if (error) throw mapOrgRpcError(error);

    const profile = await this.getOwnProfile();
    if (!profile) throw AppError.server();
    return profile;
  },

  async updateOwnProfile(input) {
    await requireRole("HOSPITAL");
    const parsed = hospitalProfileSchema.safeParse(input);
    if (!parsed.success) throw AppError.validation("Invalid input");

    const supabase = createClient();
    const { error } = await supabase.rpc("update_own_hospital_profile", {
      p_name: parsed.data.name,
      p_phone: parsed.data.contactPhone,
      p_address: parsed.data.address,
      p_lat: parsed.data.location.latitude,
      p_lng: parsed.data.location.longitude,
      p_has_24h_emergency: parsed.data.has24hEmergency,
    });
    if (error) throw mapOrgRpcError(error);

    const profile = await this.getOwnProfile();
    if (!profile) throw AppError.notFound("Hospital profile not found.");
    return profile;
  },

  async submitVerification() {
    await requireRole("HOSPITAL");
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_own_hospital_verification");
    if (error) throw mapOrgRpcError(error);

    const profile = await this.getOwnProfile();
    if (!profile) throw AppError.notFound("Hospital profile not found.");
    return profile;
  },
};
