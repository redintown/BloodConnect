import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminRequestsPage() {
  return (
    <PageShell title="Request moderation" phaseNote="Wires up to bloodRequestService + audit_logs in Phase 9.">
      <EmptyState title="No requests to moderate" />
    </PageShell>
  );
}
