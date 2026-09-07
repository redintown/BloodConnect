import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/AppError";
import {
  assertAuthenticated,
  ensureHasAnyRole,
  ensureHasRole,
  hasAnyRole,
  hasRole,
} from "@/lib/auth/authorization";
import { mapAuthError } from "@/lib/auth/mapAuthError";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import {
  isSelfAssignableRole,
  landingRouteForRoles,
  SELF_ASSIGNABLE_ROLES,
} from "@/lib/constants/roles";
import { registerSchema } from "@/schemas/auth.schema";

describe("auth validation", () => {
  const valid = {
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: "+8801700000000",
    password: "password123",
    confirmPassword: "password123",
    initialRole: "REQUESTER",
  };

  it("requires an initial role", () => {
    const { initialRole: _, ...withoutRole } = valid;
    expect(registerSchema.safeParse(withoutRole).success).toBe(false);
  });

  it("rejects ADMIN as an initial role", () => {
    const result = registerSchema.safeParse({ ...valid, initialRole: "ADMIN" });
    expect(result.success).toBe(false);
  });

  it("accepts each self-assignable role", () => {
    for (const initialRole of SELF_ASSIGNABLE_ROLES) {
      expect(registerSchema.safeParse({ ...valid, initialRole }).success).toBe(true);
    }
  });
});

describe("role checks", () => {
  it("never treats ADMIN as self-assignable", () => {
    expect(isSelfAssignableRole("ADMIN")).toBe(false);
    expect(SELF_ASSIGNABLE_ROLES).not.toContain("ADMIN");
  });

  it("hasRole / hasAnyRole match membership", () => {
    expect(hasRole(["DONOR", "REQUESTER"], "DONOR")).toBe(true);
    expect(hasRole(["DONOR"], "ADMIN")).toBe(false);
    expect(hasAnyRole(["DONOR"], ["HOSPITAL", "DONOR"])).toBe(true);
    expect(hasAnyRole(["REQUESTER"], ["ADMIN"])).toBe(false);
  });

  it("ensureHasRole throws unauthorized when missing", () => {
    expect(() => ensureHasRole(["DONOR"], "ADMIN")).toThrow(AppError);
    try {
      ensureHasRole(["DONOR"], "ADMIN");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("AUTHORIZATION_ERROR");
      expect((error as AppError).userMessage).toBe("Unauthorized");
    }
  });

  it("ensureHasAnyRole requires at least one listed role", () => {
    expect(() => ensureHasAnyRole(["REQUESTER"], ["DONOR", "HOSPITAL"])).toThrow(AppError);
    expect(() => ensureHasAnyRole(["DONOR"], ["DONOR", "HOSPITAL"])).not.toThrow();
    expect(() => ensureHasAnyRole(["DONOR"], [])).toThrow(AppError);
  });

  it("landingRouteForRoles prefers the highest-privilege match", () => {
    expect(landingRouteForRoles(["REQUESTER", "ADMIN"])).toBe("/admin");
    expect(landingRouteForRoles(["DONOR"])).toBe("/donor");
    expect(landingRouteForRoles([])).toBe("/");
  });
});

describe("authorization helpers", () => {
  it("assertAuthenticated throws when there is no user", () => {
    expect(() => assertAuthenticated(null)).toThrow(AppError);
    expect(assertAuthenticated({ id: "u1" })).toEqual({ id: "u1" });
  });
});

describe("profile / role assignment rules", () => {
  it("only allowlisted roles can be chosen at registration", () => {
    expect(isSelfAssignableRole("REQUESTER")).toBe(true);
    expect(isSelfAssignableRole("DONOR")).toBe(true);
    expect(isSelfAssignableRole("HOSPITAL")).toBe(true);
    expect(isSelfAssignableRole("BLOOD_BANK")).toBe(true);
    expect(isSelfAssignableRole("ADMIN")).toBe(false);
    expect(isSelfAssignableRole("superuser")).toBe(false);
  });
});

describe("mapAuthError", () => {
  it("maps credential failures without leaking internals", () => {
    const err = mapAuthError({ message: "Invalid login credentials", code: "invalid_credentials" });
    expect(err.userMessage).toBe("Invalid credentials");
    expect(err.userMessage).not.toContain("Invalid login credentials");
  });

  it("maps duplicate email", () => {
    expect(mapAuthError({ message: "User already registered" }).userMessage).toBe(
      "Email already registered"
    );
  });

  it("maps session expiry and unknown failures", () => {
    expect(mapAuthError({ message: "session expired" }).userMessage).toBe("Session expired");
    expect(mapAuthError({ message: "invalid jwt" }).userMessage).toBe("Session expired");
    const unknown = mapAuthError(new Error("raw SQL: relation does not exist"));
    expect(unknown.userMessage).toBe("Something went wrong. Please try again.");
    expect(unknown.userMessage).not.toContain("SQL");
  });
});

describe("getSafeRedirectPath", () => {
  it("allows relative paths and rejects open redirects", () => {
    expect(getSafeRedirectPath("/donor", "/")).toBe("/donor");
    expect(getSafeRedirectPath("https://evil.example", "/")).toBe("/");
    expect(getSafeRedirectPath("//evil.example", "/")).toBe("/");
    expect(getSafeRedirectPath("\\evil", "/")).toBe("/");
    expect(getSafeRedirectPath(undefined, "/requests")).toBe("/requests");
  });
});
