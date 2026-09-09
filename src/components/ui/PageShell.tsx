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
 * The `phaseNote` prop is accepted but intentionally no longer rendered:
 * internal build-phase language ("Wires up in Phase 9") must not appear in a
 * healthcare product. Call sites keep compiling; the note simply disappears.
 */
export function PageShell({
  title,
  children,
}: {
  title: string;
  /** @deprecated No longer rendered. Remove when migrating the screen. */
  phaseNote?: string;
  children?: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-form flex-col gap-6 px-4 py-6 outline-none sm:px-6"
    >
      <PageHeader title={title} />
      <div className="flex flex-col gap-4">{children}</div>
    </main>
  );
}
