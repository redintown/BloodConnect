import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { BloodRequestForm } from "@/components/forms/BloodRequestForm";

export default function RequestBloodPage() {
  return (
    <PageShell title="Request blood">
      <p className="text-sm text-gray-600">
        Submit an emergency request. Nearby donor matching starts in a later phase — this creates the request only.
      </p>
      <BloodRequestForm mode="create" />
      <Link href="/requests" className="text-sm text-gray-500 hover:text-gray-800">
        View my requests
      </Link>
    </PageShell>
  );
}
