import "server-only";
import { NotImplementedError } from "@/lib/errors/AppError";

/**
 * Distinct from adminService: adminService exposes the admin-facing
 * actions; verificationService holds the actual business rules for what
 * makes a donor/hospital/blood-bank eligible to be marked VERIFIED (e.g.
 * required documents, re-verification interval). Kept separate so those
 * rules are reusable outside the admin UI (e.g. automated checks later).
 */
export interface VerificationService {
  isDonorEligibleForVerification(donorId: string): Promise<boolean>;
  isHospitalEligibleForVerification(hospitalId: string): Promise<boolean>;
  isBloodBankEligibleForVerification(bankId: string): Promise<boolean>;
}

export const verificationService: VerificationService = {
  async isDonorEligibleForVerification() {
    throw new NotImplementedError("verificationService.isDonorEligibleForVerification");
  },
  async isHospitalEligibleForVerification() {
    throw new NotImplementedError("verificationService.isHospitalEligibleForVerification");
  },
  async isBloodBankEligibleForVerification() {
    throw new NotImplementedError("verificationService.isBloodBankEligibleForVerification");
  },
};
