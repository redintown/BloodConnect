import "server-only";
import { NotImplementedError } from "@/lib/errors/AppError";

/**
 * All admin mutations must go through here (never direct table writes from
 * an admin page) so that every privileged action gets an audit_logs entry.
 */
export interface AdminService {
  listUsers(filter?: { search?: string }): Promise<unknown[]>;
  setDonorVerification(donorId: string, status: "VERIFIED" | "REJECTED", adminId: string): Promise<void>;
  setHospitalVerification(hospitalId: string, status: "VERIFIED" | "REJECTED", adminId: string): Promise<void>;
  setBloodBankVerification(bankId: string, status: "VERIFIED" | "REJECTED", adminId: string): Promise<void>;
  listReports(status?: string): Promise<unknown[]>;
  getAuditLog(entityType?: string, entityId?: string): Promise<unknown[]>;
}

export const adminService: AdminService = {
  async listUsers() {
    throw new NotImplementedError("adminService.listUsers");
  },
  async setDonorVerification() {
    throw new NotImplementedError("adminService.setDonorVerification");
  },
  async setHospitalVerification() {
    throw new NotImplementedError("adminService.setHospitalVerification");
  },
  async setBloodBankVerification() {
    throw new NotImplementedError("adminService.setBloodBankVerification");
  },
  async listReports() {
    throw new NotImplementedError("adminService.listReports");
  },
  async getAuditLog() {
    throw new NotImplementedError("adminService.getAuditLog");
  },
};
