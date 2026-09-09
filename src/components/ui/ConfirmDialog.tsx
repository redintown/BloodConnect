"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * Confirmation for destructive or irreversible actions. This is the
 * replacement for `window.confirm`, which cannot be styled, cannot be
 * tested and does not match the product's voice.
 *
 * UX rules:
 *  - state the consequence in `description`, not just "Are you sure?";
 *  - for destructive actions the CANCEL button receives initial focus, so a
 *    stray Enter keypress cannot destroy data;
 *  - the dialog is not dismissible while the action is in flight.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  loading = false,
  loadingLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` for data loss, `emergency` for emergency escalation. */
  tone?: "primary" | "destructive" | "emergency";
  loading?: boolean;
  loadingLabel?: string;
  children?: React.ReactNode;
}) {
  const destructive = tone === "destructive";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      placement="center"
      dismissible={!loading}
      showCloseButton={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            fullWidth
            className="sm:w-auto"
            // Destructive actions must not be one Enter press away.
            {...(destructive ? { "data-autofocus": true } : {})}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            onClick={onConfirm}
            loading={loading}
            loadingLabel={loadingLabel}
            fullWidth
            className="sm:w-auto"
            {...(destructive ? {} : { "data-autofocus": true })}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}
