import "server-only";
import { matchingService } from "@/services/matchingService";
import { notifyMatchedDonorsForRequest } from "@/services/matchNotifyService";
import { emergencyResponseService } from "@/services/emergencyResponseService";
import { bloodRequestService } from "@/services/bloodRequestService";

/**
 * Orchestrates Phase 4 matching → Phase 6 notify → optional emergency response.
 * Kept out of matchingService so the core algorithm stays notification-free.
 */
export async function runMatchingWithNotifications(
  requestId: string,
  requesterId: string
): Promise<{ matchCount: number; emergencyNotifiedCount: number }> {
  const matches = await matchingService.runMatchingForRequest(requestId, requesterId);
  await notifyMatchedDonorsForRequest(requestId, requesterId);

  const request = await bloodRequestService.getById(requestId);
  let emergencyNotifiedCount = 0;
  if (request?.isEmergency) {
    const emergency = await emergencyResponseService.runForRequest(requestId, requesterId);
    emergencyNotifiedCount = emergency.notifiedCount;
  }

  return { matchCount: matches.length, emergencyNotifiedCount };
}
