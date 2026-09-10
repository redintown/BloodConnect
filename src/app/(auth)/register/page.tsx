import Link from "next/link";
import { redirect } from "next/navigation";
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

  // The brand lock-up and `main` landmark come from the (auth) layout.
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-h1 text-text">Create your account</h1>
        <p className="text-body text-text-secondary">
          One account to request blood or to donate. Tell us how you will use BloodConnect.
        </p>
      </header>

      <RegisterForm />

      <p className="text-body text-text-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-text underline decoration-border-strong underline-offset-4 hover:decoration-text"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
