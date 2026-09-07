import { protectPage } from "@/lib/auth/protect";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await protectPage({ role: "ADMIN" });
  return children;
}
