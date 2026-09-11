import { protectPage } from "@/lib/auth/protect";
import { AppShell } from "@/components/layout/AppShell";
import { AdminShellHeader } from "@/components/layout/AdminShellHeader";
import { DesktopNav } from "@/components/nav/DesktopNav";
import { MobileNav } from "@/components/nav/MobileNav";
import { flattenNavSections } from "@/components/nav/navConfig";
import { ADMIN_NAV_SECTIONS } from "@/components/nav/adminNav";

export const dynamic = "force-dynamic";

/**
 * Shell for authenticated admin routes under (admin).
 * Navigation uses only existing, implemented destinations from adminNav.
 * `user` comes from the existing `protectPage` call (no new query) — just
 * used for the header's email display, same as the other portals.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await protectPage({ role: "ADMIN" });

  return (
    <AppShell
      nav={
        <DesktopNav
          sections={ADMIN_NAV_SECTIONS}
          title="Admin portal"
          titleHref="/admin"
          ariaLabel="Admin"
        />
      }
      mobileNav={<MobileNav items={flattenNavSections(ADMIN_NAV_SECTIONS)} ariaLabel="Admin" />}
      header={<AdminShellHeader email={user.email ?? null} />}
    >
      {children}
    </AppShell>
  );
}
