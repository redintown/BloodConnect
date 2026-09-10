import Link from "next/link";
import { PublicHeader } from "@/components/nav/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buttonClassName } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";

/**
 * Public product information.
 *
 * Scoped strictly to what the application does. There is no company story,
 * team, funding, coverage claim or usage metric here, because none of that
 * exists as product content — and inventing it is exactly what would make a
 * medical coordination tool look untrustworthy.
 *
 * The participant groups mirror the roles registration actually offers.
 */
const PARTICIPANTS = [
  {
    title: "Requesters",
    detail:
      "Create a request for a patient, follow donor responses as they arrive, and escalate the request if it needs more reach.",
  },
  {
    title: "Donors",
    detail:
      "Register a blood group and availability, receive nearby requests, and decide case by case whether to accept.",
  },
  {
    title: "Hospitals",
    detail:
      "Keep stock information current and respond when a request escalates to nearby organisations.",
  },
  {
    title: "Blood banks",
    detail:
      "Do the same, and appear in public availability search when they may hold the group being searched for.",
  },
];

/**
 * Operational commitments that are enforced in the product today — each one
 * is observable in the existing donor, search and verification behaviour.
 */
const PRACTICES = [
  {
    title: "Donor location stays coarse",
    detail:
      "A donor's exact location is never shown. Distances appear only as rounded, approximate values.",
  },
  {
    title: "Donating is always a choice",
    detail:
      "A donor is never assigned to a request. Every match has to be accepted or declined by the donor.",
  },
  {
    title: "Organisations are reviewed",
    detail:
      "Hospitals and blood banks go through a verification review before they appear in public availability search.",
  },
  {
    title: "Availability is indicative",
    detail:
      "Search results show that stock may be available and when the organisation last updated it. They do not reserve or guarantee blood.",
  },
  {
    title: "Contact details stay closed by default",
    detail:
      "Organisation phone numbers in public search stay hidden until you choose to show them. Donor contact is not part of the public search experience.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <PublicHeader currentPath="/about" />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-shell flex-1 flex-col gap-10 px-4 py-6 outline-none sm:px-6 sm:py-8 wide:max-w-shell-wide"
      >
        <PageHeader title={`About ${siteConfig.name}`} description={siteConfig.description} />

        <section aria-labelledby="what-heading" className="flex flex-col gap-3">
          <SectionHeader id="what-heading" title={`What ${siteConfig.name} is`} />

          <p className="max-w-form text-body text-text-secondary">
            {siteConfig.name} is coordination infrastructure for urgent blood requests. It connects
            a request for a specific blood group with compatible donors nearby, and can bring
            hospitals and blood banks into the loop when donor responses run out.
          </p>
          <p className="max-w-form text-body text-text-secondary">
            The problem it addresses is coordination, not supply. Finding a compatible donor
            usually means phone calls, group messages and repeated asking, often at night and
            under time pressure. {siteConfig.name} keeps that search in one place: one request, a
            ranked set of nearby compatible donors, explicit responses, and a clear record of what
            happened. It does not store, transport or reserve blood.
          </p>
        </section>

        <section aria-labelledby="participants-heading" className="flex flex-col gap-4">
          <SectionHeader
            id="participants-heading"
            title="Who it is for"
            description="Four groups, each with their own view of the same request."
          />

          <ul className="grid gap-3 sm:grid-cols-2">
            {PARTICIPANTS.map((participant) => (
              <li
                key={participant.title}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4"
              >
                <h3 className="text-h3 text-text">{participant.title}</h3>
                <p className="text-label font-normal text-text-secondary">{participant.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="practices-heading" className="flex flex-col gap-4">
          <SectionHeader
            id="practices-heading"
            title="How it handles sensitive information"
            description="Rules the product enforces, not aspirations."
          />

          <dl className="flex flex-col gap-3">
            {PRACTICES.map((practice) => (
              <div
                key={practice.title}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:gap-6"
              >
                <dt className="text-body-strong text-text sm:w-64 sm:shrink-0">
                  {practice.title}
                </dt>
                <dd className="max-w-form text-label font-normal text-text-secondary">
                  {practice.detail}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="next-heading"
          className="flex flex-col gap-4 border-t border-border pt-8"
        >
          <SectionHeader id="next-heading" title="Start using it" />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/find-blood"
              className={buttonClassName({ variant: "primary", size: "md", className: "sm:px-6" })}
            >
              Find blood
            </Link>
            <Link
              href="/how-it-works"
              className={buttonClassName({
                variant: "secondary",
                size: "md",
                className: "sm:px-6",
              })}
            >
              How it works
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
