import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { isNavItemActive, flattenNavSections, type NavItem } from "@/components/nav/navConfig";
import { BLOOD_REQUEST_STATUSES, DONOR_RESPONSE_STATUSES } from "@/lib/constants/requestStatus";
import { VERIFICATION_STATUSES, ESCALATION_LEVELS } from "@/lib/constants/verification";

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
    .replace(/^\s*\/\/.*$/gm, "");
}

const item = (over: Partial<NavItem> = {}): NavItem => ({
  href: "/donor",
  label: "Home",
  icon: "home",
  ...over,
});

describe("Phase 11B — design tokens", () => {
  const css = read("src/app/globals.css");
  const config = read("tailwind.config.ts");

  const APPROVED: Array<[string, string]> = [
    ["background", "255 255 255"],
    ["canvas", "247 248 250"],
    ["surface", "255 255 255"],
    ["muted", "242 244 247"],
    ["border", "228 231 236"],
    ["border-strong", "208 213 221"],
    ["text", "16 24 40"],
    ["text-secondary", "71 84 103"],
    ["text-tertiary", "102 112 133"],
    ["primary", "16 24 40"],
    ["primary-foreground", "255 255 255"],
    ["brand", "159 18 57"],
    ["emergency", "220 38 38"],
    ["emergency-hover", "185 28 28"],
    ["emergency-surface", "254 242 242"],
    ["danger", "180 35 24"],
    ["danger-surface", "254 243 242"],
    ["success", "6 118 71"],
    ["success-surface", "236 253 243"],
    ["warning", "181 71 8"],
    ["warning-surface", "255 250 235"],
    ["info", "23 92 211"],
    ["info-surface", "239 248 255"],
  ];

  it.each(APPROVED)("defines --color-%s as the approved value", (name, rgb) => {
    expect(css).toContain(`--color-${name}: ${rgb};`);
  });

  it.each(APPROVED)("exposes %s as a Tailwind token", (name) => {
    expect(config).toContain(`token("${name}")`);
  });

  it("keeps the approved radius and elevation scale", () => {
    expect(config).toContain('sm: "6px"');
    expect(config).toContain('md: "8px"');
    expect(config).toContain('lg: "12px"');
    expect(config).toContain('dialog: "16px"');
    expect(config).toContain('pill: "9999px"');
    expect(config).toContain("0 1px 2px rgba(16,24,40,.06)");
    expect(config).toContain("0 4px 12px rgba(16,24,40,.10)");
    expect(config).toContain("0 12px 32px rgba(16,24,40,.18)");
  });

  it("defines the semantic type scale with baked-in weights", () => {
    for (const name of ["h1", "h2", "h3", "body", "label", "caption", "numeric", "urgent"]) {
      expect(config).toContain(`${name.includes("-") ? `"${name}"` : name}: [`);
    }
    expect(config).toContain('"1.5rem", { lineHeight: "2rem", fontWeight: "600" }');
  });
});

describe("Phase 11B — reserved emergency red", () => {
  it("uses ink for the primary button and red only for emergency/destructive", () => {
    const button = read("src/components/ui/Button.tsx");
    const primary = button.slice(button.indexOf("primary:"), button.indexOf("secondary:"));

    // The core colour rule: emergency red must not become the generic CTA.
    expect(primary).toContain("bg-primary");
    expect(primary).not.toContain("bg-emergency");
    expect(button).toContain("bg-emergency text-white");
    expect(button).toContain("bg-danger text-white");
  });

  it("never uses the identity brand colour as a button fill", () => {
    expect(read("src/components/ui/Button.tsx")).not.toContain("bg-brand");
  });
});

describe("Phase 11B — responsive foundation", () => {
  const layout = read("src/app/layout.tsx");

  it("removes the global phone-width cap from the root shell", () => {
    expect(readCode("src/app/layout.tsx")).not.toContain("max-w-lg");
  });

  it("keeps a real desktop width scale in the shell", () => {
    const shell = read("src/components/layout/AppShell.tsx");
    expect(shell).toContain("max-w-shell");
    expect(shell).toContain("wide:max-w-shell-wide");
    expect(shell).toContain("max-w-form");
  });

  it("loads one variable font with a system fallback", () => {
    expect(layout).toContain('from "next/font/google"');
    expect(layout).toContain('variable: "--font-sans"');
    expect(read("tailwind.config.ts")).toContain("var(--font-sans)");
  });
});

describe("Phase 11B — accessibility foundation", () => {
  const layout = read("src/app/layout.tsx");
  const css = read("src/app/globals.css");

  it("does not disable pinch zoom", () => {
    const code = readCode("src/app/layout.tsx");
    expect(code).toContain("export const viewport");
    expect(code).not.toContain("maximumScale");
    expect(code).not.toContain("userScalable");
  });

  it("ships a skip link ahead of the navigation", () => {
    expect(layout).toContain("<SkipToContent />");
    expect(layout.indexOf("<SkipToContent />")).toBeLessThan(layout.indexOf("<AuthNav />"));
    expect(read("src/components/ui/SkipToContent.tsx")).toContain('href="#main-content"');
  });

  it("provides a global focus-visible indicator and reduced-motion handling", () => {
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
    // Status-carrying motion opts back in rather than disappearing.
    expect(css).toContain("data-allow-motion");
  });

  it("uses a real nav landmark for the account bar", () => {
    const authNav = read("src/components/ui/AuthNav.tsx");
    expect(authNav).toContain('aria-label="Account"');
    expect(authNav).toContain("<nav");
  });

  it("exposes the skip target from every page shell", () => {
    expect(read("src/components/ui/PageShell.tsx")).toContain('id="main-content"');
    expect(read("src/components/layout/AppShell.tsx")).toContain('id="main-content"');
    expect(read("src/app/page.tsx")).toContain('id="main-content"');
  });

  it("wires accessible form markup by default", () => {
    const field = read("src/components/ui/FormField.tsx");
    expect(field).toContain("htmlFor={id}");
    expect(field).toContain("aria-describedby");
    expect(field).toContain("invalid: error ? true : undefined");
    expect(field).toContain('role="alert"');
  });

  it("puts dialog semantics on the panel and traps focus", () => {
    const modal = read("src/components/ui/Modal.tsx");
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain("aria-labelledby={titleId}");
    expect(modal).toContain("useFocusTrap");

    const trap = read("src/lib/a11y/useFocusTrap.ts");
    expect(trap).toContain('event.key === "Escape"');
    expect(trap).toContain('event.key !== "Tab"');
    expect(trap).toContain("previouslyFocused.current?.focus");
  });

  it("holds a 44px touch-target floor in the button primitive", () => {
    const button = read("src/components/ui/Button.tsx");
    expect(button).toContain("min-h-control");
    expect(button).toContain("focus-visible:ring-2");
    expect(button).toContain("aria-busy");
    expect(read("tailwind.config.ts")).toContain('control: "44px"');
  });
});

describe("Phase 11B — navigation config", () => {
  it("marks the exact route active", () => {
    expect(isNavItemActive("/donor", item())).toBe(true);
  });

  it("marks child routes active for section roots", () => {
    expect(isNavItemActive("/donor/requests", item())).toBe(true);
  });

  it("does not match a sibling route sharing a prefix", () => {
    expect(isNavItemActive("/donors", item())).toBe(false);
  });

  it("respects exact matching", () => {
    expect(isNavItemActive("/donor/requests", item({ exact: true }))).toBe(false);
    expect(isNavItemActive("/donor", item({ exact: true }))).toBe(true);
  });

  it("handles a null pathname", () => {
    expect(isNavItemActive(null, item())).toBe(false);
  });

  it("flattens sections for the mobile bar", () => {
    const flat = flattenNavSections([
      { title: "Main", items: [item()] },
      { items: [item({ href: "/donor/history" })] },
    ]);
    expect(flat.map((i) => i.href)).toEqual(["/donor", "/donor/history"]);
  });

  it("keeps role-specific destinations out of the foundation config", () => {
    const config = read("src/components/nav/navConfig.ts");
    expect(config).not.toContain('href: "/');
  });

  it("renders count badges only from real values", () => {
    for (const file of ["src/components/nav/MobileNav.tsx", "src/components/nav/DesktopNav.tsx"]) {
      expect(read(file)).toContain('typeof item.count === "number" && item.count > 0');
    }
  });
});

describe("Phase 11B — status system", () => {
  const chip = read("src/components/ui/StatusChip.tsx");

  it("covers every request status", () => {
    for (const status of BLOOD_REQUEST_STATUSES) {
      expect(chip).toContain(`${status}:`);
    }
  });

  it("covers every match status with a human label", () => {
    for (const status of DONOR_RESPONSE_STATUSES) {
      expect(chip).toContain(`${status}:`);
    }
    expect(chip).toContain('VIEWED: "Seen"');
  });

  it("covers every verification status with a human label and a glyph", () => {
    for (const status of VERIFICATION_STATUSES) {
      expect(chip).toContain(`${status}:`);
    }
    expect(chip).toContain('REJECTED: "Needs changes"');
    expect(chip).toContain('icon: "check"');
  });

  it("covers escalation event statuses, org responses and levels", () => {
    for (const value of ["OPEN", "RESOLVED", "CANCELLED", "PENDING", "ACKNOWLEDGED", "CAN_SUPPLY", "CANNOT_HELP"]) {
      expect(chip).toContain(`${value}:`);
    }
    for (const level of ESCALATION_LEVELS) {
      expect(chip).toContain(`${level}:`);
    }
  });

  it("gives each family a distinct shape so colour is not the only signal", () => {
    expect(chip).toContain('"rounded-pill", tone.chip'); // request
    expect(chip).toContain('"rounded-sm", tone.chip'); // match / verification / escalation
    expect(chip).toContain("sr-only");
  });

  it("never falls back to a raw enum string", () => {
    expect(chip).toContain("humanizeStatus");
    expect(chip).toContain('replace(/_/g, " ")');
  });

  it("keeps the legacy StatusBadge working as a delegating wrapper", () => {
    const badge = read("src/components/ui/StatusBadge.tsx");
    expect(badge).toContain("@deprecated");
    expect(badge).toContain('<StatusChip kind="request"');
  });
});

describe("Phase 11B — route boundaries and legacy handling", () => {
  it("adds loading, error and not-found surfaces", () => {
    expect(read("src/app/loading.tsx")).toContain("LoadingState");
    expect(read("src/app/not-found.tsx")).toContain("EmptyState");
    const error = read("src/app/error.tsx");
    expect(error).toContain("ErrorState");
    // Raw error detail must never reach the user.
    expect(error).not.toContain("{error.message}");
  });

  it("stops rendering build-phase scaffolding language", () => {
    const shell = read("src/components/ui/PageShell.tsx");
    expect(shell).toContain("@deprecated");
    expect(shell).toContain("phaseNote?: string");
    expect(shell).not.toContain("{phaseNote");
  });

  it("marks unused legacy cards for consolidation instead of deleting them", () => {
    expect(read("src/components/cards/HospitalCard.tsx")).toContain("@deprecated");
    expect(read("src/components/cards/BloodBankCard.tsx")).toContain("@deprecated");
  });
});

describe("Phase 11B — no security or privacy regressions in the UI layer", () => {
  const foundationFiles = [
    "src/components/ui/Button.tsx",
    "src/components/ui/Modal.tsx",
    "src/components/ui/BottomSheet.tsx",
    "src/components/ui/ConfirmDialog.tsx",
    "src/components/ui/FormField.tsx",
    "src/components/ui/StatusChip.tsx",
    "src/components/ui/Alert.tsx",
    "src/components/ui/EmergencyBanner.tsx",
    "src/components/ui/EmptyState.tsx",
    "src/components/ui/ErrorState.tsx",
    "src/components/ui/LoadingState.tsx",
    "src/components/ui/Skeleton.tsx",
    "src/components/ui/Icon.tsx",
    "src/components/ui/PageHeader.tsx",
    "src/components/ui/SectionHeader.tsx",
    "src/components/ui/SkipToContent.tsx",
    "src/components/layout/AppShell.tsx",
    "src/components/nav/MobileNav.tsx",
    "src/components/nav/DesktopNav.tsx",
    "src/components/nav/navConfig.ts",
    "src/lib/a11y/useFocusTrap.ts",
  ];

  it.each(foundationFiles)("%s stays free of server/privileged imports", (file) => {
    const source = read(file);
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("@/lib/supabase");
    expect(source).not.toContain("@/services/");
  });

  it("introduces no donor coordinate or exact-distance rendering", () => {
    for (const file of foundationFiles) {
      const source = read(file);
      expect(source).not.toContain("latitude");
      expect(source).not.toContain("longitude");
      expect(source).not.toContain("distanceMeters");
    }
  });
});
