import "server-only";
import { NotImplementedError } from "@/lib/errors/AppError";
import type { EscalationLevel } from "@/lib/constants/verification";
import type { BloodRequest } from "@/types/domain";

/**
 * Drives a request through LEVEL 1 -> 4 (see ARCHITECTURE.md). Depends on
 * matchingService (who to try) and notificationService (how to reach
 * them) but contains none of their logic itself — this file is purely the
 * "when do we move to the next level" state machine.
 */
export interface EscalationService {
  currentLevel(request: BloodRequest): EscalationLevel;
  escalate(request: BloodRequest): Promise<EscalationLevel>;
}

export const escalationService: EscalationService = {
  currentLevel() {
    throw new NotImplementedError("escalationService.currentLevel");
  },
  async escalate() {
    throw new NotImplementedError("escalationService.escalate");
  },
};
