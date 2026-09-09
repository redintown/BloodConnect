import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { Button, buttonClassName } from "@/components/ui/Button";

/**
 * Recoverable-failure surface for route error boundaries and failed panels.
 *
 * Rules:
 *  - the message must be user-safe. Never pass a raw Error message, database
 *    error, stack or SQL text into this component;
 *  - offer a retry where the operation is retryable, and an escape route
 *    (back/home) so the user is never trapped;
 *  - `reference` is for a safe correlation id (e.g. Next.js error digest)
 *    to help support, not for diagnostic detail.
 *
 * The original `{ message, onRetry }` signature is preserved.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "We could not load this. Please try again.",
  onRetry,
  retryLabel = "Try again",
  backHref,
  backLabel = "Back to home",
  reference,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  backHref?: string;
  backLabel?: string;
  reference?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface px-6 py-10 text-center",
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-danger-surface text-danger">
        <Icon name="alert-circle" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-h3 text-text">{title}</p>
        <p className="max-w-prose text-body text-text-secondary">{message}</p>
      </div>

      {(onRetry || backHref) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button variant="primary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {backHref && (
            <Link href={backHref} className={buttonClassName({ variant: "secondary", size: "sm" })}>
              {backLabel}
            </Link>
          )}
        </div>
      )}

      {reference && (
        <p className="text-caption text-text-tertiary">
          Reference: <span className="tabular-nums">{reference}</span>
        </p>
      )}
    </div>
  );
}
