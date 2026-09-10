import { PublicHeader } from "@/components/nav/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PageHeader } from "@/components/ui/PageHeader";
import { FindBloodSearchForm } from "@/components/forms/FindBloodSearchForm";

/**
 * Public blood availability search.
 *
 * Adopts the Step 2 public navigation, so the account bar hides itself here
 * and "Find blood" is marked as the current destination. The page stays a
 * server component: the search itself is a client island, and nothing on
 * this route reads the session or the database.
 */
export default function FindBloodPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <PublicHeader currentPath="/find-blood" />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-shell flex-1 flex-col gap-6 px-4 py-6 outline-none sm:px-6 sm:py-8 wide:max-w-shell-wide"
      >
        <PageHeader
          title="Find blood"
          description="Search verified hospitals and blood banks for possible stock of an exact blood group. This is not donor matching."
        />

        <FindBloodSearchForm />
      </main>

      <PublicFooter />
    </div>
  );
}
