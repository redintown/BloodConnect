import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DonorMatchActions } from "@/components/forms/DonorMatchActions";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/services/authService";
import { matchResponseService } from "@/services/matchResponseService";
import { selectActionableDonorMatches } from "@/lib/matches/responseRules";
import type { AcceptedMatchContact, DonorInboxMatch } from "@/types/domain";

const CLOSED_REQUEST_STATUSES = new Set(["COMPLETED", "CANCELLED", "EXPIRED"]);

function isInProgress(match: DonorInboxMatch): boolean {
  return (
    match.matchStatus === "ACCEPTED" && !CLOSED_REQUEST_STATUSES.has(match.request.status)
  );
}

export default async function DonorRequestsPage() {
  const user = await requireRole("DONOR");
  const matches = await matchResponseService.listMatchesForDonor(user.id);

  const contacts = new Map<string, AcceptedMatchContact>();
  await Promise.all(
    matches
      .filter((m) => m.matchStatus === "ACCEPTED")
      .map(async (m) => {
        try {
          const contact = await matchResponseService.getAcceptedMatchContact(m.matchId, user.id);
          contacts.set(m.matchId, contact);
        } catch {
          // Contact reveal stays best-effort; actions still render.
        }
      })
  );

  const actionable = selectActionableDonorMatches(matches);
  const actionableIds = new Set(actionable.map((m) => m.matchId));
  const inProgress = matches.filter((m) => !actionableIds.has(m.matchId) && isInProgress(m));
  const inProgressIds = new Set(inProgress.map((m) => m.matchId));
  const past = matches.filter(
    (m) => !actionableIds.has(m.matchId) && !inProgressIds.has(m.matchId)
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Requests"
        description="Requests matched to you. Respond when needed, then follow accepted requests through to confirmation."
      />

      {matches.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No matched requests yet"
          description="When a requester finds you as a match, the request will appear here so you can accept or decline."
          action={
            <Link href="/donor" className={buttonClassName({ variant: "secondary", size: "sm" })}>
              Donor home
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {actionable.length > 0 && (
            <section aria-labelledby="actionable-matches-heading" className="flex flex-col gap-3">
              <SectionHeader
                id="actionable-matches-heading"
                title="Needs your response"
                description="Accept or decline these matches."
                count={actionable.length}
              />
              {actionable.map((item) => (
                <DonorMatchActions
                  key={item.matchId}
                  item={item}
                  contact={contacts.get(item.matchId) ?? null}
                />
              ))}
            </section>
          )}

          {inProgress.length > 0 && (
            <section aria-labelledby="active-matches-heading" className="flex flex-col gap-3">
              <SectionHeader
                id="active-matches-heading"
                title="Accepted / in progress"
                description="You accepted these. Mark on the way when you leave, and use contact details when shown."
                count={inProgress.length}
              />
              {inProgress.map((item) => (
                <DonorMatchActions
                  key={item.matchId}
                  item={item}
                  contact={contacts.get(item.matchId) ?? null}
                />
              ))}
            </section>
          )}

          {past.length > 0 && (
            <section aria-labelledby="past-matches-heading" className="flex flex-col gap-3">
              <SectionHeader
                id="past-matches-heading"
                title="Past"
                description="Completed, declined, expired, or otherwise closed matches."
                count={past.length}
              />
              {past.map((item) => (
                <DonorMatchActions
                  key={item.matchId}
                  item={item}
                  contact={contacts.get(item.matchId) ?? null}
                />
              ))}
            </section>
          )}
        </div>
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
