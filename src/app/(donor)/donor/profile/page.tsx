import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { DonorProfileForm } from "@/components/forms/DonorProfileForm";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";

export default async function DonorProfilePage() {
  const user = await requireRole("DONOR");
  const profile = await donorService.getOwnProfile(user.id);

  return (
    <PageShell title="My donor profile">
      <p className="text-sm text-gray-600">
        Blood group, last donation, and location are used for matching. Other people never see your exact coordinates.
      </p>
      <DonorProfileForm profile={profile} />
      <Link href="/donor" className="text-sm text-gray-500 hover:text-gray-800">
        ← Donor home
      </Link>
    </PageShell>
  );
}
