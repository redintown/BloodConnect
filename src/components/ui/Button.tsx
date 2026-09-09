import { cn } from "@/lib/utils/cn";
import { Spinner } from "@/components/ui/Icon";

/**
 * The single button primitive for the whole app.
 *
 * Variant rules (Clinical Infrastructure):
 *  - `primary`     ink fill — the one standard action per view.
 *  - `secondary`   bordered surface — the alternative beside primary.
 *  - `outline`     low-emphasis bordered action.
 *  - `ghost`       borderless inline/nav action.
 *  - `destructive` danger (#B42318) — irreversible acts, always confirmed.
 *  - `emergency`   emergency red (#DC2626) — reserved for emergency flows.
 *
 * Emergency red is never used for ordinary submits; that is what kept the
 * urgent signal invisible before Phase 11.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "emergency";

export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-text-tertiary",
  secondary:
    "border border-border-strong bg-surface text-text hover:bg-muted disabled:bg-muted disabled:text-text-tertiary",
  outline:
    "border border-border-strong bg-transparent text-text-secondary hover:bg-muted hover:text-text disabled:text-text-tertiary",
  ghost:
    "bg-transparent text-text-secondary hover:bg-muted hover:text-text disabled:text-text-tertiary",
  destructive:
    "bg-danger text-white hover:bg-danger/90 disabled:bg-muted disabled:text-text-tertiary",
  emergency:
    "bg-emergency text-white hover:bg-emergency-hover disabled:bg-muted disabled:text-text-tertiary",
};

const SIZES: Record<ButtonSize, string> = {
  // 44px floor on mobile, 40px on pointer-precise viewports.
  sm: "min-h-control sm:min-h-control-desktop px-3 text-label",
  md: "min-h-control sm:min-h-control-desktop px-4 text-body-strong",
  lg: "min-h-[52px] px-6 text-urgent",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className
  );
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner, blocks input and sets aria-busy. */
  loading?: boolean;
  /** Optional label swap while loading. Omit to keep width stable. */
  loadingLabel?: string;
  /** Marks this button as the initial focus target inside a Modal. */
  "data-autofocus"?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && <Spinner />}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}
