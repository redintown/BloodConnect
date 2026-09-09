"use client";

import { Modal } from "@/components/ui/Modal";

/**
 * Mobile-primary overlay surface: bottom-anchored below 640px, centered
 * dialog from 640px up. Content scrolls inside the panel (max 90dvh) so the
 * sheet never grows past the viewport and primary actions stay reachable.
 *
 * Use for: match responses, filters, and any mobile action surface.
 * For a yes/no confirmation, use <ConfirmDialog> instead.
 *
 * Inherits the full a11y contract from Modal (focus trap, Escape, focus
 * restoration, correct role placement). This is the intended replacement
 * for DonorMatchPopup's bespoke overlay in a later sub-phase.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  footer,
  dismissible = true,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Sticky action area — keep the primary action here on mobile. */
  footer?: React.ReactNode;
  dismissible?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      placement="sheet"
      dismissible={dismissible}
      footer={footer}
      className={className}
    >
      {children}
    </Modal>
  );
}
