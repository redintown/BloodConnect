import "server-only";
import { DonorMatchPopup } from "@/components/forms/DonorMatchPopup";
import { matchResponseService } from "@/services/matchResponseService";
import {
  selectActionableDonorMatches,
  shouldShowDonorMatchPopup,
} from "@/lib/matches/responseRules";

/**
 * Donor-portal-wide overlay. Mounted once from `(donor)/layout.tsx` so normal
 * and emergency match popups appear on every authenticated donor route —
 * not only /donor or /donor/requests.
 */
export async function DonorPortalMatchOverlay({ userId }: { userId: string }) {
  let actionableMatches = [] as Awaited<
    ReturnType<typeof matchResponseService.listMatchesForDonor>
  >;

  try {
    const inbox = await matchResponseService.listMatchesForDonor(userId);
    actionableMatches = selectActionableDonorMatches(inbox);
  } catch (error) {
    console.error("[DonorPortalMatchOverlay] listMatchesForDonor failed", {
      userIdPrefix: userId.slice(0, 8),
      code: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }

  if (!shouldShowDonorMatchPopup(actionableMatches)) {
    return null;
  }

  return <DonorMatchPopup matches={actionableMatches} />;
}
