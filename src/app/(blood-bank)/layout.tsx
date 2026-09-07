import { protectPage } from "@/lib/auth/protect";

export const dynamic = "force-dynamic";

export default async function BloodBankLayout({ children }: { children: React.ReactNode }) {
  await protectPage({ role: "BLOOD_BANK" });
  return children;
}
