import { protectPage } from "@/lib/auth/protect";

export const dynamic = "force-dynamic";

export default async function RequesterLayout({ children }: { children: React.ReactNode }) {
  await protectPage();
  return children;
}
