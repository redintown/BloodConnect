import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { createAdminClient } from "@/lib/supabase/server";
import {
  publicBloodSearchSchema,
  type PublicBloodSearchInput,
  type PublicSearchOrgType,
} from "@/schemas/publicBloodSearch.schema";
import type { BloodGroup } from "@/lib/constants/bloodGroups";
import {
  formatCoarseDistance,
  formatRelativeInventoryFreshness,
} from "@/lib/inventory/publicSearch";

export { formatCoarseDistance, formatRelativeInventoryFreshness };

/**
 * Public blood availability search (Phase 8D).
 * Exact inventory counts and coordinates stay private.
 * Separate from donor matching and escalation.
 */

export type PublicBloodAvailability = "POSSIBLE";

export interface PublicBloodSearchResult {
  organizationId: string;
  organizationType: "HOSPITAL" | "BLOOD_BANK";
  name: string;
  address: string;
  /** Present for expand-only UI — never show in dense cards. */
  phone: string;
  distanceKmRounded: number;
  availability: PublicBloodAvailability;
  inventoryUpdatedAt: string | null;
  has24hEmergency: boolean | null;
  emergencyHours: string | null;
}

export interface BloodAvailabilityService {
  search(input: PublicBloodSearchInput): Promise<PublicBloodSearchResult[]>;
}

type RpcRow = {
  organization_id?: unknown;
  organization_type?: unknown;
  name?: unknown;
  address?: unknown;
  phone?: unknown;
  distance_km_rounded?: unknown;
  availability?: unknown;
  inventory_updated_at?: unknown;
  has_24h_emergency?: unknown;
  emergency_hours?: unknown;
  [key: string]: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapRpcError(error: { message?: string }): AppError {
  const message = error.message ?? "";
  if (message.includes("BC_VALIDATION")) return AppError.validation("Invalid input");
  return AppError.server(error);
}

/** Whitelist map — drops unexpected RPC columns. */
function toSafeResult(row: RpcRow): PublicBloodSearchResult | null {
  const organizationId = asString(row.organization_id);
  const organizationTypeRaw = asString(row.organization_type);
  const name = asString(row.name);
  const address = asString(row.address);
  const phone = asString(row.phone);
  const distanceKmRounded = asNumber(row.distance_km_rounded);
  const availability = asString(row.availability);
  const inventoryUpdatedAt = asString(row.inventory_updated_at);

  if (
    !organizationId ||
    (organizationTypeRaw !== "HOSPITAL" && organizationTypeRaw !== "BLOOD_BANK") ||
    !name ||
    !address ||
    !phone ||
    distanceKmRounded == null ||
    distanceKmRounded < 1 ||
    availability !== "POSSIBLE"
  ) {
    return null;
  }

  // Defense: never accept unit/coordinate fields even if RPC changes.
  if (
    "units_available" in row ||
    "latitude" in row ||
    "longitude" in row ||
    "location" in row ||
    "user_id" in row ||
    "verified_by" in row ||
    "rejection_reason" in row ||
    "verification_notes" in row
  ) {
    return null;
  }

  return {
    organizationId,
    organizationType: organizationTypeRaw,
    name,
    address,
    phone,
    distanceKmRounded: Math.ceil(distanceKmRounded),
    availability: "POSSIBLE",
    inventoryUpdatedAt,
    has24hEmergency:
      typeof row.has_24h_emergency === "boolean" ? row.has_24h_emergency : null,
    emergencyHours: asString(row.emergency_hours),
  };
}

export const bloodAvailabilityService: BloodAvailabilityService = {
  async search(input) {
    const parsed = publicBloodSearchSchema.safeParse(input);
    if (!parsed.success) throw AppError.validation("Invalid input");

    // Phase 10A: RPC is service_role-only; public UI still uses Server Action (no login).
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("search_public_blood_availability", {
      p_blood_group: parsed.data.bloodGroup as BloodGroup,
      p_lat: parsed.data.latitude,
      p_lng: parsed.data.longitude,
      p_radius_km: parsed.data.radiusKm,
      p_organization_type: parsed.data.organizationType as PublicSearchOrgType,
    });

    if (error) throw mapRpcError(error);

    const rows = (Array.isArray(data) ? data : data ? [data] : []) as RpcRow[];
    const results: PublicBloodSearchResult[] = [];
    for (const row of rows) {
      const mapped = toSafeResult(row);
      if (mapped) results.push(mapped);
    }
    return results.slice(0, 25);
  },
};
