import "server-only";
import { NotImplementedError } from "@/lib/errors/AppError";
import type { Hospital } from "@/types/domain";
import type { HospitalProfileInput } from "@/schemas/hospital.schema";

export interface HospitalService {
  create(userId: string, input: HospitalProfileInput): Promise<Hospital>;
  update(hospitalId: string, userId: string, patch: Partial<HospitalProfileInput>): Promise<Hospital>;
  getById(hospitalId: string): Promise<Hospital | null>;
  listVerified(): Promise<Hospital[]>;
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
};
