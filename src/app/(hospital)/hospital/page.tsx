import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";

export default function HospitalHomePage() {
  return (
    <PageShell title="Hospital dashboard" phaseNote="Hospital profile + verification land in Phase 8.">
      <div className="flex flex-col gap-2">
        <Link href="/hospital/requests" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Incoming requests
        </Link>
        <Link href="/hospital/inventory" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Blood inventory
        </Link>
      </div>
    </PageShell>
  );
}
