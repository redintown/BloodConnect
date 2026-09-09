import { LoadingState } from "@/components/ui/LoadingState";

/**
 * Route-level loading fallback for the whole tree. Before Phase 11B a
 * server-rendered page showed a blank screen while data loaded, which reads
 * as a broken app on a slow connection.
 *
 * Nested segments can add their own loading.tsx with a layout-matching
 * <SkeletonPanel> once their screens are redesigned.
 */
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-form flex-1 flex-col px-4 py-6 sm:px-6">
      <LoadingState label="Loading…" />
    </main>
  );
}
