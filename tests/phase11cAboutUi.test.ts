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

const PAGE = "src/app/(public)/about/page.tsx";
const AUTH_NAV = "src/components/ui/AuthNav.tsx";
const HEADER = "src/components/nav/PublicHeader.tsx";

/** Routes that exist and may be linked from About. */
const EXISTING_ROUTES = [
  "/",
  "/about",
  "/find-blood",
  "/how-it-works",
  "/login",
  "/register",
  "/request-blood",
  "/donor",
];

function hrefsIn(rel: string): string[] {
  return [...readCode(rel).matchAll(/href[=:]\s*"([^"]+)"/g)].map((match) => match[1]!);
}

describe("Phase 11C — About page structure", () => {
  const page = read(PAGE);

  it("uses PublicHeader, PublicFooter and PageHeader", () => {
    expect(page).toContain('from "@/components/nav/PublicHeader"');
    expect(page).toContain('from "@/components/layout/PublicFooter"');
    expect(page).toContain('from "@/components/ui/PageHeader"');
    expect(page).toContain('<PublicHeader currentPath="/about" />');
    expect(page).toContain("<PublicFooter />");
    expect(page).toContain("<PageHeader");
  });

  it("owns a semantic main with the skip target and exactly one h1", () => {
    expect(page).toContain("<main");
    expect(page).toContain('id="main-content"');
    expect(page).toContain("tabIndex={-1}");
    // PageHeader owns the only h1.
    expect(readCode(PAGE)).not.toContain("<h1");
    expect(page).toContain("<PageHeader");
    expect(read("src/components/ui/PageHeader.tsx")).toContain("<h1");
  });

  it("keeps a logical heading hierarchy through SectionHeader and h3", () => {
    expect(page.match(/<SectionHeader/g)?.length).toBeGreaterThanOrEqual(3);
    expect(page).toContain("<h3");
    expect(readCode(PAGE)).not.toContain("<h2");
  });

  it("names each content section for screen readers", () => {
    expect(page).toContain('aria-labelledby="what-heading"');
    expect(page).toContain('aria-labelledby="participants-heading"');
    expect(page).toContain('aria-labelledby="practices-heading"');
    expect(page).toContain('aria-labelledby="next-heading"');
  });
});

describe("Phase 11C — About public navigation", () => {
  it("renders exactly one public header and no AuthNav", () => {
    const page = read(PAGE);
    expect(page.match(/<PublicHeader/g)).toHaveLength(1);
    expect(page.match(/<PublicFooter/g)).toHaveLength(1);
    expect(readCode(PAGE)).not.toContain("AuthNav");
    expect(readCode(PAGE)).not.toContain("PageShell");
  });

  it("marks About as the active destination", () => {
    expect(read(PAGE)).toContain('currentPath="/about"');
    expect(read(HEADER)).toContain('href: "/about"');
    expect(read(HEADER)).toContain('aria-current={active ? "page" : undefined}');
  });

  it("hides the global account bar on /about", () => {
    const nav = read(AUTH_NAV);
    expect(nav).toContain('"/about"');
    expect(nav).toContain("return null");
  });

  it("reuses BrandLogo through PublicHeader, not inline", () => {
    expect(readCode(PAGE)).not.toContain("BrandLogo");
    expect(readCode(PAGE)).not.toContain("bloodconnect-logo.svg");
    expect(readCode(PAGE)).not.toContain("<svg");
    expect(read(HEADER)).toContain("<BrandLogo");
  });
});

describe("Phase 11C — About content safety", () => {
  const page = read(PAGE);
  const code = readCode(PAGE).toLowerCase();

  it("lists the four supported participant groups", () => {
    for (const group of ["Requesters", "Donors", "Hospitals", "Blood banks"]) {
      expect(page, `missing ${group}`).toContain(`title: "${group}"`);
    }
  });

  it("makes no invented metrics or marketing claims", () => {
    const banned = [
      "save thousands",
      "lives saved",
      "#1",
      "revolutioniz",
      "changing the world",
      "millions",
      "ai-powered",
      "seamless ecosystem",
      "guaranteed",
      "100%",
      "government",
      "award",
      "testimonial",
      "our partners",
      "founding",
      "founder",
      "funded",
      "certification",
    ];
    for (const claim of banned) {
      expect(code, `contains banned claim "${claim}"`).not.toContain(claim);
    }
    expect(code).not.toMatch(/\d\s*%/);
    expect(code).not.toMatch(/\d{3,}\s+(users|donors|hospitals|donations)/);
  });

  it("exposes no implementation terminology", () => {
    for (const internal of [
      "postgis",
      "rpc",
      "service_role",
      "service-role",
      "supabase",
      "security definer",
      "blood_requests",
      "user_roles",
      "st_dwithin",
      "scorematch",
      "uuid",
    ]) {
      expect(code, `leaks "${internal}"`).not.toContain(internal);
    }
    // Raw status enums must not appear as user-facing copy.
    for (const status of [
      "PENDING",
      "MATCHING",
      "DONOR_ACCEPTED",
      "DONOR_ON_THE_WAY",
      "NO_MATCH_FOUND",
    ]) {
      expect(readCode(PAGE)).not.toContain(status);
    }
  });

  it("does not invent unsupported routes or CTAs", () => {
    for (const href of hrefsIn(PAGE)) {
      expect(EXISTING_ROUTES, `About links unknown route ${href}`).toContain(href);
    }
    expect(hrefsIn(PAGE)).toContain("/find-blood");
    expect(hrefsIn(PAGE)).toContain("/how-it-works");
    const codeOnly = readCode(PAGE).toLowerCase();
    expect(codeOnly).not.toContain("contact us");
    expect(codeOnly).not.toContain("book appointment");
    expect(codeOnly).not.toContain("hospital registration");
  });

  it("keeps coordination language and avoids fulfillment guarantees", () => {
    expect(page).toContain("coordination");
    expect(code).not.toContain("guarantees blood");
    expect(code).not.toContain("always finds a donor");
    expect(code).not.toContain("provides blood instantly");
    expect(code).not.toContain("whole country");
  });
});

describe("Phase 11C — About design system", () => {
  const code = readCode(PAGE);

  it("uses Phase 11B primitives and semantic tokens", () => {
    expect(read(PAGE)).toContain('from "@/components/ui/SectionHeader"');
    expect(read(PAGE)).toContain("buttonClassName(");
    expect(code).not.toContain("inputClassName");
    expect(code).not.toContain("text-gray-");
    expect(code).not.toContain("rounded-xl");
    expect(code).not.toMatch(/text-\[/);
  });

  it("avoids gradients, glass, decorative elevation and emergency red", () => {
    expect(code).not.toContain("gradient");
    expect(code).not.toContain("backdrop-blur");
    expect(code).not.toContain("shadow-");
    expect(code).not.toContain("emergency");
    expect(code).not.toContain("EmergencyBanner");
    expect(code).not.toContain('variant="emergency"');
  });

  it("uses the real width scale and readable prose measure", () => {
    expect(read(PAGE)).toContain("max-w-shell");
    expect(read(PAGE)).toContain("wide:max-w-shell-wide");
    expect(read(PAGE)).toContain("max-w-form");
    expect(code).not.toContain("max-w-lg");
    expect(code).not.toContain("<table");
    expect(code).not.toContain("min-w-[");
  });

  it("stacks participant cards on mobile and splits at sm", () => {
    expect(read(PAGE)).toContain("grid gap-3 sm:grid-cols-2");
    expect(read(PAGE)).toContain("flex flex-col gap-2 sm:flex-row");
    expect(read(PAGE)).toMatch(/px-4[^"]*sm:px-6/);
  });

  it("gives CTAs the Button primitive's touch-target floor", () => {
    expect(read("src/components/ui/Button.tsx")).toContain("min-h-control");
    expect(read(PAGE)).toContain('size: "md"');
  });
});

describe("Phase 11C — About leaves other surfaces alone", () => {
  it("does not redesign how-it-works", () => {
    expect(read("src/app/(public)/how-it-works/page.tsx")).toContain("PageShell");
    expect(readCode("src/app/(public)/how-it-works/page.tsx")).not.toContain("PublicHeader");
  });

  it("leaves landing, Find Blood and Auth as their steps shipped them", () => {
    expect(read("src/app/page.tsx")).toContain('<PublicHeader currentPath="/" />');
    expect(read("src/app/(public)/find-blood/page.tsx")).toContain(
      '<PublicHeader currentPath="/find-blood" />'
    );
    expect(read("src/app/(auth)/layout.tsx")).toContain('id="main-content"');
    expect(read("src/components/forms/LoginForm.tsx")).toContain(
      "await loginAction(parsed.data, next)"
    );
  });

  it("adds no server action, service call or data fetch", () => {
    const code = readCode(PAGE);
    expect(code).not.toContain('"use server"');
    expect(code).not.toContain("@/services/");
    expect(code).not.toContain("await fetch(");
    expect(code).not.toContain("@/lib/supabase");
  });
});
