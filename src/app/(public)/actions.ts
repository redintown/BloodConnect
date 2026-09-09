"use server";

import {
  formatCoarseDistance,
  formatRelativeInventoryFreshness,
} from "@/lib/inventory/publicSearch";
import {
  bloodAvailabilityService,
  type PublicBloodSearchResult,
} from "@/services/bloodAvailabilityService";
import { publicBloodSearchSchema } from "@/schemas/publicBloodSearch.schema";
import { AppError } from "@/lib/errors/AppError";

export type PublicBloodSearchResultView = PublicBloodSearchResult & {
  distanceLabel: string;
  freshnessLabel: string | null;
};

function actionError(error: unknown): { error: string } {
  if (error instanceof AppError) return { error: error.userMessage };
  return { error: "Something went wrong" };
}

/**
 * Public (no login) blood availability search.
 * Browser → this Server Action → bloodAvailabilityService → safe RPC.
 */
export async function searchPublicBloodAvailabilityAction(
  input: unknown
): Promise<{ error: string } | { ok: true; results: PublicBloodSearchResultView[] }> {
  const parsed = publicBloodSearchSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  try {
    const results = await bloodAvailabilityService.search(parsed.data);
    return {
      ok: true,
      results: results.map((item) => ({
        ...item,
        distanceLabel: formatCoarseDistance(item.distanceKmRounded),
        freshnessLabel: formatRelativeInventoryFreshness(item.inventoryUpdatedAt),
      })),
    };
  } catch (error) {
    return actionError(error);
  }
}
