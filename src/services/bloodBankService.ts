import "server-only";
import { AppError, NotImplementedError } from "@/lib/errors/AppError";
import { requireAuth } from "@/services/authService";
import { createAdminClient } from "@/lib/supabase/server";
import type { BloodBank } from "@/types/domain";
import type { BloodBankProfileInput } from "@/schemas/bloodBank.schema";

/**
 * Owns blood_banks (+ Phase 8 inventory later).
 * Phase 7 hardening: thin authenticated reads so escalation does not query
 * blood_banks directly.
 */

export interface BloodBankService {
  create(userId: string, input: BloodBankProfileInput): Promise<BloodBank>;
  update(bankId: string, userId: string, patch: Partial<BloodBankProfileInput>): Promise<BloodBank>;
  getById(bankId: string): Promise<BloodBank | null>;
  listVerified(): Promise<BloodBank[]>;
  /** Session-bound: returns the blood bank linked to the current user. */
  getOwnLinkedOrg(): Promise<{ id: string; name: string } | null>;
  /** Name lookup for requester/admin escalation summaries (service-role). */
  getNamesByIds(ids: string[]): Promise<Map<string, string>>;
}

export const bloodBankService: BloodBankService = {
  async create() {
    throw new NotImplementedError("bloodBankService.create");
  },
  async update() {
    throw new NotImplementedError("bloodBankService.update");
  },
  async getById() {
    throw new NotImplementedError("bloodBankService.getById");
  },
  async listVerified() {
    throw new NotImplementedError("bloodBankService.listVerified");
  },

  async getOwnLinkedOrg() {
    const user = await requireAuth();
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
};
