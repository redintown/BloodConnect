import "server-only";
import { NotImplementedError } from "@/lib/errors/AppError";
import type { BloodRequest } from "@/types/domain";
import type { CreateBloodRequestInput } from "@/schemas/bloodRequest.schema";

/**
 * Owns the blood_requests table and its status transitions. The status
 * enum lives in lib/constants/requestStatus.ts — this service is the only
 * place allowed to write a new status, so transition rules stay in one
 * spot instead of being re-implemented per UI action.
 */
export interface BloodRequestService {
  create(requesterId: string, input: CreateBloodRequestInput): Promise<BloodRequest>;
  update(requestId: string, requesterId: string, patch: Partial<CreateBloodRequestInput>): Promise<BloodRequest>;
  cancel(requestId: string, requesterId: string): Promise<void>;
  getById(requestId: string): Promise<BloodRequest | null>;
  listForRequester(requesterId: string): Promise<BloodRequest[]>;
  /** Called by a scheduled job / escalation service, not directly by users. */
  expireOverdue(): Promise<number>;
}

export const bloodRequestService: BloodRequestService = {
  async create() {
    throw new NotImplementedError("bloodRequestService.create");
  },
  async update() {
    throw new NotImplementedError("bloodRequestService.update");
  },
  async cancel() {
    throw new NotImplementedError("bloodRequestService.cancel");
  },
  async getById() {
    throw new NotImplementedError("bloodRequestService.getById");
  },
  async listForRequester() {
    throw new NotImplementedError("bloodRequestService.listForRequester");
  },
  async expireOverdue() {
    throw new NotImplementedError("bloodRequestService.expireOverdue");
  },
};
