"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Route-level error boundary for the whole tree.
 *
 * Only a safe, generic message reaches the user. The raw error message is
 * never rendered — it can contain database or internal detail. `digest` is
 * a Next.js-generated correlation id and is safe to show for support.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side detail stays in server logs; this is the client record.
    console.error("[route-error]", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-form flex-1 flex-col px-4 py-6 outline-none sm:px-6"
    >
      <ErrorState
        title="Something went wrong"
        message="We could not load this page. Please try again — your data has not been lost."
        onRetry={reset}
        backHref="/"
        reference={error.digest}
      />
    </main>
  );
}
