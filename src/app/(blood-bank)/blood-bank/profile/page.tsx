import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { BloodBankProfileForm } from "@/components/forms/BloodBankProfileForm";
import { bloodBankService } from "@/services/bloodBankService";

export default async function BloodBankProfilePage() {
  const profile = await bloodBankService.getOwnProfile();

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-8">
      <PageHeader
        title="Blood bank profile"
        description="Keep your organization details current. Verification is reviewed by an administrator."
        status={
          profile ? (
            <StatusChip kind="verification" value={profile.verificationStatus} />
          ) : null
        }
      />
      <BloodBankProfileForm profile={profile} />
    </div>
  );
}
