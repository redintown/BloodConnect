import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminUsersPage() {
  return (
    <PageShell title="Users" phaseNote="Wires up to adminService.listUsers in Phase 9.">
      <EmptyState title="No users loaded" />
    </PageShell>
  );
}
