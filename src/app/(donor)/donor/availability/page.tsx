import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { AvailabilitySelector } from "@/components/forms/AvailabilitySelector";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";

export default async function DonorAvailabilityPage() {
  const user = await requireRole("DONOR");
  const profile = await donorService.getOwnProfile(user.id);

  return (
    <PageShell title="Availability">
      {profile ? (
        <AvailabilitySelector
          isAvailable={profile.isAvailable}
          isAvailableAtNight={profile.isAvailableAtNight}
        />
      ) : (
        <p className="text-gray-600">
          Complete your{" "}
          <Link href="/donor/profile" className="font-medium text-emergency">
            donor profile
          </Link>{" "}
          before setting availability.
        </p>
      )}
      <Link href="/donor" className="text-sm text-gray-500 hover:text-gray-800">
        ← Donor home
      </Link>
    </PageShell>
  );
}
