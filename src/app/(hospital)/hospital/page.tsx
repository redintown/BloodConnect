import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { hospitalService } from "@/services/hospitalService";
import type { VerificationStatus } from "@/lib/constants/verification";
import { cn } from "@/lib/utils/cn";

/**
 * Hospital dashboard — attention-first presentation.
 *
 * Data contract unchanged: `hospitalService.getOwnProfile()` only.
 * Escalation inbox and inventory stay on their existing routes (no new queries).
 */

function verificationNextCopy(status: VerificationStatus): string {
  switch (status) {
    case "UNVERIFIED":
      return "Submit your hospital profile for admin review. Only verified hospitals receive escalations.";
    case "PENDING":
      return "Verification is under admin review. Escalations reach verified hospitals only.";
    case "REJECTED":
      return "Update your profile and resubmit for verification.";
    case "VERIFIED":
      return "Your hospital can receive escalated emergency requests.";
    default:
      return "";
  }
}

export default async function HospitalHomePage() {
  const profile = await hospitalService.getOwnProfile();
  const needsVerificationAttention =
    !profile || profile.verificationStatus !== "VERIFIED";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Hospital dashboard"
        description="Coordinate escalated emergency requests, keep verification current, and manage inventory."
        status={
          profile ? (
            <StatusChip kind="verification" value={profile.verificationStatus} />
          ) : undefined
        }
      />

      <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
        <SectionHeader id="attention-heading" title="Needs attention" />

        {!profile ? (
          <Alert
            variant="warning"
            title="Complete your hospital profile"
            action={
              <Link
                href="/hospital/profile"
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Open profile
              </Link>
            }
          >
            Create a hospital profile to request verification. Role HOSPITAL does not mean verified —
            only verified hospitals are escalated to.
          </Alert>
        ) : needsVerificationAttention ? (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-lg border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between",
              profile.verificationStatus === "REJECTED"
                ? "border-danger/25"
                : "border-warning/25"
            )}
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip kind="verification" value={profile.verificationStatus} />
                <span className="text-body-strong text-text">{profile.name}</span>
              </div>
              <p className="text-body text-text-secondary">
                {verificationNextCopy(profile.verificationStatus)}
              </p>
              {profile.verificationStatus === "REJECTED" && profile.rejectionReason && (
                <p className="text-caption text-text-secondary">
                  Reason: {profile.rejectionReason}
                </p>
              )}
            </div>
            <Link
              href="/hospital/profile"
              className={buttonClassName({
                variant: profile.verificationStatus === "REJECTED" ? "secondary" : "primary",
                size: "md",
              })}
            >
              {profile.verificationStatus === "REJECTED"
                ? "Update profile"
                : profile.verificationStatus === "PENDING"
                  ? "View profile"
                  : "Complete verification"}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-body-strong text-text">Review escalated emergency requests</p>
              <p className="text-body text-text-secondary">
                Open Escalations to acknowledge, indicate whether you can supply, or decline. This
                dashboard does not invent request counts.
              </p>
            </div>
            <Link
              href="/hospital/requests"
              className={buttonClassName({ variant: "emergency", size: "md" })}
            >
              Open escalations
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="ops-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="ops-heading"
          title="Organization work"
          description="Use existing hospital routes. Escalation responses and inventory edits stay on those pages."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/hospital/requests"
            className="flex min-h-control flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
          >
            <span className="flex items-center gap-2 text-body-strong text-text">
              <Icon name="bell" className="h-4 w-4 text-emergency" />
              Escalated requests
            </span>
            <span className="text-caption text-text-secondary">
              Emergency escalations assigned to your hospital
            </span>
          </Link>
          <Link
            href="/hospital/inventory"
            className="flex min-h-control flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
          >
            <span className="flex items-center gap-2 text-body-strong text-text">
              <Icon name="boxes" className="h-4 w-4 text-text-secondary" />
              Blood inventory
            </span>
            <span className="text-caption text-text-secondary">
              Manage stock on the inventory page
            </span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="org-heading" className="flex flex-col gap-3">
        <SectionHeader id="org-heading" title="Organization" />
        {profile ? (
          <div className="rounded-lg border border-border bg-surface p-4">
            <dl className="grid gap-3 text-body sm:grid-cols-2">
              <div>
                <dt className="text-caption text-text-secondary">Name</dt>
                <dd className="text-body-strong text-text">{profile.name}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-secondary">Verification</dt>
                <dd className="mt-1">
                  <StatusChip kind="verification" value={profile.verificationStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-secondary">24h emergency</dt>
                <dd className="text-body-strong text-text">
                  {profile.has24hEmergency ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-caption text-text-tertiary">
              Role HOSPITAL does not mean verified. Only verified hospitals are escalated to.
            </p>
            <Link
              href="/hospital/profile"
              className={cn(
                buttonClassName({ variant: "secondary", size: "sm" }),
                "mt-3 w-fit"
              )}
            >
              Manage profile
            </Link>
          </div>
        ) : (
          <Alert
            variant="info"
            action={
              <Link
                href="/hospital/profile"
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Create profile
              </Link>
            }
          >
            No hospital profile yet.
          </Alert>
        )}
      </section>
    </div>
  );
}
