import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { requireRole } from "@/services/authService";
import { createClient } from "@/lib/supabase/server";
import { hospitalService } from "@/services/hospitalService";
import { bloodBankService } from "@/services/bloodBankService";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/constants/bloodGroups";
import {
  adjustInventorySchema,
  type AdjustInventoryInput,
} from "@/schemas/inventory.schema";
import type { BloodInventoryItem } from "@/types/domain";
import type { OrganizationType } from "@/lib/escalation/constants";

/**
 * Owns blood_inventory reads/writes.
 * Adjustments go through atomic SECURITY DEFINER RPC (stock + audit).
 * Escalation may READ hints via getOwnUnitsByBloodGroupMap; CAN_SUPPLY must never adjust stock.
 */

export interface InventoryAdjustmentResult {
  item: BloodInventoryItem;
  oldUnits: number;
  newUnits: number;
  delta: number;
}

export interface InventoryService {
  getOwnInventory(organizationType: OrganizationType): Promise<BloodInventoryItem[]>;
  getOwnInventoryByBloodGroup(
    organizationType: OrganizationType,
    bloodGroup: BloodGroup
  ): Promise<BloodInventoryItem>;
  /** One fetch mapped by blood group — for escalation inbox hints (Phase 8C). */
  getOwnUnitsByBloodGroupMap(organizationType: OrganizationType): Promise<Map<BloodGroup, number>>;
  adjustInventory(
    organizationType: OrganizationType,
    input: AdjustInventoryInput
  ): Promise<InventoryAdjustmentResult>;
}

type InventoryRow = {
  id: string;
  hospital_id: string | null;
  blood_bank_id: string | null;
  blood_group: BloodGroup;
  units_available: number;
  updated_at: string;
};

function mapInventoryRpcError(error: { message?: string }, availableHint?: number): AppError {
  const message = error.message ?? "";
  if (message.includes("BC_UNAUTHORIZED") || message.includes("Not authenticated")) {
    return AppError.unauthorized("Unauthorized");
  }
  if (message.includes("BC_NOT_FOUND")) {
    return AppError.notFound("Organization profile not found.");
  }
  if (message.includes("BC_INSUFFICIENT")) {
    const match = message.match(/available=(\d+)/);
    const available = match ? Number(match[1]) : availableHint;
    if (typeof available === "number" && Number.isFinite(available)) {
      return AppError.conflict(`Insufficient inventory. Available units: ${available}.`);
    }
    return AppError.conflict("Insufficient inventory.");
  }
  if (message.includes("BC_VALIDATION")) {
    return AppError.validation("Invalid input");
  }
  return AppError.server(error);
}

function toItem(
  organizationType: OrganizationType,
  ownerId: string,
  bloodGroup: BloodGroup,
  row: InventoryRow | null
): BloodInventoryItem {
  return {
    id: row?.id ?? `${ownerId}:${bloodGroup}`,
    ownerType: organizationType,
    ownerId,
    bloodGroup,
    unitsAvailable: row?.units_available ?? 0,
    updatedAt: row?.updated_at ?? new Date(0).toISOString(),
  };
}

async function resolveOwnOrg(
  organizationType: OrganizationType
): Promise<{ id: string; organizationType: OrganizationType }> {
  if (organizationType === "HOSPITAL") {
    await requireRole("HOSPITAL");
    const org = await hospitalService.getOwnLinkedOrg();
    if (!org) throw AppError.notFound("Hospital profile not found.");
    return { id: org.id, organizationType };
  }

  await requireRole("BLOOD_BANK");
  const org = await bloodBankService.getOwnLinkedOrg();
  if (!org) throw AppError.notFound("Blood bank profile not found.");
  return { id: org.id, organizationType };
}

async function loadOwnRows(organizationType: OrganizationType, ownerId: string): Promise<InventoryRow[]> {
  const supabase = createClient();
  const column = organizationType === "HOSPITAL" ? "hospital_id" : "blood_bank_id";
  const { data, error } = await supabase
    .from("blood_inventory")
    .select("id, hospital_id, blood_bank_id, blood_group, units_available, updated_at")
    .eq(column, ownerId);
  if (error) throw AppError.server(error);
  return (data as InventoryRow[] | null) ?? [];
}

export const inventoryService: InventoryService = {
  async getOwnInventory(organizationType) {
    const org = await resolveOwnOrg(organizationType);
    const rows = await loadOwnRows(organizationType, org.id);
    const byGroup = new Map(rows.map((row) => [row.blood_group, row]));

    return BLOOD_GROUPS.map((bloodGroup) =>
      toItem(organizationType, org.id, bloodGroup, byGroup.get(bloodGroup) ?? null)
    );
  },

  async getOwnInventoryByBloodGroup(organizationType, bloodGroup) {
    const items = await this.getOwnInventory(organizationType);
    const item = items.find((entry) => entry.bloodGroup === bloodGroup);
    if (!item) throw AppError.notFound("Inventory row not found.");
    return item;
  },

  async getOwnUnitsByBloodGroupMap(organizationType) {
    const items = await this.getOwnInventory(organizationType);
    return new Map(items.map((item) => [item.bloodGroup, item.unitsAvailable]));
  },

  async adjustInventory(organizationType, input) {
    const org = await resolveOwnOrg(organizationType);
    const parsed = adjustInventorySchema.safeParse(input);
    if (!parsed.success) throw AppError.validation("Invalid input");

    const supabase = createClient();
    const { data, error } = await supabase.rpc("adjust_own_inventory", {
      p_organization_type: organizationType,
      p_blood_group: parsed.data.bloodGroup,
      p_delta: parsed.data.delta,
      p_reason: parsed.data.reason ?? null,
    });

    if (error) throw mapInventoryRpcError(error);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw AppError.server();

    const result = row as {
      inventory_id: string;
      blood_group: BloodGroup;
      old_units: number;
      new_units: number;
      units_available: number;
      updated_at: string;
    };

    return {
      item: {
        id: result.inventory_id,
        ownerType: organizationType,
        ownerId: org.id,
        bloodGroup: result.blood_group,
        unitsAvailable: result.units_available,
        updatedAt: result.updated_at,
      },
      oldUnits: result.old_units,
      newUnits: result.new_units,
      delta: parsed.data.delta,
    };
  },
};
