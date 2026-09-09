import "server-only";
import { AppError, NotImplementedError } from "@/lib/errors/AppError";
import { requireAuth } from "@/services/authService";
import { createAdminClient } from "@/lib/supabase/server";
import type { Hospital } from "@/types/domain";
import type { HospitalProfileInput } from "@/schemas/hospital.schema";

/**
 * Owns hospitals (+ Phase 8 inventory later).
 * Phase 7 hardening: thin authenticated reads so escalation does not query
 * hospitals directly.
 */

export interface HospitalService {
  create(userId: string, input: HospitalProfileInput): Promise<Hospital>;
  update(hospitalId: string, userId: string, patch: Partial<HospitalProfileInput>): Promise<Hospital>;
  getById(hospitalId: string): Promise<Hospital | null>;
  listVerified(): Promise<Hospital[]>;
  /** Session-bound: returns the hospital linked to the current user. */
  getOwnLinkedOrg(): Promise<{ id: string; name: string } | null>;
  /** Name lookup for requester/admin escalation summaries (service-role). */
  getNamesByIds(ids: string[]): Promise<Map<string, string>>;
}

export const hospitalService: HospitalService = {
  async create() {
    throw new NotImplementedError("hospitalService.create");
  },
  async update() {
    throw new NotImplementedError("hospitalService.update");
  },
  async getById() {
    throw new NotImplementedError("hospitalService.getById");
  },
  async listVerified() {
    throw new NotImplementedError("hospitalService.listVerified");
  },

  async getOwnLinkedOrg() {
    const user = await requireAuth();
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
};
