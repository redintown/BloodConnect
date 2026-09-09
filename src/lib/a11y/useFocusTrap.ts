"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement
  );
}

/**
 * Modal keyboard/focus behaviour, shared by every dialog surface.
 *
 * While active it:
 *  - remembers the element that opened the dialog and restores focus to it
 *    on close (so keyboard users are not dumped at the top of the page);
 *  - moves initial focus into the dialog (preferring [data-autofocus]);
 *  - keeps Tab / Shift+Tab cycling inside the container;
 *  - calls onEscape for the Escape key;
 *  - locks background scroll.
 *
 * This is the behaviour the existing DonorMatchPopup lacks; the popup can be
 * migrated onto this foundation in a later sub-phase.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  {
    active,
    onEscape,
    restoreFocus = true,
  }: { active: boolean; onEscape?: () => void; restoreFocus?: boolean }
) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const node = containerRef.current;
    if (!node) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const preferred = node.querySelector<HTMLElement>("[data-autofocus]");
    const initial = preferred ?? getFocusable(node)[0] ?? node;
    initial.focus({ preventScroll: true });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusable(node);
      const first = focusable.at(0);
      const last = focusable.at(-1);

      // Nothing focusable inside: swallow Tab so focus cannot escape.
      if (!first || !last) {
        event.preventDefault();
        return;
      }

      const activeElement = document.activeElement;
      const outside = !node.contains(activeElement);

      if (event.shiftKey && (activeElement === first || outside)) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && (activeElement === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (restoreFocus) {
        previouslyFocused.current?.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, onEscape, restoreFocus]);
}
