import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * Inline message block for form and page feedback.
 *
 * Accessibility: `danger` and `emergency` announce assertively (role="alert")
 * because they interrupt a task; `success` and `info` announce politely
 * (role="status") so async confirmations are not silent to screen readers.
 * `warning` is polite by default — pass `assertive` when it blocks progress.
 *
 * Do not use Alert for ordinary descriptive copy; it is for state changes.
 */
export type AlertVariant = "info" | "success" | "warning" | "danger" | "emergency";

const VARIANTS: Record<AlertVariant, { box: string; icon: IconName; iconColor: string }> = {
  info: {
    box: "border-info/20 bg-info-surface text-text",
    icon: "info",
    iconColor: "text-info",
  },
  success: {
    box: "border-success/20 bg-success-surface text-text",
    icon: "check",
    iconColor: "text-success",
  },
  warning: {
    box: "border-warning/25 bg-warning-surface text-text",
    icon: "alert-triangle",
    iconColor: "text-warning",
  },
  danger: {
    box: "border-danger/25 bg-danger-surface text-text",
    icon: "alert-circle",
    iconColor: "text-danger",
  },
  emergency: {
    box: "border-emergency/25 bg-emergency-surface text-text",
    icon: "alert-triangle",
    iconColor: "text-emergency",
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  action,
  assertive,
  className,
}: {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  /** Force assertive announcement for a normally polite variant. */
  assertive?: boolean;
  className?: string;
}) {
  const meta = VARIANTS[variant];
  const isAssertive = assertive || variant === "danger" || variant === "emergency";

  return (
    <div
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? undefined : "polite"}
      className={cn("flex gap-3 rounded-lg border p-3", meta.box, className)}
    >
      <Icon name={meta.icon} className={cn("mt-0.5 h-4 w-4", meta.iconColor)} />
      <div className="flex flex-col gap-1">
        {title && <p className="text-body-strong text-text">{title}</p>}
        {children && <div className="text-label font-normal text-text-secondary">{children}</div>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}
