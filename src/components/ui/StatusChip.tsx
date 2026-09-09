import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import {
  STATUS_LABELS,
  type BloodRequestStatus,
  type DonorResponseStatus,
} from "@/lib/constants/requestStatus";
import {
  ESCALATION_LEVELS,
  type EscalationLevel,
  type VerificationStatus,
} from "@/lib/constants/verification";

/**
 * One status primitive for all four status families.
 *
 * This is presentation only — it maps existing business values to human
 * labels and tones. It never changes, filters or reinterprets a status, and
 * it never renders a raw enum string to the user.
 *
 * Each family gets its own SHAPE so a request status can never be mistaken
 * for a match status, and colour is never the only signal:
 *   request      → pill with a leading state dot
 *   match        → rectangular chip
 *   verification → chip with a check/lock/alert glyph
 *   escalation   → chip with a 4-step level indicator
 */
type Tone = "neutral" | "muted" | "info" | "success" | "warning" | "danger" | "emergency";

const TONES: Record<Tone, { chip: string; dot: string }> = {
  neutral: { chip: "bg-muted text-text-secondary border-border", dot: "bg-text-tertiary" },
  muted: { chip: "bg-muted text-text-tertiary border-border", dot: "bg-text-tertiary" },
  info: { chip: "bg-info-surface text-info border-info/20", dot: "bg-info" },
  success: { chip: "bg-success-surface text-success border-success/20", dot: "bg-success" },
  warning: { chip: "bg-warning-surface text-warning border-warning/20", dot: "bg-warning" },
  danger: { chip: "bg-danger-surface text-danger border-danger/20", dot: "bg-danger" },
  emergency: {
    chip: "bg-emergency-surface text-emergency border-emergency/25",
    dot: "bg-emergency",
  },
};

/** Request lifecycle. Labels reuse the existing single source of truth. */
const REQUEST_TONES: Record<BloodRequestStatus, Tone> = {
  PENDING: "neutral",
  MATCHING: "info",
  DONOR_CONTACTED: "info",
  DONOR_ACCEPTED: "success",
  DONOR_ON_THE_WAY: "success",
  COMPLETED: "success",
  CANCELLED: "muted",
  EXPIRED: "muted",
  // Actionable (escalate / retry), not a failure — so warning, not red.
  NO_MATCH_FOUND: "warning",
};

export const MATCH_STATUS_LABELS: Record<DonorResponseStatus, string> = {
  MATCHED: "Matched",
  NOTIFIED: "Notified",
  VIEWED: "Seen",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

const MATCH_TONES: Record<DonorResponseStatus, Tone> = {
  MATCHED: "neutral",
  NOTIFIED: "info",
  VIEWED: "info",
  ACCEPTED: "success",
  DECLINED: "muted",
  EXPIRED: "muted",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: "Not submitted",
  PENDING: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Needs changes",
};

const VERIFICATION_META: Record<VerificationStatus, { tone: Tone; icon: IconName }> = {
  UNVERIFIED: { tone: "neutral", icon: "lock" },
  PENDING: { tone: "warning", icon: "clock" },
  VERIFIED: { tone: "success", icon: "check" },
  REJECTED: { tone: "danger", icon: "alert-circle" },
};

/**
 * Escalation covers both the event status (OPEN/RESOLVED/CANCELLED) and an
 * organization target's response (PENDING/ACKNOWLEDGED/CAN_SUPPLY/CANNOT_HELP).
 */
export type EscalationStatusValue =
  | "OPEN"
  | "RESOLVED"
  | "CANCELLED"
  | "PENDING"
  | "ACKNOWLEDGED"
  | "CAN_SUPPLY"
  | "CANNOT_HELP";

export const ESCALATION_STATUS_LABELS: Record<EscalationStatusValue, string> = {
  OPEN: "Awaiting response",
  PENDING: "Awaiting response",
  ACKNOWLEDGED: "Acknowledged",
  CAN_SUPPLY: "Can supply",
  CANNOT_HELP: "Cannot help",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

const ESCALATION_TONES: Record<EscalationStatusValue, Tone> = {
  OPEN: "emergency",
  PENDING: "emergency",
  ACKNOWLEDGED: "info",
  CAN_SUPPLY: "success",
  CANNOT_HELP: "muted",
  RESOLVED: "success",
  CANCELLED: "muted",
};

export const ESCALATION_LEVEL_LABELS: Record<EscalationLevel, string> = {
  NEARBY_DONORS: "Nearby donors",
  WIDER_RADIUS: "Wider radius",
  BLOOD_BANKS_HOSPITALS: "Blood banks and hospitals",
  ADMIN_INTERVENTION: "Admin intervention",
};

/**
 * Defensive fallback. Never surfaces a raw SCREAMING_SNAKE value; if an
 * unmapped value ever arrives it degrades to sentence case.
 */
export function humanizeStatus(value: string): string {
  const words = value.toLowerCase().replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown";
}

const BASE =
  "inline-flex items-center gap-1.5 border px-2 py-0.5 text-caption font-medium whitespace-nowrap";

export type StatusChipProps =
  | { kind: "request"; value: BloodRequestStatus; className?: string }
  | { kind: "match"; value: DonorResponseStatus; className?: string }
  | { kind: "verification"; value: VerificationStatus; className?: string }
  | {
      kind: "escalation";
      value: EscalationStatusValue;
      level?: EscalationLevel;
      className?: string;
    };

export function StatusChip(props: StatusChipProps) {
  if (props.kind === "request") {
    const tone = TONES[REQUEST_TONES[props.value] ?? "neutral"];
    return (
      <span className={cn(BASE, "rounded-pill", tone.chip, props.className)}>
        <span className={cn("h-1.5 w-1.5 rounded-pill", tone.dot)} aria-hidden />
        {STATUS_LABELS[props.value] ?? humanizeStatus(props.value)}
      </span>
    );
  }

  if (props.kind === "match") {
    const tone = TONES[MATCH_TONES[props.value] ?? "neutral"];
    return (
      <span className={cn(BASE, "rounded-sm", tone.chip, props.className)}>
        {MATCH_STATUS_LABELS[props.value] ?? humanizeStatus(props.value)}
      </span>
    );
  }

  if (props.kind === "verification") {
    const meta = VERIFICATION_META[props.value] ?? { tone: "neutral", icon: "lock" as IconName };
    const tone = TONES[meta.tone];
    return (
      <span className={cn(BASE, "rounded-sm", tone.chip, props.className)}>
        <Icon name={meta.icon} className="h-3.5 w-3.5" />
        {VERIFICATION_STATUS_LABELS[props.value] ?? humanizeStatus(props.value)}
      </span>
    );
  }

  const tone = TONES[ESCALATION_TONES[props.value] ?? "neutral"];
  const levelIndex = props.level ? ESCALATION_LEVELS.indexOf(props.level) : -1;

  return (
    <span className={cn(BASE, "rounded-sm", tone.chip, props.className)}>
      {levelIndex >= 0 && (
        <>
          <span className="flex items-center gap-0.5" aria-hidden>
            {ESCALATION_LEVELS.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-2.5 w-0.5 rounded-pill",
                  index <= levelIndex ? tone.dot : "bg-current opacity-25"
                )}
              />
            ))}
          </span>
          <span className="sr-only">
            {`Escalation level ${levelIndex + 1} of ${ESCALATION_LEVELS.length}, ${
              ESCALATION_LEVEL_LABELS[props.level as EscalationLevel]
            }. `}
          </span>
        </>
      )}
      {ESCALATION_STATUS_LABELS[props.value] ?? humanizeStatus(props.value)}
    </span>
  );
}
