import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminDonorReviewCard } from "@/components/forms/AdminDonorReviewCard";
import { verificationService } from "@/services/verificationService";

export default async function AdminDonorsPage() {
  const pending = await verificationService.listPendingDonors();

  return (
    <PageShell title="Donor verification">
      <p className="text-sm text-gray-600">
        Review pending donors. Verified donors remain eligible for matching; rejected donors are excluded.
      </p>
      {pending.length === 0 ? (
        <EmptyState
          title="No pending donors"
          description="Submitted donor profiles will appear here for admin review."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((donor) => (
            <AdminDonorReviewCard key={donor.donorId} donor={donor} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

