import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { LoginForm } from "@/components/forms/LoginForm";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { landingRouteForRoles } from "@/lib/constants/roles";
import { getCurrentUser, getCurrentUserRoles } from "@/services/authService";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    const roles = await getCurrentUserRoles();
    redirect(getSafeRedirectPath(searchParams.next, landingRouteForRoles(roles)));
  }

  return (
    <PageShell title="Log in">
      <LoginForm next={searchParams.next} />
      <p className="text-sm text-gray-600">
        Need an account?{" "}
        <Link href="/register" className="font-medium text-emergency">
          Register
        </Link>
      </p>
    </PageShell>
  );
}
