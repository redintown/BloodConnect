import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { BloodRequestCard } from "@/components/cards/BloodRequestCard";
import { requireAuth } from "@/services/authService";
import { bloodRequestService } from "@/services/bloodRequestService";

export default async function RequestsPage() {
  const user = await requireAuth();
  const requests = await bloodRequestService.listForRequester(user.id);

  return (
    <PageShell title="My requests">
      <Link
        href="/request-blood"
        className="rounded-xl bg-emergency px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emergency-hover"
      >
        New request
      </Link>

      {requests.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="Requests you create will show up here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => (
            <BloodRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
