import Link from "next/link";
import { siteConfig } from "@/config/site";
import { buttonClassName } from "@/components/ui/Button";
import { EmergencyBanner } from "@/components/ui/EmergencyBanner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PublicHeader } from "@/components/nav/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

/**
 * Public landing page.
 *
 * Answers three questions in order: what BloodConnect is, what you can do
 * here, and what to do next. Every destination below is a route that already
 * exists, and every claim describes behaviour the backend already implements
 * — no metrics, testimonials or partner logos are invented.
 *
 * Emergency red appears exactly once, in the banner, which is the product's
 * most important control. The page itself stays white and calm.
 */
const WORKFLOW = [
  {
    label: "Request",
    detail: "A requester creates a blood request with the group and units needed.",
  },
  {
    label: "Match",
    detail: "Compatible donors near the patient are ranked by availability.",
  },
  {
    label: "Respond",
    detail: "The highest-priority donors are notified first and can accept.",
  },
  {
    label: "Coordinate",
    detail: "The requester and the accepting donor are connected directly.",
  },
  {
    label: "Complete",
    detail: "The donation is recorded against the request.",
  },
];

const AUDIENCES = [
  {
    title: "Requesters",
    detail: "Create a request for a patient and follow donor responses as they arrive.",
  },
  {
    title: "Donors",
    detail: "Set your availability, get notified about nearby requests, and respond.",
  },
  {
    title: "Hospitals and blood banks",
    detail: "Keep stock visible and respond when a request escalates to your organisation.",
  },
];

export default function HomePage() {
  return (
    // Canvas base with white header, footer and cards — the same separation
    // the auth screens use, achieved with borders rather than elevation.
    <div className="flex min-h-dvh flex-col bg-canvas">
      <PublicHeader currentPath="/" />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-shell flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 wide:max-w-shell-wide"
      >
        <EmergencyBanner
          title="Need blood urgently?"
          action={
            <Link
              href="/request-blood"
              className={buttonClassName({ variant: "emergency", size: "lg" })}
            >
              Request blood now
            </Link>
          }
        >
          Start an emergency request and the closest matching donors are notified first.
        </EmergencyBanner>

        <section className="flex flex-col gap-5 py-10 sm:py-14">
          <div className="flex max-w-form flex-col gap-3">
            {/* Prominence comes from whitespace and a short measure, not from
                an off-scale font size — the type scale stays the type scale. */}
            <h1 className="text-h1 text-text">Blood requests, matched and coordinated.</h1>
            <p className="text-body text-text-secondary">
              {siteConfig.name} connects urgent blood requests with compatible donors nearby, and
              escalates to blood banks and hospitals when no donor is available.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/find-blood"
              className={buttonClassName({ variant: "primary", size: "md", className: "sm:px-6" })}
            >
              Find blood
            </Link>
            <Link
              href="/donor"
              className={buttonClassName({ variant: "secondary", size: "md", className: "sm:px-6" })}
            >
              I want to donate
            </Link>
          </div>
        </section>

        <section aria-labelledby="workflow-heading" className="flex flex-col gap-4 border-t border-border py-10">
          <SectionHeader
            id="workflow-heading"
            title="How a request is handled"
            description="The same operational path every time, day or night."
            action={
              <Link
                href="/how-it-works"
                className="inline-flex min-h-control items-center rounded-md px-3 text-label text-text-secondary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
              >
                Read more
              </Link>
            }
          />

          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {WORKFLOW.map((step, index) => (
              <li
                key={step.label}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4"
              >
                <span
                  aria-hidden
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-muted text-caption font-semibold tabular-nums text-text-secondary"
                >
                  {index + 1}
                </span>
                <h3 className="text-h3 text-text">{step.label}</h3>
                <p className="text-label font-normal text-text-secondary">{step.detail}</p>
              </li>
            ))}
          </ol>

          <p className="max-w-form text-label font-normal text-text-tertiary">
            If no donor responds in time, the request escalates automatically to nearby blood
            banks and hospitals.
          </p>
        </section>

        <section aria-labelledby="audiences-heading" className="flex flex-col gap-4 border-t border-border py-10">
          <SectionHeader id="audiences-heading" title="Who uses BloodConnect" />

          <ul className="grid gap-3 sm:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <li
                key={audience.title}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4"
              >
                <h3 className="text-h3 text-text">{audience.title}</h3>
                <p className="text-label font-normal text-text-secondary">{audience.detail}</p>
              </li>
            ))}
          </ul>

          {/* Sign-in already sits in the header; repeating it here would blunt
              the one action this section is asking for. */}
          <Link
            href="/register"
            className={buttonClassName({
              variant: "primary",
              size: "md",
              className: "w-full sm:w-fit sm:px-6",
            })}
          >
            Create an account
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
