import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClassName } from "@/components/ui/Button";

/**
 * Branded 404. Previously a missing record (e.g. an unknown request id
 * calling notFound()) dropped the user onto the default Next.js page with
 * no way back into the product.
 */
export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-form flex-col gap-6 px-4 py-6 outline-none sm:px-6"
    >
      <PageHeader title="Page not found" />
      <EmptyState
        icon="search"
        title="We could not find that page"
        description="The link may be out of date, or the record may have been removed. Check the address, or head back to a known starting point."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className={buttonClassName({ variant: "primary", size: "sm" })}>
              Go to home
            </Link>
            <Link
              href="/find-blood"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Find blood
            </Link>
          </div>
        }
      />
    </main>
  );
}
