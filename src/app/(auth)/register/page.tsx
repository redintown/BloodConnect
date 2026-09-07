import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { landingRouteForRoles } from "@/lib/constants/roles";
import { getCurrentUser, getCurrentUserRoles } from "@/services/authService";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    const roles = await getCurrentUserRoles();
    redirect(landingRouteForRoles(roles));
  }

  return (
    <PageShell title="Create account">
      <RegisterForm />
      <p className="text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-emergency">
          Log in
        </Link>
      </p>
    </PageShell>
  );
}
