import { protectPage } from "@/lib/auth/protect";
import { AppShell } from "@/components/layout/AppShell";
import { RequesterShellHeader } from "@/components/layout/RequesterShellHeader";
import { DesktopNav } from "@/components/nav/DesktopNav";
import { MobileNav } from "@/components/nav/MobileNav";
import { flattenNavSections } from "@/components/nav/navConfig";
import { REQUESTER_NAV_SECTIONS } from "@/components/nav/requesterNav";

export const dynamic = "force-dynamic";

/**
 * Global shell for authenticated requester routes under (requester):
 * `/requests`, `/request-blood`, `/requests/[id]`.
 *
 * Navigation uses Phase 11B AppShell / DesktopNav / MobileNav with
 * requester-only destinations from requesterNav. No invented routes.
 */
export default async function RequesterLayout({ children }: { children: React.ReactNode }) {
  const user = await protectPage();

  return (
    <AppShell
      nav={
        <DesktopNav
          sections={REQUESTER_NAV_SECTIONS}
          title="Requester portal"
          titleHref="/requests"
          ariaLabel="Requester"
        />
      }
      mobileNav={
        <MobileNav items={flattenNavSections(REQUESTER_NAV_SECTIONS)} ariaLabel="Requester" />
      }
      header={<RequesterShellHeader email={user.email ?? null} />}
    >
      {children}
    </AppShell>
  );
}
