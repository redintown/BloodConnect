import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminDonorReviewCard } from "@/components/forms/AdminDonorReviewCard";
import { verificationService } from "@/services/verificationService";

/**
 * Admin donor verification queue.
 *
 * Presentation only — `verificationService.listPendingDonors()` is the
 * exact existing query, already ordered oldest-first. No client-side
 * sorting/filtering/pagination, no invented counts, no new data loading,
 * no eligibility calculation.
 */
export default async function AdminDonorsPage() {
  const pending = await verificationService.listPendingDonors();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Donor verification"
        description="Review pending donor profiles. Organization verification is a separate queue."
      />

      <section aria-labelledby="pending-donors-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="pending-donors-heading"
          title="Pending donors"
          description="Oldest submissions first."
        />

        {pending.length === 0 ? (
          <EmptyState
            icon="droplet"
            title="No pending donors"
            description="Submitted donor profiles will appear here for review."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((donor) => (
              <AdminDonorReviewCard key={donor.donorId} donor={donor} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
