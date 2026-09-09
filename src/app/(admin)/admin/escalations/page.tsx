import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireRole } from "@/services/authService";
import { escalationService } from "@/services/escalationService";
import { AdminEscalationActions } from "@/components/forms/AdminEscalationActions";
import Link from "next/link";

export default async function AdminEscalationsPage() {
  await requireRole("ADMIN");
  const open = await escalationService.listAdminOpenEscalations();

  return (
    <PageShell title="Escalation queue">
      {open.length === 0 ? (
        <EmptyState title="No open escalations" />
      ) : (
        <div className="flex flex-col gap-3">
          {open.map(({ event, requestStatus, bloodGroup }) => (
            <article
              key={event.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-900">{bloodGroup}</span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                  {event.level}
                </span>
                <span className="text-xs text-gray-500">Request {requestStatus}</span>
              </div>
              <p className="text-xs text-gray-500">
                Request id: {event.bloodRequestId}
                {event.metadata?.reason ? ` · reason ${String(event.metadata.reason)}` : ""}
              </p>
              <p className="text-xs text-gray-500">
                Opened {new Date(event.triggeredAt).toLocaleString()}
              </p>
              <AdminEscalationActions requestId={event.bloodRequestId} />
            </article>
          ))}
        </div>
      )}
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">
        ← Admin home
      </Link>
    </PageShell>
  );
}
