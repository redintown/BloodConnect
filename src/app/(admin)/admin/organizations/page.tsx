import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminOrganizationReviewCard } from "@/components/forms/AdminOrganizationReviewCard";
import { verificationService } from "@/services/verificationService";

export default async function AdminOrganizationsPage() {
  const pending = await verificationService.listPendingOrganizations();

  return (
    <PageShell title="Organization verification">
      <p className="text-sm text-gray-600">
        Review pending hospitals and blood banks. Donor verification remains Phase 9.
      </p>
      {pending.length === 0 ? (
        <EmptyState
          title="No pending organizations"
          description="Submitted hospital and blood bank profiles will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((org) => (
            <AdminOrganizationReviewCard key={`${org.organizationType}:${org.id}`} org={org} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
