import { protectPage } from "@/lib/auth/protect";

export const dynamic = "force-dynamic";

export default async function HospitalLayout({ children }: { children: React.ReactNode }) {
  await protectPage({ role: "HOSPITAL" });
  return children;
}
