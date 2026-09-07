import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function RequestsPage() {
  return (
    <PageShell title="My requests" phaseNote="Live request list wires up to bloodRequestService in Phase 3.">
      <EmptyState title="No requests yet" description="Requests you create will show up here." />
    </PageShell>
  );
}
