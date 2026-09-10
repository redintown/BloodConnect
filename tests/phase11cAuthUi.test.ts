import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { SELF_ASSIGNABLE_ROLES } from "@/lib/constants/roles";
import { loginSchema, registerSchema } from "@/schemas/auth.schema";

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

const LAYOUT = "src/app/(auth)/layout.tsx";
const LOGIN_PAGE = "src/app/(auth)/login/page.tsx";
const REGISTER_PAGE = "src/app/(auth)/register/page.tsx";
const LOGIN_FORM = "src/components/forms/LoginForm.tsx";
const REGISTER_FORM = "src/components/forms/RegisterForm.tsx";
const AUTH_NAV = "src/components/ui/AuthNav.tsx";
const AUTH_ACTIONS = "src/app/(auth)/actions.ts";

const AUTH_UI_FILES = [LAYOUT, LOGIN_PAGE, REGISTER_PAGE, LOGIN_FORM, REGISTER_FORM];

describe("Phase 11C — auth layout composition", () => {
  const layout = read(LAYOUT);
  const code = readCode(LAYOUT);

  it("owns the main landmark that SkipToContent targets", () => {
    expect(layout).toContain("<main");
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain("tabIndex={-1}");
    expect(read("src/components/ui/SkipToContent.tsx")).toContain("#main-content");
  });

  it("renders the brand through BrandLogo exactly once, with no inline SVG", () => {
    expect(layout).toContain('from "@/components/brand/BrandLogo"');
    expect(code.match(/<BrandLogo/g)).toHaveLength(1);
    expect(code).not.toContain("<svg");
    expect(code).not.toContain("bloodconnect-logo.svg");
  });

  it("centers a comfortable-width column instead of a phone-width app", () => {
    expect(layout).toContain("min-h-dvh");
    expect(layout).toContain("mx-auto");
    expect(layout).toContain("max-w-md");
    expect(code).not.toContain("max-w-lg");
  });

  it("stays calm: canvas + bordered surface, no gradient, glass or shadow", () => {
    expect(layout).toContain("bg-canvas");
    expect(layout).toContain("border-border");
    expect(layout).toContain("bg-surface");
    expect(code).not.toContain("gradient");
    expect(code).not.toContain("backdrop-blur");
    expect(code).not.toContain("shadow-");
  });

  it("does not re-render the global account bar", () => {
    expect(code).not.toContain("AuthNav");
  });
});

describe("Phase 11C — auth pages", () => {
  it("each page has a single h1 and delegates the landmark to the layout", () => {
    for (const page of [LOGIN_PAGE, REGISTER_PAGE]) {
      const source = read(page);
      expect(source.match(/<h1/g)).toHaveLength(1);
      expect(readCode(page)).not.toContain("<main");
      expect(readCode(page)).not.toContain("PageShell");
    }
  });

  it("keeps the login redirect + next handling unchanged", () => {
    const page = read(LOGIN_PAGE);
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain("await getCurrentUser()");
    expect(page).toContain("await getCurrentUserRoles()");
    expect(page).toContain("getSafeRedirectPath(searchParams.next, landingRouteForRoles(roles))");
    expect(page).toContain("<LoginForm next={searchParams.next} />");
  });

  it("keeps the register redirect unchanged", () => {
    const page = read(REGISTER_PAGE);
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain("await getCurrentUser()");
    expect(page).toContain("redirect(landingRouteForRoles(roles))");
    expect(page).toContain("<RegisterForm />");
  });

  it("cross-links the two auth routes", () => {
    expect(read(LOGIN_PAGE)).toContain('href="/register"');
    expect(read(REGISTER_PAGE)).toContain('href="/login"');
  });
});

describe("Phase 11C — auth UI uses shared primitives and tokens", () => {
  it("builds both forms from the Phase 11B primitives", () => {
    for (const form of [LOGIN_FORM, REGISTER_FORM]) {
      const source = read(form);
      expect(source).toContain('from "@/components/ui/FormField"');
      expect(source).toContain('from "@/components/ui/Button"');
      expect(source).toContain('from "@/components/ui/Alert"');
      expect(source).toContain("<FormField");
      expect(source).toContain("<Button");
      expect(source).toContain("<Alert");
    }
  });

  it("drops the per-form input styling that diverged before Phase 11", () => {
    for (const form of [LOGIN_FORM, REGISTER_FORM]) {
      expect(readCode(form)).not.toContain("inputClassName");
    }
  });

  it("does not define duplicate primitives", () => {
    for (const file of AUTH_UI_FILES) {
      const code = readCode(file);
      expect(code).not.toMatch(/function (Button|FormField|Alert|BrandLogo|Skeleton)\s*\(/);
    }
  });

  it("uses only semantic tokens — no legacy palette classes", () => {
    const legacy = [
      "text-red-600",
      "border-gray-300",
      "text-gray-700",
      "text-gray-600",
      "bg-white",
      "text-black",
    ];
    for (const file of AUTH_UI_FILES) {
      const code = readCode(file);
      for (const cls of legacy) {
        expect(code, `${file} still uses ${cls}`).not.toContain(cls);
      }
    }
  });

  it("keeps the sign-in path off emergency red (primary = ink)", () => {
    for (const file of AUTH_UI_FILES) {
      const code = readCode(file);
      expect(code, `${file} uses emergency styling`).not.toContain("bg-emergency");
      expect(code, `${file} uses emergency styling`).not.toContain("ring-emergency");
      expect(code, `${file} uses emergency styling`).not.toContain("border-emergency");
      expect(code, `${file} uses emergency styling`).not.toContain("accent-emergency");
      expect(code, `${file} uses the emergency button`).not.toContain('variant="emergency"');
    }
  });
});

describe("Phase 11C — login form behaviour preserved", () => {
  const form = read(LOGIN_FORM);

  it("still validates with loginSchema and calls loginAction with next", () => {
    expect(form).toContain('from "@/schemas/auth.schema"');
    expect(form).toContain("loginSchema.safeParse({ email, password })");
    expect(form).toContain("await loginAction(parsed.data, next)");
    expect(form).toContain("if (result?.error) setError(result.error)");
  });

  it("submits on Enter via a real form submit handler", () => {
    expect(form).toContain("<form onSubmit={onSubmit}");
    expect(form).toContain("event.preventDefault()");
    expect(form).toContain('type="submit"');
  });

  it("indicates loading and blocks double submission", () => {
    expect(form).toContain("loading={loading}");
    expect(form).toContain('loadingLabel="Signing in…"');
    expect(form).toContain("if (loading) return;");
  });

  it("keeps password-manager friendly autocomplete", () => {
    expect(form).toContain('autoComplete="email"');
    expect(form).toContain('autoComplete="current-password"');
    expect(form).toContain('type="password"');
  });

  it("associates field errors and marks invalid fields", () => {
    expect(form).toContain("aria-invalid={invalid}");
    expect(form).toContain("aria-describedby={describedBy}");
    expect(form.match(/aria-invalid=\{invalid\}/g)).toHaveLength(2);
  });

  it("shows the mapped server message in a structured Alert", () => {
    expect(form).toContain('<Alert variant="danger"');
    expect(form).toContain("{error}");
  });
});

describe("Phase 11C — register form behaviour preserved", () => {
  const form = read(REGISTER_FORM);

  it("still validates with registerSchema over the same fields", () => {
    expect(form).toContain("registerSchema.safeParse({");
    for (const field of [
      "fullName",
      "email",
      "phone",
      "password",
      "confirmPassword",
      "initialRole",
    ]) {
      expect(form, `missing ${field}`).toContain(field);
    }
    expect(form).toContain("await registerAction(parsed.data)");
  });

  it("adds no fields beyond the existing schema", () => {
    const schemaKeys = Object.keys(registerSchema._def.schema.shape).sort();
    expect(schemaKeys).toEqual([
      "confirmPassword",
      "email",
      "fullName",
      "initialRole",
      "password",
      "phone",
    ]);
    expect(Object.keys(loginSchema.shape).sort()).toEqual(["email", "password"]);
    // One control per schema field (role uses a radio group).
    expect(form.match(/<FormField/g)).toHaveLength(5);
    expect(form.match(/type="radio"/g)).toHaveLength(1);
  });

  it("keeps role selection driven by SELF_ASSIGNABLE_ROLES, never ADMIN", () => {
    expect(form).toContain("SELF_ASSIGNABLE_ROLES.map");
    expect(form).toContain('name="initialRole"');
    expect(form).toContain("ROLE_LABELS[role]");
    expect(readCode(REGISTER_FORM)).not.toContain("ADMIN");
    expect(SELF_ASSIGNABLE_ROLES).not.toContain("ADMIN");
  });

  it("describes every selectable role", () => {
    for (const role of SELF_ASSIGNABLE_ROLES) {
      expect(form, `missing description for ${role}`).toContain(`${role}:`);
    }
  });

  it("keeps the duplicate-email anti-enumeration confirmation UX", () => {
    expect(form).toContain('"needsEmailConfirmation" in result');
    expect(form).toContain("Check your email to confirm your account, then log in.");
    const actions = read(AUTH_ACTIONS);
    expect(actions).toContain('error.code === "CONFLICT"');
    expect(actions).toContain("needsEmailConfirmation: true");
  });

  it("keeps rate-limit and other mapped errors on the same surface", () => {
    expect(form).toContain('if (result && "error" in result && result.error)');
    expect(form).toContain("setError(result.error)");
    expect(form).toContain('<Alert variant="danger"');
    expect(read(AUTH_ACTIONS)).toContain("error.userMessage");
  });

  it("indicates loading and blocks double submission", () => {
    expect(form).toContain("loading={loading}");
    expect(form).toContain('loadingLabel="Creating account…"');
    expect(form).toContain("if (loading) return;");
  });

  it("keeps new-password autocomplete on both password fields", () => {
    expect(form.match(/autoComplete="new-password"/g)).toHaveLength(2);
    expect(form).toContain('autoComplete="name"');
    expect(form).toContain('autoComplete="tel"');
    expect(form).toContain('autoComplete="email"');
  });
});

describe("Phase 11C — auth screens never leak server internals", () => {
  it("renders only mapped messages, never raw errors or identifiers", () => {
    for (const file of AUTH_UI_FILES) {
      const code = readCode(file);
      expect(code, `${file} stringifies an error`).not.toContain("JSON.stringify");
      expect(code, `${file} renders a raw error`).not.toContain("error.message");
      expect(code, `${file} touches supabase directly`).not.toContain("supabase");
      expect(code, `${file} renders an id`).not.toMatch(/\{\s*\w*(uuid|Uuid|userId|user\.id)/);
    }
  });

  it("keeps the server-side error mapping as the only message source", () => {
    const actions = read(AUTH_ACTIONS);
    expect(actions).toContain("if (error instanceof AppError) return { error: error.userMessage }");
    expect(actions).toContain('return { error: "Something went wrong" }');
  });
});

describe("Phase 11C — responsive + touch targets", () => {
  it("gives auth inputs and submits a 44px floor", () => {
    expect(read("src/components/ui/FormField.tsx")).toContain("min-h-control");
    expect(read("src/components/ui/Button.tsx")).toContain("min-h-control");
    expect(read(REGISTER_FORM)).toContain("min-h-control");
  });

  it("makes submits full width so mobile fields are not cramped", () => {
    for (const form of [LOGIN_FORM, REGISTER_FORM]) {
      expect(read(form)).toContain("fullWidth");
    }
  });

  it("stacks the role grid before splitting it at sm", () => {
    const form = read(REGISTER_FORM);
    expect(form).toContain("grid gap-2 sm:grid-cols-2");
    expect(readCode(REGISTER_FORM)).not.toContain('"grid grid-cols-2');
  });

  it("scales auth padding up rather than down", () => {
    const layout = read(LAYOUT);
    expect(layout).toContain("px-4");
    expect(layout).toMatch(/p-5 sm:p-6/);
  });

  it("never disables browser zoom", () => {
    const rootLayout = readCode("src/app/layout.tsx");
    expect(rootLayout).not.toContain("maximumScale");
    expect(rootLayout).not.toContain("userScalable");
  });
});

describe("Phase 11C — auth navigation", () => {
  const nav = read(AUTH_NAV);

  it("hides the global bar on auth routes so branding is not duplicated", () => {
    expect(nav).toContain("usePathname");
    expect(nav).toContain('"/login"');
    expect(nav).toContain('"/register"');
    expect(nav).toContain("return null");
  });

  it("still renders the brand through BrandLogo elsewhere", () => {
    expect(nav).toContain("<BrandLogo");
    expect(readCode(AUTH_NAV)).not.toContain("<svg");
  });

  it("keeps one accessible brand name and a named account landmark", () => {
    expect(nav).toContain('aria-label="Account"');
    expect(readCode(AUTH_NAV)).not.toMatch(/aria-label="BloodConnect"/);
  });

  it("gives account controls a 44px target", () => {
    const targets = nav.match(/min-h-control/g) ?? [];
    expect(targets.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps logout a server-action form submit", () => {
    expect(nav).toContain("<form action={logoutAction}>");
    expect(nav).toContain('type="submit"');
  });
});

describe("Phase 11C — no invented authentication features", () => {
  it("adds no password reset, OAuth or magic-link UI", () => {
    for (const file of AUTH_UI_FILES) {
      const code = readCode(file).toLowerCase();
      expect(code, `${file} invents reset`).not.toContain("forgot password");
      expect(code, `${file} invents reset`).not.toContain("reset-password");
      expect(code, `${file} invents oauth`).not.toContain("signinwith");
      expect(code, `${file} invents magic link`).not.toContain("magic link");
      expect(code, `${file} invents remember me`).not.toContain("remember me");
    }
  });

  it("leaves the auth server actions untouched", () => {
    const actions = read(AUTH_ACTIONS);
    expect(actions).toContain("export async function loginAction");
    expect(actions).toContain("export async function registerAction");
    expect(actions).toContain("export async function logoutAction");
    expect(actions).not.toContain("register-diag");
  });
});
