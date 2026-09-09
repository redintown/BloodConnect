import { PageShell } from "@/components/ui/PageShell";
import { HospitalProfileForm } from "@/components/forms/HospitalProfileForm";
import { hospitalService } from "@/services/hospitalService";

export default async function HospitalProfilePage() {
  const profile = await hospitalService.getOwnProfile();

  return (
    <PageShell title="Hospital profile">
      <HospitalProfileForm profile={profile} />
    </PageShell>
  );
}
