import Link from "next/link";
import { redirect } from "next/navigation";
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

  // The brand lock-up and `main` landmark come from the (auth) layout.
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-h1 text-text">Welcome back</h1>
        <p className="text-body text-text-secondary">Sign in to your BloodConnect account.</p>
      </header>

      <LoginForm next={searchParams.next} />

      <p className="text-body text-text-secondary">
        Need an account?{" "}
        <Link
          href="/register"
          className="font-medium text-text underline decoration-border-strong underline-offset-4 hover:decoration-text"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
