import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import { Icon, type IconName } from "@/components/ui/Icon";
import { buttonClassName } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * Admin dashboard — attention-first navigational presentation.
 *
 * Deliberately fetches nothing: the previous `/admin` page never called a
 * service either, and adding a query here (even to reuse
 * `verificationService.listPendingOrganizations().length`) would be a new
 * data read on this route. Pending-work counts stay on their own existing
 * queue pages (`/admin/organizations`, `/admin/donors`, `/admin/escalations`),
 * which already fetch and order this data.
 */

function AdminNavCard({
  href,
  icon,
  title,
  description,
  muted = false,
}: {
  href: string;
  icon: IconName;
  title: string;
  description: string;
  /** Route exists but is not yet implemented — no invented capability. */
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-control flex-col gap-1 rounded-lg border p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1",
        muted
          ? "border-dashed border-border bg-canvas hover:bg-muted/50"
          : "border-border bg-surface hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2 text-body-strong",
          muted ? "text-text-secondary" : "text-text"
        )}
      >
        <Icon
          name={icon}
          className={cn("h-4 w-4", muted ? "text-text-tertiary" : "text-text-secondary")}
        />
        {title}
      </span>
      <span className="text-caption text-text-secondary">{description}</span>
    </Link>
  );
}

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Admin dashboard"
        description="Review organization and donor verification, and respond to open emergency escalations."
      />

      <section aria-labelledby="admin-attention-heading" className="flex flex-col gap-3">
        <SectionHeader id="admin-attention-heading" title="Needs attention" />
        <Alert
          variant="info"
          title="Check the verification and escalation queues"
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/organizations"
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Organization verification
              </Link>
              <Link
                href="/admin/escalations"
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                Escalation queue
              </Link>
            </div>
          }
        >
          Pending organizations, pending donors, and open escalations are listed on their own
          pages, oldest first. This dashboard does not display counts.
        </Alert>
      </section>

      <section aria-labelledby="admin-queues-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="admin-queues-heading"
          title="Administrative queues"
          description="Existing review destinations."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminNavCard
            href="/admin/organizations"
            icon="building"
            title="Organization verification"
            description="Review pending hospitals and blood banks."
          />
          <AdminNavCard
            href="/admin/donors"
            icon="droplet"
            title="Donor verification"
            description="Review pending donor profiles."
          />
          <AdminNavCard
            href="/admin/escalations"
            icon="bell"
            title="Escalation queue"
            description="Respond to open emergency escalations."
          />
        </div>
      </section>

      <section aria-labelledby="admin-other-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="admin-other-heading"
          title="Other admin areas"
          description="Routes exist but are not implemented yet."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminNavCard
            href="/admin/users"
            icon="user"
            title="Users"
            description="Not available yet."
            muted
          />
          <AdminNavCard
            href="/admin/requests"
            icon="clipboard"
            title="Request moderation"
            description="Not available yet."
            muted
          />
        </div>
      </section>
    </div>
  );
}
