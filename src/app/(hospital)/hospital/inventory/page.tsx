import { PageShell } from "@/components/ui/PageShell";
import { OrganizationInventoryPanel } from "@/components/forms/OrganizationInventoryPanel";
import { inventoryService } from "@/services/inventoryService";
import { hospitalService } from "@/services/hospitalService";
import Link from "next/link";

export default async function HospitalInventoryPage() {
  const org = await hospitalService.getOwnLinkedOrg();

  if (!org) {
    return (
      <PageShell title="Blood inventory">
        <p className="text-sm text-gray-600">
          Create your hospital profile before managing inventory.
        </p>
        <Link href="/hospital/profile" className="text-sm font-medium text-emergency">
          Go to hospital profile
        </Link>
      </PageShell>
    );
  }

  const items = await inventoryService.getOwnInventory("HOSPITAL");

  return (
    <PageShell title="Blood inventory">
      <OrganizationInventoryPanel organizationType="HOSPITAL" initialItems={items} />
    </PageShell>
  );
}
