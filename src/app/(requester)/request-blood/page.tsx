import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { BloodRequestForm } from "@/components/forms/BloodRequestForm";
import { Icon } from "@/components/ui/Icon";

/**
 * Create blood request — presentation shell only.
 * Submission and matching still run through BloodRequestForm →
 * createBloodRequestAndFindDonorsAction.
 */
export default function RequestBloodPage() {
  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-8">
      <PageHeader
        title="Request blood"
        description="Tell us what is needed, where, and whether this is an emergency. Submitting creates the request and searches nearby compatible donors."
      />

      <BloodRequestForm mode="create" />

      <Link
        href="/requests"
        className="inline-flex min-h-control w-fit items-center gap-1 rounded-md px-1 text-label text-text-secondary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
      >
        <Icon name="chevron-left" className="h-4 w-4" />
        Back to my requests
      </Link>
    </div>
  );
}
