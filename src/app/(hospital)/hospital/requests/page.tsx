import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function HospitalRequestsPage() {
  return (
    <PageShell title="Requests" phaseNote="Escalated requests reach hospitals in Phase 7.">
      <EmptyState title="No requests yet" />
    </PageShell>
  );
}
