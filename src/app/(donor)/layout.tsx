import { protectPage } from "@/lib/auth/protect";

export const dynamic = "force-dynamic";

export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  await protectPage({ role: "DONOR" });
  return children;
}
