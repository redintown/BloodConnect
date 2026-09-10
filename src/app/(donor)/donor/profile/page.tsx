import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DonorProfileForm } from "@/components/forms/DonorProfileForm";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";
import { Icon } from "@/components/ui/Icon";

export default async function DonorProfilePage() {
  const user = await requireRole("DONOR");
  const profile = await donorService.getOwnProfile(user.id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Donor profile"
        description="Blood group, last donation, and location are used for matching. Other people never see your exact coordinates."
      />

      <DonorProfileForm profile={profile} />

      <Link
        href="/donor"
        className="inline-flex min-h-control w-fit items-center gap-1 rounded-md px-1 text-label text-text-secondary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
      >
        <Icon name="chevron-left" className="h-4 w-4" />
        Donor home
      </Link>
    </div>
  );
}
