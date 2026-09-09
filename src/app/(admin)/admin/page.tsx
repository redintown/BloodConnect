import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";

export default function AdminHomePage() {
  return (
    <PageShell title="Admin dashboard" phaseNote="Broader admin tools and analytics land in Phase 9.">
      <div className="flex flex-col gap-2">
        <Link href="/admin/escalations" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Escalation queue
        </Link>
        <Link
          href="/admin/organizations"
          className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
        >
          Organization verification
        </Link>
        <Link href="/admin/users" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Users
          <span className="mt-1 block text-xs text-gray-400">Phase 9</span>
        </Link>
        <Link href="/admin/requests" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Requests
          <span className="mt-1 block text-xs text-gray-400">Phase 9</span>
        </Link>
      </div>
    </PageShell>
  );
}
