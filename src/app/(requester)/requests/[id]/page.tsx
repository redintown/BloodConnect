import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { EmergencyBadge } from "@/components/ui/EmergencyBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BloodRequestForm } from "@/components/forms/BloodRequestForm";
import { CancelRequestButton } from "@/components/forms/CancelRequestButton";
import { STATUS_LABELS } from "@/lib/constants/requestStatus";
import { canRequesterCancel, canRequesterEdit } from "@/lib/requests/statusRules";
import { bloodRequestService } from "@/services/bloodRequestService";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const request = await bloodRequestService.getById(params.id);
  if (!request) notFound();

  const editable = canRequesterEdit(request.status);
  const cancellable = canRequesterCancel(request.status);

  return (
    <PageShell title="Request details">
      <div className="flex flex-wrap items-center gap-2">
        <BloodGroupBadge bloodGroup={request.bloodGroup} />
        <EmergencyBadge urgency={request.urgency} />
        <StatusBadge status={request.status} />
      </div>

      <dl className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 text-sm">
        <div>
          <dt className="text-gray-500">Status</dt>
          <dd className="font-medium text-gray-800">{STATUS_LABELS[request.status]}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Units</dt>
          <dd className="font-medium text-gray-800">{request.quantityUnits}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Hospital</dt>
          <dd className="font-medium text-gray-800">
            {request.hospitalNameFreeform ?? "Selected hospital"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Contact</dt>
          <dd className="font-medium text-gray-800">
            {request.contactName} · {request.contactPhone}
          </dd>
        </div>
        {request.requiredBy && (
          <div>
            <dt className="text-gray-500">Needed by</dt>
            <dd className="font-medium text-gray-800">
              {new Date(request.requiredBy).toLocaleString()}
            </dd>
          </div>
        )}
        {request.notes && (
          <div>
            <dt className="text-gray-500">Notes</dt>
            <dd className="font-medium text-gray-800">{request.notes}</dd>
          </div>
        )}
        <div>
          <dt className="text-gray-500">Location</dt>
          <dd className="font-medium text-gray-800">
            {request.location.latitude.toFixed(4)}, {request.location.longitude.toFixed(4)}
            <span className="mt-1 block text-xs font-normal text-gray-400">
              Exact location is visible only to you.
            </span>
          </dd>
        </div>
      </dl>

      {editable && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-800">Edit request</h2>
          <BloodRequestForm mode="edit" request={request} />
        </section>
      )}

      {cancellable && <CancelRequestButton requestId={request.id} />}

      <p className="text-xs text-gray-400">
        Matching and donor contact are not part of this phase. Status stays {STATUS_LABELS[request.status]} until a later phase advances it.
      </p>

      <Link href="/requests" className="text-sm text-gray-500 hover:text-gray-800">
        ← My requests
      </Link>
    </PageShell>
  );
}
