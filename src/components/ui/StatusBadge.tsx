import { type BloodRequestStatus } from "@/lib/constants/requestStatus";
import { StatusChip } from "@/components/ui/StatusChip";

/**
 * @deprecated Use `<StatusChip kind="request" value={…} />` directly.
 *
 * Kept as a thin delegating wrapper so the Phase 0–10 call sites keep
 * working unchanged while screens migrate in later Phase 11 sub-phases.
 * Behaviour is identical; only the presentation now comes from the shared
 * status system.
 */
export function StatusBadge({ status }: { status: BloodRequestStatus }) {
  return <StatusChip kind="request" value={status} />;
}
