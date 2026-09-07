import "server-only";
import { NotImplementedError } from "@/lib/errors/AppError";
import type { BloodBank } from "@/types/domain";
import type { BloodBankProfileInput } from "@/schemas/bloodBank.schema";

export interface BloodBankService {
  create(userId: string, input: BloodBankProfileInput): Promise<BloodBank>;
  update(bankId: string, userId: string, patch: Partial<BloodBankProfileInput>): Promise<BloodBank>;
  getById(bankId: string): Promise<BloodBank | null>;
  listVerified(): Promise<BloodBank[]>;
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
};
