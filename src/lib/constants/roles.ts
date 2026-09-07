export const APP_ROLES = ["REQUESTER", "DONOR", "HOSPITAL", "BLOOD_BANK", "ADMIN"] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** Roles a person may pick at registration. ADMIN is never self-assigned. */
export const SELF_ASSIGNABLE_ROLES = ["REQUESTER", "DONOR", "HOSPITAL", "BLOOD_BANK"] as const;

export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  REQUESTER: "Requester",
  DONOR: "Donor",
  HOSPITAL: "Hospital",
  BLOOD_BANK: "Blood Bank",
  ADMIN: "Admin",
};

/** Default landing route for each role after login. */
export const ROLE_HOME_ROUTE: Record<AppRole, string> = {
  REQUESTER: "/requests",
  DONOR: "/donor",
  HOSPITAL: "/hospital",
  BLOOD_BANK: "/blood-bank",
  ADMIN: "/admin",
};

const ROLE_PRIORITY: AppRole[] = ["ADMIN", "HOSPITAL", "BLOOD_BANK", "DONOR", "REQUESTER"];

export function isSelfAssignableRole(role: unknown): role is SelfAssignableRole {
  return (
    typeof role === "string" &&
    (SELF_ASSIGNABLE_ROLES as readonly string[]).includes(role)
  );
}

export function landingRouteForRoles(roles: AppRole[]): string {
  const primary = ROLE_PRIORITY.find((role) => roles.includes(role));
  return primary ? ROLE_HOME_ROUTE[primary] : "/";
}
