import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { bloodBankService } from "@/services/bloodBankService";

export default async function BloodBankHomePage() {
  const profile = await bloodBankService.getOwnProfile();

  return (
    <PageShell title="Blood bank dashboard">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
        {profile ? (
          <>
            <p className="font-semibold text-gray-900">{profile.name}</p>
            <p className="text-gray-700">Verification: {profile.verificationStatus}</p>
            {profile.emergencyHours && (
              <p className="text-gray-600">Emergency hours: {profile.emergencyHours}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Role BLOOD_BANK does not mean verified. Only VERIFIED banks are escalated to.
            </p>
          </>
        ) : (
          <p className="text-gray-700">
            No blood bank profile yet. Create one to request verification.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href="/blood-bank/profile"
          className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
        >
          Organization profile
        </Link>
        <Link
          href="/blood-bank/requests"
          className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
        >
          Escalated requests
        </Link>
        <Link
          href="/blood-bank/inventory"
          className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
        >
          Blood inventory
          <span className="mt-1 block text-xs text-gray-400">Phase 8B</span>
        </Link>
      </div>
    </PageShell>
  );
}
