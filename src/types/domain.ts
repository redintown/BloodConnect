import type { AppRole } from "@/lib/constants/roles";
import type { BloodGroup } from "@/lib/constants/bloodGroups";
import type {
  BloodRequestStatus,
  DonorResponseStatus,
  RequestUrgency,
} from "@/lib/constants/requestStatus";
import type { VerificationStatus, EscalationLevel, NotificationChannel } from "@/lib/constants/verification";

/**
 * Hand-written domain types. These are what services, components, and Zod
 * schemas speak in. Keeping them separate from the generated `Database`
 * type means a Supabase schema-type regeneration never breaks half the
 * app's type signatures.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Profile {
  id: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: AppRole[];
  createdAt: string;
}

export interface DonorProfile {
  id: string;
  userId: string;
  bloodGroup: BloodGroup;
  lastDonationDate: string | null;
  isEligible: boolean;
  verificationStatus: VerificationStatus;
  /** Present only when the caller IS the donor. Never sent to other users. */
  location?: Coordinates | null;
  isAvailable: boolean;
  isAvailableAtNight: boolean;
}

export interface DonationRecord {
  id: string;
  donatedAt: string;
  quantityMl: number | null;
  notes: string | null;
}

/** What a requester is allowed to see about a candidate donor. */
export interface DonorPublicSummary {
  id: string;
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  isAvailableAtNight: boolean;
  verificationStatus: VerificationStatus;
  distanceKm: number | null;
}

export interface BloodRequest {
  id: string;
  requesterId: string;
  bloodGroup: BloodGroup;
  quantityUnits: number;
  urgency: RequestUrgency;
  requiredBy: string | null;
  hospitalId: string | null;
  hospitalNameFreeform: string | null;
  location: Coordinates;
  contactName: string;
  contactPhone: string;
  status: BloodRequestStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface BloodRequestMatch {
  id: string;
  bloodRequestId: string;
  donorId: string;
  score: number | null;
  distanceMeters: number | null;
  status: DonorResponseStatus;
  notifiedAt: string | null;
  respondedAt: string | null;
}

export interface Hospital {
  id: string;
  name: string;
  phone: string;
  address: string;
  location: Coordinates | null;
  has24hEmergency: boolean;
  verificationStatus: VerificationStatus;
}

export interface BloodBank {
  id: string;
  name: string;
  phone: string;
  address: string;
  location: Coordinates | null;
  emergencyHours: string | null;
  verificationStatus: VerificationStatus;
}

export interface BloodInventoryItem {
  id: string;
  ownerType: "HOSPITAL" | "BLOOD_BANK";
  ownerId: string;
  bloodGroup: BloodGroup;
  unitsAvailable: number;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  recipientId: string;
  bloodRequestId: string | null;
  channel: NotificationChannel;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  createdAt: string;
}

export interface EmergencyEvent {
  id: string;
  bloodRequestId: string;
  level: EscalationLevel;
  triggeredAt: string;
  notes: string | null;
}
