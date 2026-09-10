import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";
import {
  PUBLIC_SEARCH_ORG_TYPES,
  PUBLIC_SEARCH_RADIUS_KM,
  publicBloodSearchSchema,
} from "@/schemas/publicBloodSearch.schema";
import { formatCoarseDistance } from "@/lib/inventory/publicSearch";

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

const PAGE = "src/app/(public)/find-blood/page.tsx";
const FORM = "src/components/forms/FindBloodSearchForm.tsx";
const ACTIONS = "src/app/(public)/actions.ts";
const SERVICE = "src/services/bloodAvailabilityService.ts";
const AUTH_NAV = "src/components/ui/AuthNav.tsx";

const UI_FILES = [PAGE, FORM];

/** Routes that exist in src/app. Nothing else may be linked. */
const EXISTING_ROUTES = [
  "/",
  "/about",
  "/find-blood",
  "/how-it-works",
  "/login",
  "/register",
  "/request-blood",
];

function hrefsIn(rel: string): string[] {
  return [...readCode(rel).matchAll(/href[=:]\s*"([^"]+)"/g)].map((match) => match[1]!);
}

describe("Phase 11C — Find Blood search contract preserved", () => {
  const form = read(FORM);

  it("keeps the existing blood-group values and their display labels", () => {
    expect(BLOOD_GROUPS).toEqual([
      "A_POS",
      "A_NEG",
      "B_POS",
      "B_NEG",
      "AB_POS",
      "AB_NEG",
      "O_POS",
      "O_NEG",
    ]);
    expect(BLOOD_GROUP_LABELS).toEqual({
      A_POS: "A+",
      A_NEG: "A−",
      B_POS: "B+",
      B_NEG: "B−",
      AB_POS: "AB+",
      AB_NEG: "AB−",
      O_POS: "O+",
      O_NEG: "O−",
    });
    // The UI iterates the source of truth and submits the enum, not the label.
    expect(form).toContain("BLOOD_GROUPS.map");
    expect(form).toContain("BLOOD_GROUP_LABELS[group]");
    expect(form).toContain('value={group}');
    expect(form).toContain("setBloodGroup(group)");
    expect(readCode(FORM)).not.toContain('value="A+"');
  });

  it("submits through the existing schema and server action only", () => {
    expect(form).toContain('from "@/schemas/publicBloodSearch.schema"');
    expect(form).toContain("publicBloodSearchSchema.safeParse({");
    expect(form).toContain("await searchPublicBloodAvailabilityAction(parsed.data)");
    expect(read(ACTIONS)).toContain("bloodAvailabilityService.search");
  });

  it("never reaches the database or the RPC from the browser", () => {
    const code = readCode(FORM);
    expect(code).not.toContain("search_public_blood_availability");
    expect(code).not.toContain(".rpc(");
    expect(code).not.toContain("createClient");
    expect(code).not.toContain("createAdminClient");
    expect(code).not.toContain("@/lib/supabase");
    expect(code).not.toContain("@/services/");
  });

  it("keeps all four existing filters and adds none", () => {
    expect(PUBLIC_SEARCH_RADIUS_KM).toEqual([5, 10, 25, 50]);
    expect(PUBLIC_SEARCH_ORG_TYPES).toEqual(["ALL", "HOSPITAL", "BLOOD_BANK"]);
    expect(Object.keys(publicBloodSearchSchema.shape).sort()).toEqual([
      "bloodGroup",
      "latitude",
      "longitude",
      "organizationType",
      "radiusKm",
    ]);
    expect(form).toContain("PUBLIC_SEARCH_RADIUS_KM.map");
    expect(form).toContain("PUBLIC_SEARCH_ORG_TYPES.map");
    expect(form).toContain("radiusKm,");
    expect(form).toContain("organizationType,");
  });

  it("keeps the radius options and default unchanged", () => {
    expect(form).toContain("useState<PublicSearchRadiusKm>(10)");
    expect(form).toContain('useState<PublicSearchOrgType>("ALL")');
    expect(readCode(FORM)).not.toMatch(/radiusKm:\s*\d+\s*\}/);
  });

  it("preserves browser geolocation as the only location mechanism", () => {
    expect(form).toContain('from "@/hooks/useGeolocation"');
    expect(form).toContain("requestLocation");
    // No map SDK, no geocoding, no manual coordinate entry.
    const code = readCode(FORM);
    expect(code).not.toContain("google");
    expect(code).not.toContain("mapbox");
    expect(code).not.toContain("geocod");
    expect(code).not.toContain('type="number"');
  });

  it("leaves the shared LocationPicker untouched for the portal forms", () => {
    const picker = read("src/components/forms/LocationPicker.tsx");
    expect(picker).toContain("useGeolocation");
    for (const portalForm of [
      "src/components/forms/DonorProfileForm.tsx",
      "src/components/forms/HospitalProfileForm.tsx",
      "src/components/forms/BloodBankProfileForm.tsx",
      "src/components/forms/BloodRequestForm.tsx",
    ]) {
      expect(read(portalForm), `${portalForm} lost LocationPicker`).toContain("LocationPicker");
    }
    expect(readCode(FORM)).not.toContain("LocationPicker");
  });

  it("introduces no URL state, pagination or state library", () => {
    const code = readCode(FORM);
    expect(code).not.toContain("useSearchParams");
    expect(code).not.toContain("useRouter");
    expect(code).not.toContain("router.push");
    expect(code).not.toContain("page=");
    expect(code).not.toContain("pageSize");
    expect(code).not.toContain("loadMore");
    expect(code).not.toContain("zustand");
    expect(code).not.toContain("redux");
  });
});

describe("Phase 11C — Find Blood result presentation and privacy", () => {
  const form = read(FORM);
  const code = readCode(FORM);

  it("renders only fields the existing DTO provides", () => {
    for (const field of [
      "item.name",
      "item.address",
      "item.distanceLabel",
      "item.freshnessLabel",
      "item.has24hEmergency",
      "item.emergencyHours",
      "item.organizationType",
    ]) {
      expect(form, `missing ${field}`).toContain(field);
    }
  });

  it("never renders an internal identifier", () => {
    // organizationId may only key a list item or drive local expand state.
    const usages = code.split("\n").filter((line) => line.includes("organizationId"));
    expect(usages.length).toBeGreaterThan(0);
    for (const line of usages) {
      expect(
        /key=\{|expandedId|setExpandedId/.test(line),
        `organizationId used outside key/state: ${line.trim()}`
      ).toBe(true);
    }
    expect(code).not.toContain("uuid");
    expect(code).not.toContain("item.availability");
    expect(code).not.toContain("item.inventoryUpdatedAt");
  });

  it("shows coarse distance only, never a precise donor distance", () => {
    expect(form).toContain("{item.distanceLabel}");
    expect(code).not.toContain("distanceKmRounded");
    expect(code).not.toContain("distanceMeters");
    expect(code).not.toContain("toFixed");
    expect(formatCoarseDistance(4.2)).toBe("5 km away");
  });

  it("exposes no coordinates and no donor data", () => {
    for (const file of UI_FILES) {
      const source = readCode(file);
      expect(source, `${file} exposes coordinates`).not.toContain("latitude}");
      expect(source, `${file} exposes coordinates`).not.toContain("longitude}");
      expect(source, `${file} mentions donors as results`).not.toContain("donorId");
      expect(source, `${file} mentions donors as results`).not.toContain("donorPhone");
    }
    // The searcher's own coordinates are no longer printed to the screen.
    expect(code).not.toContain("location.latitude.toFixed");
  });

  it("keeps the organization phone behind the existing expand-only control", () => {
    expect(form).toContain("Show contact");
    expect(form).toContain("Hide contact");
    expect(form).toContain("aria-expanded={expanded}");
    expect(form).toContain("aria-controls={contactId}");
    // Phone renders only inside the expanded branch.
    expect(form).toMatch(/expanded && \([\s\S]*item\.phone[\s\S]*\)/);
  });

  it("shows no unit counts and no raw enum names", () => {
    expect(code).not.toContain("units_available");
    expect(code).not.toContain("unitsAvailable");
    expect(code).not.toContain(">POSSIBLE<");
    expect(code).not.toContain("{item.organizationType}<");
    expect(form).toContain("Possible availability");
    expect(form).toContain('item.organizationType === "HOSPITAL" ? "Hospital" : "Blood bank"');
  });

  it("keeps the indicative-availability disclaimer", () => {
    expect(form).toContain("does not reserve or guarantee");
    expect(read(PAGE)).toContain("not donor matching");
  });

  it("does not weaken the service-side privacy whitelist", () => {
    const service = read(SERVICE);
    expect(service).toContain("toSafeResult");
    expect(service).toContain('availability: "POSSIBLE"');
    expect(service).toContain("slice(0, 25)");
    expect(service).toContain("createAdminClient");
  });
});

describe("Phase 11C — Find Blood states", () => {
  const form = read(FORM);

  it("has a loading state built on the existing Skeleton primitive", () => {
    expect(form).toContain('from "@/components/ui/Skeleton"');
    expect(form).toContain("{loading && <SkeletonPanel");
    expect(form).toContain("aria-busy={loading || undefined}");
    // Reduced motion is handled globally for animate-pulse.
    expect(read("src/app/globals.css")).toContain("prefers-reduced-motion");
  });

  it("has an error state that shows only the mapped message and can retry", () => {
    expect(form).toContain('from "@/components/ui/ErrorState"');
    expect(form).toContain("<ErrorState");
    expect(form).toContain("message={error}");
    expect(form).toContain("onRetry={() => void runSearch()}");
    expect(read(ACTIONS)).toContain("error.userMessage");
    const code = readCode(FORM);
    expect(code).not.toContain("error.message");
    expect(code).not.toContain("JSON.stringify");
    expect(code).not.toContain("stack");
  });

  it("distinguishes pre-search from no-results, without claiming none exist", () => {
    expect(form).toContain("<EmptyState");
    expect(form).toContain('title="Start a search"');
    expect(form).toContain('title="No blood found nearby"');
    expect(form).toContain("covers this search only");
    expect(form).toContain("try a wider radius");
    const code = readCode(FORM);
    expect(code).not.toContain("No blood exists");
    expect(code).not.toContain("no donors exist");
  });

  it("offers only existing next steps from the empty state", () => {
    expect(form).toContain('href="/request-blood"');
    for (const href of hrefsIn(FORM)) {
      expect(EXISTING_ROUTES, `form links unknown route ${href}`).toContain(href);
    }
  });

  it("announces outcome changes to screen readers exactly once", () => {
    expect(form).toContain('aria-live="polite"');
    expect(form).toContain("{liveMessage}");
    expect(form).toContain("loading || results === null");
    expect(form).toContain('label="Searching for blood availability…"');
  });

  it("blocks duplicate submission and preserves form values", () => {
    expect(form).toContain("if (loading) return;");
    expect(form).toContain("loading={loading}");
    expect(form).toContain('loadingLabel="Searching…"');
    // Search never navigates, so the filters survive.
    expect(readCode(FORM)).not.toContain("redirect(");
  });
});

describe("Phase 11C — Find Blood design system compliance", () => {
  it("uses the Phase 11B primitives, not a parallel system", () => {
    const form = read(FORM);
    for (const primitive of [
      "@/components/ui/Alert",
      "@/components/ui/Button",
      "@/components/ui/EmptyState",
      "@/components/ui/ErrorState",
      "@/components/ui/FormField",
      "@/components/ui/SectionHeader",
      "@/components/ui/Skeleton",
    ]) {
      expect(form, `missing ${primitive}`).toContain(primitive);
    }
    expect(read(PAGE)).toContain("@/components/ui/PageHeader");
    expect(readCode(FORM)).not.toContain("inputClassName");
  });

  it("keeps the normal search action off emergency red", () => {
    for (const file of UI_FILES) {
      const code = readCode(file);
      expect(code, `${file} uses emergency styling`).not.toContain("emergency-surface");
      expect(code, `${file} uses emergency styling`).not.toContain("bg-emergency");
      expect(code, `${file} uses emergency styling`).not.toContain("border-emergency");
      expect(code, `${file} uses emergency styling`).not.toContain("accent-emergency");
      expect(code, `${file} uses emergency styling`).not.toContain("text-emergency");
      expect(code, `${file} uses the emergency button`).not.toContain('variant="emergency"');
    }
    expect(read(FORM)).toContain("Search blood");
  });

  it("uses only semantic tokens and the type scale", () => {
    const legacy = [
      "text-gray-",
      "border-gray-",
      "bg-gray-",
      "text-red-",
      "text-green-",
      "border-amber-",
      "bg-amber-",
      "bg-white",
      "rounded-xl",
      "text-sm",
      "text-xs",
      "text-base",
    ];
    for (const file of UI_FILES) {
      const code = readCode(file);
      for (const cls of legacy) {
        expect(code, `${file} still uses ${cls}`).not.toContain(cls);
      }
      expect(code, `${file} uses an off-scale size`).not.toMatch(/text-\[/);
    }
  });

  it("avoids gradients, glass and decorative elevation", () => {
    for (const file of UI_FILES) {
      const code = readCode(file);
      expect(code, `${file} uses a gradient`).not.toContain("gradient");
      expect(code, `${file} uses glass`).not.toContain("backdrop-blur");
      expect(code, `${file} uses decorative elevation`).not.toContain("shadow-");
    }
  });

  it("uses inline SVG icons, never emoji", () => {
    const form = read(FORM);
    expect(form).toContain('from "@/components/ui/Icon"');
    for (const file of UI_FILES) {
      expect(read(file), `${file} uses emoji`).not.toMatch(
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
      );
    }
  });
});

describe("Phase 11C — Find Blood navigation and layout", () => {
  const page = read(PAGE);

  it("renders exactly one public header and no account bar", () => {
    expect(page.match(/<PublicHeader/g)).toHaveLength(1);
    expect(page.match(/<PublicFooter/g)).toHaveLength(1);
    expect(readCode(PAGE)).not.toContain("AuthNav");
    expect(readCode(PAGE)).not.toContain("PageShell");
    expect(read(AUTH_NAV)).toContain('"/find-blood"');
  });

  it("marks Find blood as the current destination", () => {
    expect(page).toContain('<PublicHeader currentPath="/find-blood" />');
    const header = read("src/components/nav/PublicHeader.tsx");
    expect(header).toContain('href: "/find-blood"');
    expect(header).toContain('aria-current={active ? "page" : undefined}');
  });

  it("renders the brand exactly once, through BrandLogo", () => {
    expect(readCode(PAGE)).not.toContain("BrandLogo");
    expect(readCode(FORM)).not.toContain("BrandLogo");
    expect(read("src/components/nav/PublicHeader.tsx")).toContain("<BrandLogo");
  });

  it("owns a semantic main with one h1 and a logical heading order", () => {
    expect(page).toContain("<main");
    expect(page).toContain('id="main-content"');
    expect(page).toContain("tabIndex={-1}");
    expect(page).toContain("<PageHeader");
    // PageHeader owns the only h1; results are h2 and cards h3.
    expect(readCode(PAGE)).not.toContain("<h1");
    expect(readCode(FORM)).not.toContain("<h1");
    expect(readCode(FORM)).not.toContain("<h2");
    expect(read(FORM)).toContain("<SectionHeader");
    expect(read(FORM)).toContain("<h3");
  });

  it("uses the real width scale, never the old phone column", () => {
    expect(page).toContain("max-w-shell");
    expect(page).toContain("wide:max-w-shell-wide");
    expect(readCode(PAGE)).not.toContain("max-w-lg");
    expect(readCode(FORM)).not.toContain("max-w-lg");
  });

  it("stacks on mobile and becomes a panel plus results grid on desktop", () => {
    const form = read(FORM);
    expect(form).toContain("flex flex-col gap-4 lg:grid lg:grid-cols-3");
    expect(form).toContain("lg:col-span-1");
    expect(form).toContain("lg:col-span-2");
    expect(form).toContain("grid gap-3 md:grid-cols-2");
    expect(page).toMatch(/px-4[^"]*sm:px-6/);
    // No fixed-width table for results.
    expect(readCode(FORM)).not.toContain("<table");
    expect(readCode(FORM)).not.toContain("min-w-[");
  });

  it("gives every search control a 44px target", () => {
    const form = read(FORM);
    // Chips and the Clear link set the floor directly; the location and
    // submit buttons inherit it from the Button primitive.
    expect((form.match(/min-h-control/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(read("src/components/ui/FormField.tsx")).toContain("min-h-control");
    expect(read("src/components/ui/Button.tsx")).toContain("min-h-control");
  });

  it("keeps blood-group selection accessible and keyboard operable", () => {
    const form = read(FORM);
    expect(form).toContain('type="radio"');
    expect(form).toContain('name="bloodGroup"');
    expect(form).toContain("<legend");
    expect(form).toContain("has-[:focus-visible]:ring-2");
    expect(form).toContain('aria-invalid={fieldErrors.bloodGroup ? true : undefined}');
    expect(form).toContain('id="blood-group-error"');
    expect(form).toContain('aria-describedby={fieldErrors.bloodGroup ? "blood-group-error" : undefined}');
  });

  it("explains why location is needed and associates its error", () => {
    const form = read(FORM);
    expect(form).toContain('id="location-help"');
    expect(form).toContain('id="location-error"');
    expect(form).toContain('"location-help location-error"');
    expect(form).toContain("stay on your device");
    expect(form).toContain('title="Location unavailable"');
  });

  it("never disables browser zoom", () => {
    const rootLayout = readCode("src/app/layout.tsx");
    expect(rootLayout).not.toContain("maximumScale");
    expect(rootLayout).not.toContain("userScalable");
  });
});

describe("Phase 11C — other surfaces untouched by Step 3", () => {
  it("leaves the landing page and auth screens as their steps shipped them", () => {
    const landing = read("src/app/page.tsx");
    expect(landing).toContain('<PublicHeader currentPath="/" />');
    expect(landing).toContain("I want to donate");
    expect(read("src/app/(auth)/layout.tsx")).toContain('id="main-content"');
    expect(read("src/components/forms/LoginForm.tsx")).toContain(
      "await loginAction(parsed.data, next)"
    );
  });

  it("leaves how-it-works on the previous presentation", () => {
    expect(read("src/app/(public)/how-it-works/page.tsx")).toContain("PageShell");
  });

  it("keeps the public search action and service exactly as they were", () => {
    const actions = read(ACTIONS);
    expect(actions).toContain("export async function searchPublicBloodAvailabilityAction");
    expect(actions).toContain("formatCoarseDistance(item.distanceKmRounded)");
    expect(actions).toContain("formatRelativeInventoryFreshness(item.inventoryUpdatedAt)");
    expect(read(SERVICE)).toContain('search(input)');
  });
});
