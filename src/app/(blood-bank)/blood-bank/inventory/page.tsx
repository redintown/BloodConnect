import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function BloodBankInventoryPage() {
  return (
    <PageShell title="Blood inventory" phaseNote="Inventory management lands in Phase 8.">
      <EmptyState title="No inventory recorded yet" />
    </PageShell>
  );
}
