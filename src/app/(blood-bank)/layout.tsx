import { protectPage } from "@/lib/auth/protect";
import { AppShell } from "@/components/layout/AppShell";
import { OrganizationShellHeader } from "@/components/layout/OrganizationShellHeader";
import { DesktopNav } from "@/components/nav/DesktopNav";
import { MobileNav } from "@/components/nav/MobileNav";
import { flattenNavSections } from "@/components/nav/navConfig";
import { BLOOD_BANK_NAV_SECTIONS } from "@/components/nav/bloodBankNav";

export const dynamic = "force-dynamic";

/**
 * Shell for authenticated blood-bank routes under (blood-bank).
 * Navigation uses only existing destinations from bloodBankNav.
 * Organization name comes from page-level profile data — no layout query.
 */
export default async function BloodBankLayout({ children }: { children: React.ReactNode }) {
  const user = await protectPage({ role: "BLOOD_BANK" });

  return (
    <AppShell
      nav={
        <DesktopNav
          sections={BLOOD_BANK_NAV_SECTIONS}
          title="Blood bank portal"
          titleHref="/blood-bank"
          ariaLabel="Blood bank"
        />
      }
      mobileNav={
        <MobileNav items={flattenNavSections(BLOOD_BANK_NAV_SECTIONS)} ariaLabel="Blood bank" />
      }
      header={
        <OrganizationShellHeader
          email={user.email ?? null}
          homeHref="/blood-bank"
          organizationTypeLabel="Blood bank"
        />
      }
    >
      {children}
    </AppShell>
  );
}
