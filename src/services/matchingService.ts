import "server-only";
import { NotImplementedError } from "@/lib/errors/AppError";
import type { BloodGroup } from "@/lib/constants/bloodGroups";
import type { BloodRequest, DonorPublicSummary } from "@/types/domain";

/**
 * The matching engine. Deliberately isolated from React and from
 * notificationService: this module answers "who is a good match", nothing
 * about *reaching* them. That split is what lets the ranking algorithm
 * get more sophisticated later (Phase 4+) without touching UI or delivery
 * code.
 *
 * isCompatible() is the single source of truth for donor -> recipient
 * blood-type compatibility. It is intentionally NOT implemented in Phase 0
 * — shipping a wrong compatibility rule is a patient-safety issue, so the
 * real implementation is written and tested together in Phase 4.
 */
export interface MatchingService {
  isCompatible(donorBloodGroup: BloodGroup, recipientBloodGroup: BloodGroup): boolean;
  matchDonors(request: BloodRequest): Promise<DonorPublicSummary[]>;
}

export const matchingService: MatchingService = {
  isCompatible() {
    throw new NotImplementedError("matchingService.isCompatible");
  },
  async matchDonors() {
    throw new NotImplementedError("matchingService.matchDonors");
  },
};
