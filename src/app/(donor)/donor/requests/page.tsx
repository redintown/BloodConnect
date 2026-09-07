import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DonorRequestsPage() {
  return (
    <PageShell title="Requests near me" phaseNote="Matched requests + accept/decline land in Phase 5.">
      <EmptyState title="No active requests" description="Compatible nearby requests will appear here." />
    </PageShell>
  );
}
