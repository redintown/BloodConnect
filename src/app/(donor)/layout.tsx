import { protectPage } from "@/lib/auth/protect";
import { DonorPortalMatchOverlay } from "@/components/forms/DonorPortalMatchOverlay";

export const dynamic = "force-dynamic";

/**
 * Global shell for every authenticated donor route under (donor).
 * Mounts exactly one match popup instance for the whole portal.
 */
export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  const user = await protectPage({ role: "DONOR" });

  return (
    <>
      <DonorPortalMatchOverlay userId={user.id} />
      {children}
    </>
  );
}
