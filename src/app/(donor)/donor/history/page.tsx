import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";

export default async function DonorHistoryPage() {
  const user = await requireRole("DONOR");
  const donations = await donorService.getDonationHistory(user.id);

  return (
    <PageShell title="Donation history">
      {donations.length === 0 ? (
        <EmptyState
          title="No donations recorded yet"
          description="Completed donations will show up here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {donations.map((donation) => (
            <li key={donation.id} className="rounded-xl border border-gray-200 p-4">
              <p className="font-medium text-gray-800">
                {new Date(donation.donatedAt).toLocaleDateString()}
              </p>
              {donation.quantityMl != null && (
                <p className="text-sm text-gray-600">{donation.quantityMl} ml</p>
              )}
              {donation.notes && <p className="text-sm text-gray-500">{donation.notes}</p>}
            </li>
          ))}
        </ul>
      )}
      <Link href="/donor" className="text-sm text-gray-500 hover:text-gray-800">
        ← Donor home
      </Link>
    </PageShell>
  );
}
