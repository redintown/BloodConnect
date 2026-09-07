import { PageShell } from "@/components/ui/PageShell";

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  return (
    <PageShell title="Request details" phaseNote="Status timeline + matched donors land in Phases 3–5.">
      <p className="text-gray-600">Request {params.id}</p>
    </PageShell>
  );
}
