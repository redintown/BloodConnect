import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { hospitalService } from "@/services/hospitalService";

export default async function HospitalHomePage() {
  const profile = await hospitalService.getOwnProfile();

  return (
    <PageShell title="Hospital dashboard">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
        {profile ? (
          <>
            <p className="font-semibold text-gray-900">{profile.name}</p>
            <p className="text-gray-700">Verification: {profile.verificationStatus}</p>
            <p className="text-gray-600">
              24h emergency: {profile.has24hEmergency ? "Yes" : "No"}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Role HOSPITAL does not mean verified. Only VERIFIED hospitals are escalated to.
            </p>
          </>
        ) : (
          <p className="text-gray-700">
            No hospital profile yet. Create one to request verification.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Link href="/hospital/profile" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Organization profile
        </Link>
        <Link href="/hospital/requests" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Escalated requests
        </Link>
        <Link href="/hospital/inventory" className="rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
          Blood inventory
          <span className="mt-1 block text-xs text-gray-400">Phase 8B</span>
        </Link>
      </div>
    </PageShell>
  );
}
