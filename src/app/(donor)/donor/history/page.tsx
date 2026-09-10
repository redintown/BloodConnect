import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";
import type { DonationRecord } from "@/types/domain";

function DonationHistoryCard({ donation }: { donation: DonationRecord }) {
  const donatedLabel = new Date(donation.donatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body-strong text-text">{donatedLabel}</h3>
        <span className="inline-flex items-center rounded-sm border border-success/20 bg-success-surface px-2 py-0.5 text-caption font-medium text-success">
          Completed donation
        </span>
      </div>
      {donation.quantityMl != null && (
        <p className="text-body text-text-secondary">
          Volume recorded:{" "}
          <span className="tabular-nums text-text">{donation.quantityMl} ml</span>
        </p>
      )}
      {donation.notes && (
        <p className="text-body text-text-secondary">{donation.notes}</p>
      )}
    </article>
  );
}

export default async function DonorHistoryPage() {
  const user = await requireRole("DONOR");
  const donations = await donorService.getDonationHistory(user.id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Donation history"
        description="Completed donations recorded for your donor profile."
      />

      {donations.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="No completed donations recorded yet"
          description="When a donation is confirmed, it will appear here."
          action={
            <Link href="/donor" className={buttonClassName({ variant: "secondary", size: "sm" })}>
              Donor home
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="donation-records-heading" className="flex flex-col gap-3">
          <SectionHeader
            id="donation-records-heading"
            title="Recorded donations"
            count={donations.length}
          />
          <ul className="flex flex-col gap-3">
            {donations.map((donation) => (
              <li key={donation.id}>
                <DonationHistoryCard donation={donation} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/donor"
        className="inline-flex min-h-control w-fit items-center gap-1 rounded-md px-1 text-label text-text-secondary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
      >
        <Icon name="chevron-left" className="h-4 w-4" />
        Donor home
      </Link>
    </div>
  );
}
