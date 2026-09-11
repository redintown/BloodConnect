import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClassName } from "@/components/ui/Button";
import { OrganizationInventoryPanel } from "@/components/forms/OrganizationInventoryPanel";
import { inventoryService } from "@/services/inventoryService";
import { bloodBankService } from "@/services/bloodBankService";
import Link from "next/link";

export default async function BloodBankInventoryPage() {
  const org = await bloodBankService.getOwnLinkedOrg();

  if (!org) {
    return (
      <div className="mx-auto flex w-full max-w-form flex-col gap-8">
        <PageHeader title="Blood inventory" />
        <EmptyState
          icon="boxes"
          title="No blood bank profile yet"
          description="Create your blood bank profile before you can record inventory."
          action={
            <Link href="/blood-bank/profile" className={buttonClassName({ variant: "primary" })}>
              Go to blood bank profile
            </Link>
          }
        />
      </div>
    );
  }

  const items = await inventoryService.getOwnInventory("BLOOD_BANK");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Blood inventory"
        description="Record available units by blood group for your blood bank."
      />
      <OrganizationInventoryPanel organizationType="BLOOD_BANK" initialItems={items} />
    </div>
  );
}
