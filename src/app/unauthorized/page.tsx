import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";

export default function UnauthorizedPage() {
  return (
    <PageShell title="Unauthorized">
      <p className="text-gray-600">You don&apos;t have permission to view this page.</p>
      <Link href="/" className="text-sm font-medium text-emergency">
        Back to home
      </Link>
    </PageShell>
  );
}
