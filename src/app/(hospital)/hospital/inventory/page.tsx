import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClassName } from "@/components/ui/Button";
import { OrganizationInventoryPanel } from "@/components/forms/OrganizationInventoryPanel";
import { inventoryService } from "@/services/inventoryService";
import { hospitalService } from "@/services/hospitalService";
import Link from "next/link";

export default async function HospitalInventoryPage() {
  const org = await hospitalService.getOwnLinkedOrg();

  if (!org) {
    return (
      <div className="mx-auto flex w-full max-w-form flex-col gap-8">
        <PageHeader title="Blood inventory" />
        <EmptyState
          icon="boxes"
          title="No hospital profile yet"
          description="Create your hospital profile before you can record inventory."
          action={
            <Link href="/hospital/profile" className={buttonClassName({ variant: "primary" })}>
              Go to hospital profile
            </Link>
          }
        />
      </div>
    );
  }

  const items = await inventoryService.getOwnInventory("HOSPITAL");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Blood inventory"
        description="Record available units by blood group for your hospital."
      />
      <OrganizationInventoryPanel organizationType="HOSPITAL" initialItems={items} />
    </div>
  );
}
