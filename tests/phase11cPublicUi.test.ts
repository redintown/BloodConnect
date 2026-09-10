import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

/**
 * Source with comments removed, so "must not contain" guards assert on real
 * code and cannot be satisfied or broken by prose that names the old pattern.
 */
function readCode(rel: string) {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const LANDING = "src/app/page.tsx";
const HEADER = "src/components/nav/PublicHeader.tsx";
const FOOTER = "src/components/layout/PublicFooter.tsx";
const AUTH_NAV = "src/components/ui/AuthNav.tsx";

const PUBLIC_UI_FILES = [LANDING, HEADER, FOOTER];

/** Every route that actually exists in src/app. Nothing else may be linked. */
const EXISTING_ROUTES = [
  "/",
  "/about",
  "/admin",
  "/blood-bank",
  "/donor",
  "/find-blood",
  "/hospital",
  "/how-it-works",
  "/login",
  "/register",
  "/request-blood",
  "/requests",
  "/unauthorized",
];

/** Routes that are role-gated server-side and must not appear in public nav. */
const PORTAL_ROUTES = ["/admin", "/blood-bank", "/donor", "/hospital", "/requests"];

/** Routes linked as JSX `href="..."` or declared as a nav item `href: "..."`. */
function hrefsIn(rel: string): string[] {
  return [...readCode(rel).matchAll(/href[=:]\s*"([^"]+)"/g)].map((match) => match[1]!);
}

describe("Phase 11C — landing page structure", () => {
  const landing = read(LANDING);

  it("uses semantic header / nav / main / footer", () => {
    expect(landing).toContain('<PublicHeader currentPath="/" />');
    expect(landing).toContain("<PublicFooter />");
    expect(read(HEADER)).toContain("<header");
    expect(read(HEADER)).toContain("<nav");
    expect(read(FOOTER)).toContain("<footer");
    expect(read(FOOTER)).toContain("<nav");
    expect(landing).toContain("<main");
  });

  it("keeps the skip-to-content target functional", () => {
    expect(landing).toContain('id="main-content"');
    expect(landing).toContain("tabIndex={-1}");
    expect(read("src/components/ui/SkipToContent.tsx")).toContain("#main-content");
  });

  it("has exactly one h1 and delegates h2 to SectionHeader", () => {
    expect(landing.match(/<h1/g)).toHaveLength(1);
    expect(readCode(LANDING)).not.toContain("<h2");
    expect(landing.match(/<SectionHeader/g)).toHaveLength(2);
    expect(landing).toContain("<h3");
  });

  it("names each landmark region for screen readers", () => {
    expect(landing).toContain('aria-labelledby="workflow-heading"');
    expect(landing).toContain('aria-labelledby="audiences-heading"');
    expect(landing).toContain('id="workflow-heading"');
    expect(landing).toContain('id="audiences-heading"');
  });

  it("answers what / what can I do / what next", () => {
    expect(landing).toContain("<h1");
    expect(landing).toContain("How a request is handled");
    expect(landing).toContain("Who uses BloodConnect");
    expect(landing).toContain('href="/find-blood"');
    expect(landing).toContain('href="/register"');
  });

  it("describes a five-step operational workflow", () => {
    for (const step of ["Request", "Match", "Respond", "Coordinate", "Complete"]) {
      expect(landing, `missing step ${step}`).toContain(`label: "${step}"`);
    }
  });
});

describe("Phase 11C — only real routes and real capabilities", () => {
  it("links nothing that does not exist", () => {
    for (const file of PUBLIC_UI_FILES) {
      for (const href of hrefsIn(file)) {
        expect(EXISTING_ROUTES, `${file} links unknown route ${href}`).toContain(href);
      }
    }
  });

  it("keeps portal destinations out of the public navigation", () => {
    const headerHrefs = hrefsIn(HEADER);
    for (const portal of PORTAL_ROUTES) {
      expect(headerHrefs, `public nav exposes ${portal}`).not.toContain(portal);
    }
    expect(headerHrefs).toContain("/find-blood");
    expect(headerHrefs).toContain("/how-it-works");
    expect(headerHrefs).toContain("/about");
  });

  it("invents no donate route — donating goes through the existing entries", () => {
    for (const file of PUBLIC_UI_FILES) {
      const hrefs = hrefsIn(file);
      expect(hrefs, `${file} invents a donate route`).not.toContain("/donate");
      expect(hrefs, `${file} invents a donate route`).not.toContain("/donate-blood");
      expect(hrefs, `${file} invents a donate route`).not.toContain("/become-a-donor");
    }
  });

  it("makes no marketing claims and invents no metrics", () => {
    const banned = [
      "save thousands",
      "lives saved",
      "#1",
      "instantly",
      "guaranteed",
      "100%",
      "trusted by",
      "testimonial",
      "our partners",
      "award",
      "million",
    ];
    for (const file of PUBLIC_UI_FILES) {
      // Rendered copy only — the source comments discuss these very words.
      const text = readCode(file).toLowerCase();
      for (const claim of banned) {
        expect(text, `${file} contains the claim "${claim}"`).not.toContain(claim);
      }
      expect(text, `${file} contains a percentage`).not.toMatch(/\d\s*%/);
    }
  });

  it("explains the workflow without exposing implementation details", () => {
    const internals = [
      "postgis",
      "rpc",
      "service_role",
      "service-role",
      "supabase",
      "blood_requests",
      "user_roles",
      "score",
      "st_dwithin",
      "sql",
    ];
    for (const file of PUBLIC_UI_FILES) {
      // Rendered copy only — engineering comments may name what is avoided.
      const text = readCode(file).toLowerCase();
      for (const internal of internals) {
        expect(text, `${file} leaks "${internal}"`).not.toContain(internal);
      }
    }
  });
});

describe("Phase 11C — emergency stays a single signal", () => {
  const landing = read(LANDING);

  it("uses the established EmergencyBanner pattern exactly once", () => {
    expect(landing).toContain('from "@/components/ui/EmergencyBanner"');
    expect(landing.match(/<EmergencyBanner/g)).toHaveLength(1);
  });

  it("carries one emergency-coloured action, pointing at the real route", () => {
    expect(landing.match(/variant: "emergency"/g)).toHaveLength(1);
    expect(landing).toContain('href="/request-blood"');
  });

  it("does not paint the page or its other actions red", () => {
    const code = readCode(LANDING);
    expect(code).not.toContain("bg-emergency ");
    expect(code).not.toContain('className="bg-emergency');
    expect(code).not.toContain("text-emergency");
    expect(code).not.toContain("bg-brand");
    for (const file of [HEADER, FOOTER]) {
      expect(readCode(file), `${file} uses emergency colour`).not.toContain("emergency");
    }
  });

  it("uses no attention animation anywhere on the public surface", () => {
    for (const file of PUBLIC_UI_FILES) {
      const code = readCode(file);
      expect(code, `${file} animates`).not.toContain("animate-");
      expect(code, `${file} animates`).not.toContain("transition-transform");
      expect(code, `${file} animates`).not.toContain("active:scale");
    }
  });
});

describe("Phase 11C — Clinical Infrastructure visual rules", () => {
  it("avoids gradients, glass and decorative elevation", () => {
    for (const file of PUBLIC_UI_FILES) {
      const code = readCode(file);
      expect(code, `${file} uses a gradient`).not.toContain("gradient");
      expect(code, `${file} uses glass`).not.toContain("backdrop-blur");
      expect(code, `${file} uses decorative elevation`).not.toContain("shadow-");
    }
  });

  it("uses only semantic tokens — no legacy palette classes", () => {
    const legacy = [
      "text-gray-",
      "border-gray-",
      "bg-gray-",
      "text-red-",
      "bg-white",
      "rounded-xl",
      "text-2xl",
      "text-sm",
    ];
    for (const file of PUBLIC_UI_FILES) {
      const code = readCode(file);
      for (const cls of legacy) {
        expect(code, `${file} still uses ${cls}`).not.toContain(cls);
      }
    }
  });

  it("keeps radii in the 6–12px token range", () => {
    for (const file of PUBLIC_UI_FILES) {
      const code = readCode(file);
      expect(code).not.toContain("rounded-full");
      expect(code).not.toContain("rounded-dialog");
      expect(code).not.toContain("rounded-pill");
    }
  });

  it("stays on the type scale instead of arbitrary font sizes", () => {
    for (const file of PUBLIC_UI_FILES) {
      expect(readCode(file), `${file} uses an off-scale size`).not.toMatch(/text-\[/);
    }
  });
});

describe("Phase 11C — reuses primitives instead of duplicating them", () => {
  it("styles link CTAs with the Button primitive's own classes", () => {
    expect(read(LANDING)).toContain('from "@/components/ui/Button"');
    expect(read(LANDING)).toContain("buttonClassName(");
    expect(read(HEADER)).toContain("buttonClassName(");
  });

  it("renders the brand only through BrandLogo", () => {
    expect(read(HEADER)).toContain('from "@/components/brand/BrandLogo"');
    expect(readCode(HEADER)).not.toContain("<svg");
    expect(readCode(HEADER)).not.toContain("bloodconnect-logo.svg");
    // Footer is text-only: a second mark would give the page two logos.
    expect(readCode(FOOTER)).not.toContain("BrandLogo");
    expect(readCode(LANDING)).not.toContain("BrandLogo");
  });

  it("defines no competing button, input or navigation system", () => {
    for (const file of PUBLIC_UI_FILES) {
      const code = readCode(file);
      expect(code).not.toMatch(/function (Button|FormField|Alert|MobileNav|DesktopNav)\s*\(/);
      expect(code).not.toContain("<input");
    }
  });

  it("shares the navigation contract with the portal navigations", () => {
    const header = read(HEADER);
    expect(header).toContain('from "@/components/nav/navConfig"');
    expect(header).toContain("isNavItemActive");
    expect(header).toContain("NavItem");
    expect(header).toContain('aria-current={active ? "page" : undefined}');
  });

  it("ships no client JS from the public entry point", () => {
    const header = read(HEADER);
    // A session read here would drag the Supabase browser client onto the
    // landing page just to pick a link label.
    expect(header).not.toContain('"use client"');
    expect(header).not.toContain("useAuth");
    expect(header).not.toContain("usePathname");
    expect(header).not.toContain("@/lib/supabase");
    expect(header).not.toContain("@/services/");
    expect(header).not.toContain("createAdminClient");
    expect(header).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(read(FOOTER)).not.toContain('"use client"');
  });

  it("drops the deprecated one-off EmergencyButton from the landing page", () => {
    expect(readCode(LANDING)).not.toContain("EmergencyButton");
    // Left in place, still marked, so nothing silently loses its migration note.
    expect(read("src/components/ui/EmergencyButton.tsx")).toContain("@deprecated");
  });
});

describe("Phase 11C — public navigation behaviour", () => {
  const header = read(HEADER);

  it("puts brand left and account actions right", () => {
    expect(header).toContain('<Link href="/"');
    expect(header).toContain("ml-auto");
    expect(header).toContain('href="/login"');
    expect(header).toContain('href="/register"');
  });

  it("adapts the destination row instead of hiding it behind a hamburger", () => {
    expect(header).toContain("flex-wrap");
    expect(header).toContain("order-last");
    expect(header).toContain("sm:order-none");
    expect(readCode(HEADER)).not.toContain("hamburger");
    expect(readCode(HEADER)).not.toContain("useState");
  });

  it("shows one brand name per viewport and adds no second label", () => {
    expect(header).toContain('variant="mark"');
    expect(header).toContain('variant="full"');
    expect(header).toContain("sm:hidden");
    expect(header).toContain("hidden sm:inline-flex");
    expect(readCode(HEADER)).not.toMatch(/aria-label="BloodConnect"/);
  });

  it("offers the two authentication actions and gates nothing", () => {
    expect(header).toContain("Sign in");
    expect(header).toContain("Create account");
    expect(header).toContain('buttonClassName({ variant: "primary", size: "sm" })');
    // The account bar still carries session state on authenticated routes.
    expect(read(AUTH_NAV)).toContain("useAuth");
    expect(read(AUTH_NAV)).toContain("<form action={logoutAction}>");
  });

  it("marks the active destination through the shared matcher", () => {
    expect(header).toContain("isNavItemActive(currentPath ?? null, item)");
    expect(read(LANDING)).toContain('currentPath="/"');
  });

  it("gives every public control a 44px target", () => {
    // Nav links, sign-in and log-out all share one class constant, so the
    // floor is asserted on the constant rather than counted per link.
    expect(header).toMatch(/const linkClassName =\s*\n?\s*"inline-flex min-h-control/);
    expect(header).toContain("flex min-h-control shrink-0 items-center rounded-md");
    expect(read(FOOTER)).toContain("min-h-control");
    // Button size sm keeps the 44px floor on touch viewports.
    expect(read("src/components/ui/Button.tsx")).toContain(
      'sm: "min-h-control sm:min-h-control-desktop px-3 text-label"'
    );
  });

  it("keeps visible focus states on every public link", () => {
    for (const file of [HEADER, FOOTER]) {
      expect(read(file), `${file} has no focus ring`).toContain("focus-visible:ring-2");
    }
  });

  it("names each navigation landmark distinctly", () => {
    expect(header).toContain('aria-label="Public"');
    expect(read(FOOTER)).toContain('aria-label="Footer"');
  });
});

describe("Phase 11C — responsive structure", () => {
  it("uses the real desktop width scale, not the old phone column", () => {
    for (const file of PUBLIC_UI_FILES) {
      const source = read(file);
      expect(source, `${file} is not width-capped`).toContain("max-w-shell");
      expect(source, `${file} has no large-desktop cap`).toContain("wide:max-w-shell-wide");
      expect(readCode(file)).not.toContain("max-w-lg");
    }
  });

  it("caps reading measure so text does not stretch at 1440px", () => {
    expect(read(LANDING)).toContain("max-w-form");
  });

  it("scales padding up from mobile rather than down from desktop", () => {
    for (const file of PUBLIC_UI_FILES) {
      expect(read(file), `${file} lacks responsive padding`).toMatch(/px-4[^"]*sm:px-6/);
    }
  });

  it("stacks every multi-column block on small screens", () => {
    const landing = read(LANDING);
    expect(landing).toContain("grid gap-3 sm:grid-cols-2 lg:grid-cols-5");
    expect(landing).toContain("grid gap-3 sm:grid-cols-3");
    expect(landing).toContain("flex flex-col gap-2 sm:flex-row");
    expect(readCode(LANDING)).not.toMatch(/"grid grid-cols-[2-9]/);
  });

  it("never disables browser zoom", () => {
    const rootLayout = readCode("src/app/layout.tsx");
    expect(rootLayout).not.toContain("maximumScale");
    expect(rootLayout).not.toContain("userScalable");
  });
});

describe("Phase 11C — one header, no duplicate navigation", () => {
  it("hides the global account bar wherever a page owns its header", () => {
    const nav = read(AUTH_NAV);
    // The list grows as routes adopt PublicHeader; each entry must be present.
    expect(nav).toContain("const HIDDEN_ON = [");
    for (const route of ["/", "/login", "/register"]) {
      expect(nav, `account bar still renders on ${route}`).toContain(`"${route}"`);
    }
    expect(nav).toContain("usePathname");
    expect(nav).toContain("return null");
  });

  it("leaves the landing page with a single header and a single logo", () => {
    const landing = read(LANDING);
    expect(landing.match(/<PublicHeader/g)).toHaveLength(1);
    expect(landing.match(/<PublicFooter/g)).toHaveLength(1);
    expect(readCode(LANDING)).not.toContain("AuthNav");
    expect(readCode(LANDING)).not.toContain("DesktopNav");
    expect(readCode(LANDING)).not.toContain("MobileNav");
  });
});

describe("Phase 11C — Step 1 auth UI and existing behaviour untouched", () => {
  it("leaves the redesigned auth screens exactly as Step 1 shipped them", () => {
    const layout = read("src/app/(auth)/layout.tsx");
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain("<BrandLogo");
    expect(read("src/app/(auth)/login/page.tsx")).toContain("<LoginForm next={searchParams.next} />");
    expect(read("src/app/(auth)/register/page.tsx")).toContain("<RegisterForm />");
    expect(read("src/components/forms/LoginForm.tsx")).toContain(
      "await loginAction(parsed.data, next)"
    );
    expect(read("src/components/forms/RegisterForm.tsx")).toContain(
      "await registerAction(parsed.data)"
    );
  });

  it("keeps the auth server actions and their error mapping unchanged", () => {
    const actions = read("src/app/(auth)/actions.ts");
    expect(actions).toContain("export async function loginAction");
    expect(actions).toContain("export async function registerAction");
    expect(actions).toContain("export async function logoutAction");
    expect(actions).toContain('error.code === "CONFLICT"');
    expect(actions).toContain("needsEmailConfirmation: true");
  });

  it("preserves the landing page's existing donor and request entry points", () => {
    const landing = read(LANDING);
    expect(landing).toContain("I want to donate");
    expect(landing).toContain('href="/donor"');
    expect(landing).toContain('href="/request-blood"');
    expect(landing).not.toContain("DonorMatchPopup");
  });

  it("adds no server action, service call or data fetch to the public surface", () => {
    for (const file of PUBLIC_UI_FILES) {
      const code = readCode(file);
      expect(code, `${file} declares a server action`).not.toContain('"use server"');
      expect(code, `${file} calls a service`).not.toContain("@/services/");
      expect(code, `${file} fetches data`).not.toContain("await fetch(");
      expect(code, `${file} imports an action`).not.toContain("actions");
    }
  });
});
