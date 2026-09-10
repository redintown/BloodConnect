import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * @deprecated Transitional shell. New and redesigned screens should compose
 * `AppShell` + `PageHeader` directly, which support navigation slots and the
 * full responsive width scale.
 *
 * It is kept so the Phase 0–10 routes keep rendering unchanged while screens
 * migrate in later Phase 11 sub-phases. It now provides the token typography,
 * responsive padding and the `#main-content` skip-link target instead of the
 * old fixed 24px / phone-column layout.
 *
 * Pass `embedded` when the page already lives inside AppShell (which owns the
 * `main` landmark). Embedded mode renders a plain region so we never nest
 * two mains or duplicate the skip target.
 *
 * The `phaseNote` prop is accepted but intentionally no longer rendered:
 * internal build-phase language ("Wires up in Phase 9") must not appear in a
 * healthcare product. Call sites keep compiling; the note simply disappears.
 */
export function PageShell({
  title,
  children,
  embedded = false,
}: {
  title: string;
  /** @deprecated No longer rendered. Remove when migrating the screen. */
  phaseNote?: string;
  /** True when AppShell (or another layout) already provides `<main>`. */
  embedded?: boolean;
  children?: React.ReactNode;
}) {
  const className = cn(
    "flex w-full flex-col gap-6 outline-none",
    embedded
      ? "max-w-none"
      : "mx-auto min-h-dvh max-w-form px-4 py-6 sm:px-6"
  );

  if (embedded) {
    return (
      <div className={className}>
        <PageHeader title={title} />
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className={className}>
      <PageHeader title={title} />
      <div className="flex flex-col gap-4">{children}</div>
    </main>
  );
}
