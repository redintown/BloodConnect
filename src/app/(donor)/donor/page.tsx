import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";
import { matchResponseService } from "@/services/matchResponseService";
import { nextEligibleDate } from "@/lib/donors/eligibility";
import { selectActionableDonorMatches } from "@/lib/matches/responseRules";
import type { DonorInboxMatch } from "@/types/domain";

const LINKS = [
  { href: "/donor/profile", label: "My donor profile" },
  { href: "/donor/availability", label: "Set availability" },
  { href: "/donor/requests", label: "Requests near me" },
  { href: "/donor/history", label: "Donation history" },
];

export default async function DonorHomePage() {
  const user = await requireRole("DONOR");
  const profile = await donorService.getOwnProfile(user.id);

  let actionableCount = 0;
  let nonActionableOpenCount = 0;

  if (profile) {
    try {
      const inbox: DonorInboxMatch[] = await matchResponseService.listMatchesForDonor(user.id);
      actionableCount = selectActionableDonorMatches(inbox).length;
      nonActionableOpenCount = inbox.filter(
        (m) =>
          ["MATCHED", "NOTIFIED", "VIEWED"].includes(m.matchStatus) &&
          m.request.status !== "MATCHING"
      ).length;
    } catch {
      // Banner is optional; layout overlay owns the primary match UX.
    }
  }

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

      {actionableCount > 0 && (
        <p className="rounded-xl border border-emergency/30 bg-emergency/5 px-4 py-3 text-sm text-gray-800">
          You have {actionableCount} blood request
          {actionableCount === 1 ? "" : "s"} waiting for a response.{" "}
          <Link href="/donor/requests" className="font-medium text-emergency hover:text-emergency-hover">
            Open requests
          </Link>
        </p>
      )}

      {actionableCount === 0 && nonActionableOpenCount > 0 && (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          You have {nonActionableOpenCount} match
          {nonActionableOpenCount === 1 ? "" : "es"} that{" "}
          {nonActionableOpenCount === 1 ? "is" : "are"} no longer open for a response
          (request not in Matching).{" "}
          <Link href="/donor/requests" className="font-medium text-emergency hover:text-emergency-hover">
            View requests
          </Link>
        </p>
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
