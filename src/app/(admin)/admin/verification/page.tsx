import { redirect } from "next/navigation";

/** Organization verification lives at /admin/organizations (Phase 8A). */
export default function AdminVerificationRedirectPage() {
  redirect("/admin/organizations");
}
