import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminOrganizationReviewCard } from "@/components/forms/AdminOrganizationReviewCard";
import { verificationService } from "@/services/verificationService";

/**
 * Admin organization verification queue.
 *
 * Presentation only — `verificationService.listPendingOrganizations()` is
 * the exact existing query, already ordered oldest-first. No client-side
 * sorting/filtering/pagination, no invented counts, no new data loading.
 */
export default async function AdminOrganizationsPage() {
  const pending = await verificationService.listPendingOrganizations();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Organization verification"
        description="Review pending hospitals and blood banks. Donor verification is a separate queue."
      />

      <section aria-labelledby="pending-organizations-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="pending-organizations-heading"
          title="Pending organizations"
          description="Oldest submissions first."
        />

        {pending.length === 0 ? (
          <EmptyState
            icon="building"
            title="No pending organizations"
            description="Submitted hospital and blood bank profiles will appear here for review."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((org) => (
              <AdminOrganizationReviewCard key={`${org.organizationType}:${org.id}`} org={org} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
