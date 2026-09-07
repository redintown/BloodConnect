export const VERIFICATION_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ESCALATION_LEVELS = [
  "NEARBY_DONORS",
  "WIDER_RADIUS",
  "BLOOD_BANKS_HOSPITALS",
  "ADMIN_INTERVENTION",
] as const;
export type EscalationLevel = (typeof ESCALATION_LEVELS)[number];

export const NOTIFICATION_CHANNELS = ["WEB_PUSH", "SMS", "EMAIL", "WHATSAPP"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
