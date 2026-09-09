import { PageShell } from "@/components/ui/PageShell";
import { FindBloodSearchForm } from "@/components/forms/FindBloodSearchForm";

export default function FindBloodPage() {
  return (
    <PageShell title="Find blood">
      <p className="text-sm text-gray-600">
        Search verified hospitals and blood banks for possible stock of an exact blood group.
        This is not donor matching and does not reserve blood.
      </p>
      <FindBloodSearchForm />
    </PageShell>
  );
}
