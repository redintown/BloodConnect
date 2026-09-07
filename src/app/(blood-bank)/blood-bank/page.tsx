import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";

export default function BloodBankHomePage() {
  return (
    <PageShell title="Blood bank dashboard" phaseNote="Blood bank profile + verification land in Phase 8.">
      <div className="flex flex-col gap-2">
        <Link href="/blood-bank/requests" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Incoming requests
        </Link>
        <Link href="/blood-bank/inventory" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Blood inventory
        </Link>
      </div>
    </PageShell>
  );
}
