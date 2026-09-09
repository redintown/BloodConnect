import { PageShell } from "@/components/ui/PageShell";
import { BloodBankProfileForm } from "@/components/forms/BloodBankProfileForm";
import { bloodBankService } from "@/services/bloodBankService";

export default async function BloodBankProfilePage() {
  const profile = await bloodBankService.getOwnProfile();

  return (
    <PageShell title="Blood bank profile">
      <BloodBankProfileForm profile={profile} />
    </PageShell>
  );
}
