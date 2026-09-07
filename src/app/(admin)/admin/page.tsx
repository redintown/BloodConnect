import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";

export default function AdminHomePage() {
  return (
    <PageShell title="Admin dashboard" phaseNote="Full admin dashboard + analytics land in Phase 9.">
      <div className="flex flex-col gap-2">
        <Link href="/admin/users" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Users
        </Link>
        <Link href="/admin/requests" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Requests
        </Link>
        <Link href="/admin/verification" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Verification queue
        </Link>
      </div>
    </PageShell>
  );
}
