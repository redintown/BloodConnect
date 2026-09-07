import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { BloodRequestForm } from "@/components/forms/BloodRequestForm";

export default function RequestBloodPage() {
  return (
    <PageShell title="Request blood">
      <p className="text-sm text-gray-600">
        Tell us what you need. One tap creates the request and searches nearby compatible donors.
      </p>
      <BloodRequestForm mode="create" />
      <Link href="/requests" className="text-sm text-gray-500 hover:text-gray-800">
        View my requests
      </Link>
    </PageShell>
  );
}
