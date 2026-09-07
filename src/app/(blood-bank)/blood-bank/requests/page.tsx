import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function BloodBankRequestsPage() {
  return (
    <PageShell title="Requests" phaseNote="Escalated requests reach blood banks in Phase 7.">
      <EmptyState title="No requests yet" />
    </PageShell>
  );
}
