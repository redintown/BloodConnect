import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { HospitalProfileForm } from "@/components/forms/HospitalProfileForm";
import { hospitalService } from "@/services/hospitalService";

export default async function HospitalProfilePage() {
  const profile = await hospitalService.getOwnProfile();

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-8">
      <PageHeader
        title="Hospital profile"
        description="Keep your organization details current. Verification is reviewed by an administrator."
        status={
          profile ? (
            <StatusChip kind="verification" value={profile.verificationStatus} />
          ) : null
        }
      />
      <HospitalProfileForm profile={profile} />
    </div>
  );
}
