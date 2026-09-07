import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { DonorMatchActions } from "@/components/forms/DonorMatchActions";
import { requireRole } from "@/services/authService";
import { matchResponseService } from "@/services/matchResponseService";
import type { AcceptedMatchContact } from "@/types/domain";

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

  const active = matches.filter((m) =>
    ["MATCHED", "NOTIFIED", "VIEWED", "ACCEPTED"].includes(m.matchStatus)
  );
  const closed = matches.filter((m) => ["DECLINED", "EXPIRED"].includes(m.matchStatus));

  return (
    <PageShell title="Requests near me">
      {matches.length === 0 ? (
        <EmptyState
          title="No matched requests yet"
          description="When a requester finds you as a match, the request will appear here for Accept or Decline."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {active.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-gray-800">Active</h2>
              {active.map((item) => (
                <div key={item.matchId} className="flex flex-col gap-2">
                  <DonorMatchActions item={item} />
                  {contacts.get(item.matchId)?.request && (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
                      <p className="font-medium text-gray-800">Requester contact</p>
                      <p className="text-gray-700">
                        {contacts.get(item.matchId)!.request!.contactName} ·{" "}
                        {contacts.get(item.matchId)!.request!.contactPhone}
                      </p>
                      {contacts.get(item.matchId)!.request!.hospitalNameFreeform && (
                        <p className="text-gray-600">
                          {contacts.get(item.matchId)!.request!.hospitalNameFreeform}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
          {closed.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-gray-800">Closed</h2>
              {closed.map((item) => (
                <DonorMatchActions key={item.matchId} item={item} />
              ))}
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
