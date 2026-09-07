import { PageShell } from "@/components/ui/PageShell";

const STEPS = [
  "A requester creates an emergency blood request.",
  "BloodConnect ranks nearby, compatible, available donors.",
  "The highest-priority donors are notified first.",
  "A donor accepts and the requester is connected directly.",
  "If no donor is available, the request escalates to blood banks and hospitals.",
];

export default function HowItWorksPage() {
  return (
    <PageShell title="How it works">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-gray-600">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </PageShell>
  );
}
