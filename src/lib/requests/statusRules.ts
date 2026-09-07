import { AppError } from "@/lib/errors/AppError";
import type { BloodRequestStatus } from "@/lib/constants/requestStatus";

/** Statuses a requester may still edit (content fields, not status). */
export const EDITABLE_REQUEST_STATUSES: readonly BloodRequestStatus[] = ["PENDING"];

/** Statuses from which a requester may cancel. */
export const CANCELLABLE_REQUEST_STATUSES: readonly BloodRequestStatus[] = [
  "PENDING",
  "MATCHING",
];

/** Statuses that expireOverdue may move to EXPIRED. */
export const EXPIRABLE_REQUEST_STATUSES: readonly BloodRequestStatus[] = [
  "PENDING",
  "MATCHING",
  "DONOR_CONTACTED",
];

export function assertOwnsRequest(ownerId: string, requesterId: string): void {
  if (ownerId !== requesterId) {
    throw AppError.unauthorized("Unauthorized");
  }
}

export function canRequesterEdit(status: BloodRequestStatus): boolean {
  return (EDITABLE_REQUEST_STATUSES as readonly string[]).includes(status);
}

export function canRequesterCancel(status: BloodRequestStatus): boolean {
  return (CANCELLABLE_REQUEST_STATUSES as readonly string[]).includes(status);
}

export function canSystemExpire(status: BloodRequestStatus): boolean {
  return (EXPIRABLE_REQUEST_STATUSES as readonly string[]).includes(status);
}

/**
 * Mirrors the authenticated-user branch of blood_requests_before_write:
 * only CANCELLED from a cancellable status is allowed; requester_id never changes.
 */
export function assertRequesterStatusChange(
  current: BloodRequestStatus,
  next: BloodRequestStatus
): void {
  if (current === next) return;
  if (next === "CANCELLED" && canRequesterCancel(current)) return;
  throw AppError.unauthorized("Unauthorized");
}

export function assertRequesterIdImmutable(currentId: string, nextId: string): void {
  if (currentId !== nextId) {
    throw AppError.unauthorized("Unauthorized");
  }
}

export function isOverdueForExpiry(
  status: BloodRequestStatus,
  expiresAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt || !canSystemExpire(status)) return false;
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() < now.getTime();
}

/** New requests always start as PENDING — never MATCHING or beyond. */
export function initialRequestStatus(): BloodRequestStatus {
  return "PENDING";
}

/** Statuses on which the requester may run Phase 4 matching. */
export const MATCHABLE_REQUEST_STATUSES: readonly BloodRequestStatus[] = [
  "PENDING",
  "MATCHING",
  "NO_MATCH_FOUND",
];

export function canRunMatching(status: BloodRequestStatus): boolean {
  return (MATCHABLE_REQUEST_STATUSES as readonly string[]).includes(status);
}
