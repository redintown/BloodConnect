import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";
import { nextEligibleDate } from "@/lib/donors/eligibility";

const LINKS = [
  { href: "/donor/profile", label: "My donor profile" },
  { href: "/donor/availability", label: "Set availability" },
  { href: "/donor/requests", label: "Requests near me" },
  { href: "/donor/history", label: "Donation history" },
];

export default async function DonorHomePage() {
  const user = await requireRole("DONOR");
  const profile = await donorService.getOwnProfile(user.id);

  return (
    <PageShell title="Donor dashboard">
      {profile ? (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <BloodGroupBadge bloodGroup={profile.bloodGroup} />
            <AvailabilityBadge
              isAvailable={profile.isAvailable}
              isAvailableAtNight={profile.isAvailableAtNight}
            />
          </div>
          <p className="text-sm text-gray-700">
            {profile.isEligible
              ? "Eligible to donate"
              : `Not eligible yet${
                  profile.lastDonationDate
                    ? ` — wait until ${nextEligibleDate(profile.lastDonationDate) ?? ""}`
                    : ""
                }`}
          </p>
        </div>
      ) : (
        <Link
          href="/donor/profile"
          className="rounded-xl border border-emergency/40 bg-emergency/5 p-4 font-medium text-emergency"
        >
          Complete your donor profile to start matching.
        </Link>
      )}

      <div className="flex flex-col gap-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-gray-200 p-3 text-gray-700 hover:bg-gray-50"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
