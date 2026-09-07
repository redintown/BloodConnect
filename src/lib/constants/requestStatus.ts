export const BLOOD_REQUEST_STATUSES = [
  "PENDING",
  "MATCHING",
  "DONOR_CONTACTED",
  "DONOR_ACCEPTED",
  "DONOR_ON_THE_WAY",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "NO_MATCH_FOUND",
] as const;

export type BloodRequestStatus = (typeof BLOOD_REQUEST_STATUSES)[number];

export const DONOR_RESPONSE_STATUSES = [
  "MATCHED",
  "NOTIFIED",
  "VIEWED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
] as const;

export type DonorResponseStatus = (typeof DONOR_RESPONSE_STATUSES)[number];

export const REQUEST_URGENCIES = ["CRITICAL", "HIGH", "MODERATE"] as const;
export type RequestUrgency = (typeof REQUEST_URGENCIES)[number];

export const STATUS_LABELS: Record<BloodRequestStatus, string> = {
  PENDING: "Pending",
  MATCHING: "Finding donors",
  DONOR_CONTACTED: "Donor contacted",
  DONOR_ACCEPTED: "Donor accepted",
  DONOR_ON_THE_WAY: "Donor on the way",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  NO_MATCH_FOUND: "No match found",
};
