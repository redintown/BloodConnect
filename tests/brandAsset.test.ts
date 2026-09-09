import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const LOGO_PATH = "public/logo/bloodconnect-logo.svg";

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

/**
 * Source with comments removed, so "must not contain" guards assert on real
 * code and are not tripped by prose describing the rule being enforced.
 */
function readCode(rel: string) {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("Official brand asset", () => {
  it("is present at the canonical public path", () => {
    expect(existsSync(path.join(root, LOGO_PATH))).toBe(true);
    expect(statSync(path.join(root, LOGO_PATH)).size).toBeGreaterThan(0);
  });

  it("is still the supplied vector artwork (no rasterising, no embedding)", () => {
    const svg = read(LOGO_PATH);
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 1254 1254"');
    // Guards against anyone swapping the vector for a traced/embedded bitmap.
    expect(svg).not.toContain("<image");
    expect(svg).not.toContain("base64");
  });

  it("is not duplicated inside the source tree", () => {
    // The asset lives in /public only; components reference it by path.
    for (const dir of ["src/components", "src/app"]) {
      expect(existsSync(path.join(root, dir, "bloodconnect-logo.svg"))).toBe(false);
    }
  });
});

describe("BrandLogo component", () => {
  const brand = read("src/components/brand/BrandLogo.tsx");

  it("renders the official asset from the single canonical path", () => {
    expect(brand).toContain('const LOGO_SRC = "/logo/bloodconnect-logo.svg"');
  });

  it("preserves the 1:1 aspect ratio and avoids layout shift", () => {
    // Intrinsic dimensions passed to next/image; display size driven by
    // height with w-auto so the artwork can never be distorted.
    expect(brand).toContain("const INTRINSIC_SIZE = 1254");
    expect(brand).toContain("width={INTRINSIC_SIZE}");
    expect(brand).toContain("height={INTRINSIC_SIZE}");
    expect(brand).toContain("w-auto");
  });

  it("does not recolour or filter the artwork", () => {
    const code = readCode("src/components/brand/BrandLogo.tsx");
    for (const forbidden of ["filter", "grayscale", "invert", "mix-blend", "fill-", "opacity-"]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("serves the SVG as-is rather than through the image optimizer", () => {
    expect(brand).toContain("unoptimized");
  });

  it("exposes exactly one accessible name per variant", () => {
    // `full` pairs a decorative image with the visible wordmark;
    // `mark` carries the name on the image itself.
    expect(brand).toContain('alt={variant === "mark" ? siteConfig.name : ""}');
    expect(brand).toContain("siteConfig.name");
  });

  it("stays presentational — no data, services or business logic", () => {
    expect(brand).not.toContain("@/services/");
    expect(brand).not.toContain("@/lib/supabase");
    expect(brand).not.toContain("use client");
  });
});

describe("Brand integration", () => {
  const consumers = ["src/components/nav/DesktopNav.tsx", "src/components/ui/AuthNav.tsx"];

  it.each(consumers)("%s renders the shared BrandLogo component", (file) => {
    const source = read(file);
    expect(source).toContain('from "@/components/brand/BrandLogo"');
    expect(source).toContain("<BrandLogo");
  });

  it.each(consumers)("%s does not inline logo markup or asset paths", (file) => {
    const source = read(file);
    expect(source).not.toContain("bloodconnect-logo.svg");
    expect(source).not.toContain("<svg");
  });

  it("covers desktop rail, tablet bar and mobile header", () => {
    const desktop = read("src/components/nav/DesktopNav.tsx");
    // Rail gets the full lock-up; the tablet row gets the emblem only.
    expect(desktop).toContain('<BrandLogo variant="full" size="md" priority />');
    expect(desktop).toContain('<BrandLogo variant="mark" size="sm" priority />');
    // Mobile header is the global top bar.
    expect(read("src/components/ui/AuthNav.tsx")).toContain('<BrandLogo variant="mark"');
  });

  it("keeps brand links free of duplicate accessible labels", () => {
    for (const file of consumers) {
      const source = read(file);
      expect(source).not.toContain('aria-label="BloodConnect');
      expect(source).not.toContain('aria-label="BloodConnect home"');
    }
  });

  it("keeps the account landmark intact in the global bar", () => {
    const authNav = read("src/components/ui/AuthNav.tsx");
    expect(authNav).toContain('aria-label="Account"');
    expect(authNav).toContain("<nav");
  });

  it("keeps a 44px touch target on brand links in compact bars", () => {
    expect(read("src/components/ui/AuthNav.tsx")).toContain("min-h-control");
    expect(read("src/components/nav/DesktopNav.tsx")).toContain("min-h-control min-w-control");
  });
});

describe("Favicon and PWA wiring", () => {
  it("points the browser icon at the official brand mark", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('icon: [{ url: "/logo/bloodconnect-logo.svg", type: "image/svg+xml" }]');
  });

  it("uses the official mark as the installed app icon", () => {
    const manifest = read("src/app/manifest.ts");
    expect(manifest).toContain('src: "/logo/bloodconnect-logo.svg"');
    expect(manifest).not.toContain("/icons/icon.svg");
  });

  it("leaves the rest of the PWA configuration untouched", () => {
    const manifest = read("src/app/manifest.ts");
    expect(manifest).toContain('display: "standalone"');
    expect(manifest).toContain('start_url: "/"');
    // Emergency red stays the reserved theme colour; the logo's own red is
    // never promoted into the token system.
    expect(manifest).toContain('theme_color: "#DC2626"');
    expect(read("src/app/globals.css")).not.toContain("C5030C");
    expect(read("tailwind.config.ts")).not.toContain("C5030C");
  });
});
