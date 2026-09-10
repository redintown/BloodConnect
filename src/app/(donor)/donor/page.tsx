import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";
import { requireRole } from "@/services/authService";
import { donorService } from "@/services/donorService";
import { matchResponseService } from "@/services/matchResponseService";
import { nextEligibleDate } from "@/lib/donors/eligibility";
import { selectActionableDonorMatches } from "@/lib/matches/responseRules";
import type { DonorInboxMatch } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

/**
 * Donor dashboard — attention-first presentation.
 *
 * Data contract is unchanged: the same profile and inbox reads as before.
 * No new queries, no status transitions, and no second match modal.
 * The layout overlay remains the decision surface for actionable matches;
 * this page only summarises that a response is waiting.
 */
export default async function DonorHomePage() {
  const user = await requireRole("DONOR");
  const profile = await donorService.getOwnProfile(user.id);

  let actionableCount = 0;
  let nonActionableOpenCount = 0;
  let hasEmergencyActionable = false;

  if (profile) {
    try {
      const inbox: DonorInboxMatch[] = await matchResponseService.listMatchesForDonor(user.id);
      const actionable = selectActionableDonorMatches(inbox);
      actionableCount = actionable.length;
      hasEmergencyActionable = actionable.some((m) => m.request.isEmergency);
      nonActionableOpenCount = inbox.filter(
        (m) =>
          ["MATCHED", "NOTIFIED", "VIEWED"].includes(m.matchStatus) &&
          m.request.status !== "MATCHING"
      ).length;
    } catch {
      // Summary only; the portal layout owns the primary match UX.
    }
  }

  const availabilityLabel = !profile
    ? null
    : !profile.isAvailable
      ? "Not available"
      : profile.isAvailableAtNight
        ? "Available, including night"
        : "Available";

  const eligibilityWaitUntil =
    profile && !profile.isEligible && profile.lastDonationDate
      ? nextEligibleDate(profile.lastDonationDate)
      : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Your donor dashboard"
        description="Respond to matches, manage availability, and keep Emergency Response up to date."
      />

      {!profile && (
        <Alert
          variant="warning"
          title="Complete your donor profile"
          action={
            <Link
              href="/donor/profile"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Open profile
            </Link>
          }
        >
          Matching needs your blood group, location and availability before requests can reach you.
        </Alert>
      )}

      <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
        <SectionHeader id="attention-heading" title="Needs your response" />

        {actionableCount > 0 ? (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
              hasEmergencyActionable
                ? "border-emergency/25 border-l-[3px] border-l-emergency bg-emergency-surface"
                : "border-border bg-surface"
            )}
          >
            <div className="flex flex-col gap-1">
              <p
                className={cn(
                  "text-body-strong",
                  hasEmergencyActionable ? "text-emergency" : "text-text"
                )}
              >
                {hasEmergencyActionable
                  ? "Emergency response needed"
                  : "Response needed"}
              </p>
              <p className="text-body text-text-secondary">
                You have {actionableCount} blood request
                {actionableCount === 1 ? "" : "s"} waiting for your decision. A response
                dialog appears when a match needs you — you can also review them in Requests.
              </p>
            </div>
            <Link
              href="/donor/requests"
              className={buttonClassName({
                variant: hasEmergencyActionable ? "emergency" : "primary",
                size: "md",
                className: "shrink-0",
              })}
            >
              Open requests
            </Link>
          </div>
        ) : nonActionableOpenCount > 0 ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-body-strong text-text">No response needed right now</p>
              <p className="text-body text-text-secondary">
                You have {nonActionableOpenCount} match
                {nonActionableOpenCount === 1 ? "" : "es"} that{" "}
                {nonActionableOpenCount === 1 ? "is" : "are"} no longer open for a response.
              </p>
            </div>
            <Link
              href="/donor/requests"
              className={buttonClassName({ variant: "secondary", size: "sm", className: "shrink-0" })}
            >
              View requests
            </Link>
          </div>
        ) : (
          <EmptyState
            icon="inbox"
            title="No responses needed right now"
            description="When a compatible request is matched to you, it will appear here and as a response dialog."
            action={
              <Link
                href="/donor/requests"
                className={buttonClassName({ variant: "outline", size: "sm" })}
              >
                View requests
              </Link>
            }
          />
        )}
      </section>

      {profile && (
        <section
          aria-labelledby="status-heading"
          className="grid gap-3 sm:grid-cols-2"
        >
          <SectionHeader
            id="status-heading"
            title="Your status"
            className="sm:col-span-2"
          />

          {/* Emergency Response — separate from normal availability. */}
          <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-h3 text-text">Emergency Response</h3>
              <span
                className={cn(
                  "inline-flex items-center rounded-sm border px-2 py-0.5 text-caption font-medium",
                  profile.emergencyResponseEnabled
                    ? "border-info/20 bg-info-surface text-info"
                    : "border-border bg-muted text-text-secondary"
                )}
              >
                {profile.emergencyResponseEnabled ? "On" : "Off"}
              </span>
            </div>
            <p className="text-label font-normal text-text-secondary">
              {profile.emergencyResponseEnabled
                ? `Emergency requests can reach you within about ${profile.emergencyRadiusKm} km, even when normal availability is off.`
                : "When on, emergency requests can reach you within your chosen radius even if normal availability is off."}
            </p>
            <Link
              href="/donor/availability"
              className={buttonClassName({ variant: "outline", size: "sm", className: "mt-auto w-fit" })}
            >
              Manage Emergency Response
            </Link>
          </article>

          <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-h3 text-text">Normal availability</h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-caption font-medium",
                  profile.isAvailable
                    ? "border-success/20 bg-success-surface text-success"
                    : "border-border bg-muted text-text-secondary"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-pill",
                    profile.isAvailable ? "bg-success" : "bg-text-tertiary"
                  )}
                />
                {availabilityLabel}
              </span>
            </div>
            <p className="text-label font-normal text-text-secondary">
              Controls whether you appear in normal matching. Turning this off does not disable
              Emergency Response.
            </p>
            <Link
              href="/donor/availability"
              className={buttonClassName({ variant: "outline", size: "sm", className: "mt-auto w-fit" })}
            >
              Set availability
            </Link>
          </article>

          <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-h3 text-text">Eligibility</h3>
              <span
                className={cn(
                  "inline-flex items-center rounded-sm border px-2 py-0.5 text-caption font-medium",
                  profile.isEligible
                    ? "border-success/20 bg-success-surface text-success"
                    : "border-warning/25 bg-warning-surface text-warning"
                )}
              >
                {profile.isEligible ? "Eligible to donate" : "Not currently eligible"}
              </span>
            </div>
            <p className="text-label font-normal text-text-secondary">
              {profile.isEligible
                ? "You meet the current donation eligibility check used for matching."
                : eligibilityWaitUntil
                  ? `Wait until ${eligibilityWaitUntil} before you can be matched again.`
                  : "You are not eligible to be matched right now."}
            </p>
          </article>

          <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-h3 text-text">Profile</h3>
              <StatusChip kind="verification" value={profile.verificationStatus} />
            </div>
            <dl className="grid gap-2 text-label">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-secondary">Blood group</dt>
                <dd className="text-blood-group text-text">
                  {BLOOD_GROUP_LABELS[profile.bloodGroup]}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-secondary">Location</dt>
                <dd className="text-text">
                  {profile.location ? "Set" : "Not set"}
                </dd>
              </div>
            </dl>
            <Link
              href="/donor/profile"
              className={buttonClassName({ variant: "outline", size: "sm", className: "mt-auto w-fit" })}
            >
              Manage donor profile
            </Link>
          </article>
        </section>
      )}

      <section
        aria-labelledby="activity-heading"
        className="flex flex-col gap-3 border-t border-border pt-8"
      >
        <SectionHeader
          id="activity-heading"
          title="Donation history"
          description="Completed donations are listed on your history page — this dashboard does not load them separately."
        />
        <Link
          href="/donor/history"
          className="inline-flex min-h-control w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 text-body-strong text-text hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 sm:w-fit"
        >
          Open donation history
          <Icon name="chevron-right" className="h-4 w-4 text-text-tertiary" />
        </Link>
      </section>
    </div>
  );
}
