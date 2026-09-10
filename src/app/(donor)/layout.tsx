import { protectPage } from "@/lib/auth/protect";
import { DonorPortalMatchOverlay } from "@/components/forms/DonorPortalMatchOverlay";
import { AppShell } from "@/components/layout/AppShell";
import { DonorShellHeader } from "@/components/layout/DonorShellHeader";
import { DesktopNav } from "@/components/nav/DesktopNav";
import { MobileNav } from "@/components/nav/MobileNav";
import { flattenNavSections } from "@/components/nav/navConfig";
import { DONOR_NAV_SECTIONS } from "@/components/nav/donorNav";

export const dynamic = "force-dynamic";

/**
 * Global shell for every authenticated donor route under (donor).
 *
 * Mounts exactly one match popup instance for the whole portal via the
 * existing DonorPortalMatchOverlay — the dashboard must not open a second.
 * Navigation uses the Phase 11B AppShell / DesktopNav / MobileNav primitives
 * with donor-only destinations from donorNav.
 */
export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  const user = await protectPage({ role: "DONOR" });

  return (
    <AppShell
      nav={
        <DesktopNav
          sections={DONOR_NAV_SECTIONS}
          title="Donor portal"
          titleHref="/donor"
          ariaLabel="Donor"
        />
      }
      mobileNav={<MobileNav items={flattenNavSections(DONOR_NAV_SECTIONS)} ariaLabel="Donor" />}
      header={<DonorShellHeader email={user.email ?? null} />}
      overlay={<DonorPortalMatchOverlay userId={user.id} />}
    >
      {children}
    </AppShell>
  );
}
