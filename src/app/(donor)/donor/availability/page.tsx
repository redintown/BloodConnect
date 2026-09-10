import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { AvailabilitySelector } from "@/components/forms/AvailabilitySelector";
import { buttonClassName } from "@/components/ui/Button";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";
import { Icon } from "@/components/ui/Icon";

export default async function DonorAvailabilityPage() {
  const user = await requireRole("DONOR");
  const profile = await donorService.getOwnProfile(user.id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Availability"
        description="Control when you can normally receive blood requests, and whether Emergency Response can reach you separately."
      />

      {profile ? (
        <AvailabilitySelector
          isAvailable={profile.isAvailable}
          isAvailableAtNight={profile.isAvailableAtNight}
          emergencyResponseEnabled={profile.emergencyResponseEnabled}
          emergencyRadiusKm={profile.emergencyRadiusKm}
        />
      ) : (
        <Alert
          variant="warning"
          title="Complete your donor profile first"
          action={
            <Link
              href="/donor/profile"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Open profile
            </Link>
          }
        >
          Availability and Emergency Response settings need a saved donor profile.
        </Alert>
      )}

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
