import { PageShell } from "@/components/ui/PageShell";
import { OrganizationInventoryPanel } from "@/components/forms/OrganizationInventoryPanel";
import { inventoryService } from "@/services/inventoryService";
import { bloodBankService } from "@/services/bloodBankService";
import Link from "next/link";

export default async function BloodBankInventoryPage() {
  const org = await bloodBankService.getOwnLinkedOrg();

  if (!org) {
    return (
      <PageShell title="Blood inventory">
        <p className="text-sm text-gray-600">
          Create your blood bank profile before managing inventory.
        </p>
        <Link href="/blood-bank/profile" className="text-sm font-medium text-emergency">
          Go to blood bank profile
        </Link>
      </PageShell>
    );
  }

  const items = await inventoryService.getOwnInventory("BLOOD_BANK");

  return (
    <PageShell title="Blood inventory">
      <OrganizationInventoryPanel organizationType="BLOOD_BANK" initialItems={items} />
    </PageShell>
  );
}
