"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

/**
 * Shared modal core for every overlay surface. Not used directly by screens —
 * use <BottomSheet> or <ConfirmDialog>.
 *
 * Accessibility handled here so no dialog can ship without it:
 *  - role="dialog" + aria-modal live on the PANEL, not on the backdrop
 *    (the existing DonorMatchPopup puts them on the backdrop);
 *  - title/description are wired via aria-labelledby / aria-describedby;
 *  - focus trap, Escape, focus restoration and scroll lock via useFocusTrap;
 *  - backdrop click closes only when dismissible.
 *
 * Placement:
 *  - "sheet"  → bottom-anchored on mobile (<640px), centered dialog from sm up
 *  - "center" → centered dialog at every size
 */
export type ModalPlacement = "sheet" | "center";

export function Modal({
  open,
  onClose,
  title,
  description,
  placement = "center",
  dismissible = true,
  showCloseButton = true,
  footer,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  placement?: ModalPlacement;
  /** When false, Escape and backdrop clicks do not close the dialog. */
  dismissible?: boolean;
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const titleId = `modal-title-${rawId}`;
  const descriptionId = `modal-description-${rawId}`;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useFocusTrap(panelRef, {
    active: open,
    onEscape: dismissible ? onClose : undefined,
  });

  if (!mounted || !open) return null;

  const isSheet = placement === "sheet";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-text/50",
        isSheet ? "items-end sm:items-center sm:p-4" : "items-center p-4"
      )}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "flex w-full flex-col bg-surface shadow-lg outline-none",
          "max-h-[90dvh] overflow-hidden",
          isSheet
            ? "rounded-t-dialog sm:max-w-form sm:rounded-dialog"
            : "max-w-[560px] rounded-dialog",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-h2 text-text">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-label font-normal text-text-secondary">
                {description}
              </p>
            )}
          </div>

          {showCloseButton && dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-1 -mt-1 flex min-h-control min-w-control items-center justify-center rounded-md text-text-tertiary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 sm:min-h-control-desktop sm:min-w-control-desktop"
            >
              <Icon name="x" />
            </button>
          )}
        </div>

        {children && (
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        )}

        {footer && (
          <div className="border-t border-border px-4 py-3 pb-safe sm:px-5">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
