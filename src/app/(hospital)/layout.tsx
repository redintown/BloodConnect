import { protectPage } from "@/lib/auth/protect";
import { AppShell } from "@/components/layout/AppShell";
import { OrganizationShellHeader } from "@/components/layout/OrganizationShellHeader";
import { DesktopNav } from "@/components/nav/DesktopNav";
import { MobileNav } from "@/components/nav/MobileNav";
import { flattenNavSections } from "@/components/nav/navConfig";
import { HOSPITAL_NAV_SECTIONS } from "@/components/nav/hospitalNav";

export const dynamic = "force-dynamic";

/**
 * Shell for authenticated hospital routes under (hospital).
 * Navigation uses only existing destinations from hospitalNav.
 * Organization name comes from page-level profile data — no layout query.
 */
export default async function HospitalLayout({ children }: { children: React.ReactNode }) {
  const user = await protectPage({ role: "HOSPITAL" });

  return (
    <AppShell
      nav={
        <DesktopNav
          sections={HOSPITAL_NAV_SECTIONS}
          title="Hospital portal"
          titleHref="/hospital"
          ariaLabel="Hospital"
        />
      }
      mobileNav={
        <MobileNav items={flattenNavSections(HOSPITAL_NAV_SECTIONS)} ariaLabel="Hospital" />
      }
      header={
        <OrganizationShellHeader
          email={user.email ?? null}
          homeHref="/hospital"
          organizationTypeLabel="Hospital"
        />
      }
    >
      {children}
    </AppShell>
  );
}
