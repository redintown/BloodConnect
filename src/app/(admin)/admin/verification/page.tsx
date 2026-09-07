import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminVerificationPage() {
  return (
    <PageShell title="Verification queue" phaseNote="Donor/hospital/blood-bank verification actions land in Phase 9.">
      <EmptyState title="Nothing pending verification" />
    </PageShell>
  );
}
