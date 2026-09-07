import type { BloodGroup } from "@/lib/constants/bloodGroups";
import type { VerificationStatus } from "@/lib/constants/verification";
import { isCompatible } from "@/lib/matching/compatibility";

export interface MatchCandidateRow {
  donorId: string;
  userId?: string;
  bloodGroup: BloodGroup;
  isEligible: boolean;
  verificationStatus: VerificationStatus;
  isAvailable: boolean;
  isAvailableAtNight: boolean;
  distanceMeters: number;
  locationPresent?: boolean;
}

/**
 * Pure hard-filter for matching candidates. Safe to unit-test without Supabase.
 * RPC already applies most filters; this re-validates and applies compatibility.
 */
export function passesHardMatchingCriteria(
  candidate: MatchCandidateRow,
  recipientBloodGroup: BloodGroup,
  requesterId: string
): boolean {
  if (candidate.locationPresent === false) return false;
  if (!candidate.isAvailable) return false;
  if (!candidate.isEligible) return false;
  if (candidate.verificationStatus === "REJECTED") return false;
  if (!isCompatible(candidate.bloodGroup, recipientBloodGroup)) return false;
  if (candidate.userId && candidate.userId === requesterId) return false;
  if (!(candidate.distanceMeters >= 0) || Number.isNaN(candidate.distanceMeters)) return false;
  return true;
}

/** Match response statuses that re-run must never overwrite or delete. */
export const PROTECTED_MATCH_STATUSES = ["ACCEPTED", "DECLINED"] as const;

export function isProtectedMatchStatus(status: string): boolean {
  return (PROTECTED_MATCH_STATUSES as readonly string[]).includes(status);
}
