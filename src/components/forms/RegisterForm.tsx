"use client";

import { useState } from "react";
import { registerSchema } from "@/schemas/auth.schema";
import { registerAction } from "@/app/(auth)/actions";
import { ROLE_LABELS, SELF_ASSIGNABLE_ROLES, type SelfAssignableRole } from "@/lib/constants/roles";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { cn } from "@/lib/utils/cn";

/**
 * Registration form. Presentation only — the fields, `registerSchema`
 * validation, the `registerAction` server action, its redirect and its
 * anti-enumeration confirmation message are unchanged from Phase 10.
 *
 * Role options come from SELF_ASSIGNABLE_ROLES, so ADMIN stays unselectable
 * by construction rather than by a UI filter.
 */
const ROLE_DESCRIPTIONS: Record<SelfAssignableRole, string> = {
  REQUESTER: "Request blood for a patient.",
  DONOR: "Donate blood and respond to requests.",
  HOSPITAL: "Manage a hospital's requests and stock.",
  BLOOD_BANK: "Manage a blood bank's stock and requests.",
};

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [initialRole, setInitialRole] = useState<SelfAssignableRole>("REQUESTER");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guards a second submit from an Enter keypress while the action is in flight.
    if (loading) return;
    setError(null);
    setInfo(null);

    const parsed = registerSchema.safeParse({
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      initialRole,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        fullName: flattened.fullName?.[0] ?? "",
        email: flattened.email?.[0] ?? "",
        phone: flattened.phone?.[0] ?? "",
        password: flattened.password?.[0] ?? "",
        confirmPassword: flattened.confirmPassword?.[0] ?? "",
        initialRole: flattened.initialRole?.[0] ?? "",
      });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    const result = await registerAction(parsed.data);
    setLoading(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
    } else if (result && "needsEmailConfirmation" in result) {
      setInfo("Check your email to confirm your account, then log in.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {error && (
        <Alert variant="danger" title="Could not create account">
          {error}
        </Alert>
      )}
      {info && (
        <Alert variant="info" title="Confirm your email">
          {info}
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-h3 text-text">Your details</h2>

        <FormField label="Full name" error={fieldErrors.fullName || null}>
          {({ id, describedBy, invalid, className }) => (
            <input
              id={id}
              type="text"
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={className}
              required
            />
          )}
        </FormField>

        <FormField label="Email" error={fieldErrors.email || null}>
          {({ id, describedBy, invalid, className }) => (
            <input
              id={id}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={className}
              required
            />
          )}
        </FormField>

        <FormField label="Phone" error={fieldErrors.phone || null}>
          {({ id, describedBy, invalid, className }) => (
            <input
              id={id}
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={className}
              required
            />
          )}
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-h3 text-text">I am a</legend>

        <div className="grid gap-2 sm:grid-cols-2">
          {SELF_ASSIGNABLE_ROLES.map((role) => {
            const selected = initialRole === role;
            return (
              <label
                key={role}
                className={cn(
                  "flex min-h-control cursor-pointer gap-2.5 rounded-md border p-3 transition-colors",
                  // Keyboard-only ring on the whole card; the radio's own
                  // outline is suppressed so focus is shown once, not twice.
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info has-[:focus-visible]:ring-offset-1",
                  selected
                    ? "border-primary bg-muted"
                    : "border-border-strong bg-surface hover:bg-muted"
                )}
              >
                <input
                  type="radio"
                  name="initialRole"
                  value={role}
                  checked={selected}
                  onChange={() => setInitialRole(role)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-body-strong text-text">{ROLE_LABELS[role]}</span>
                  <span className="text-caption text-text-secondary">
                    {ROLE_DESCRIPTIONS[role]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {fieldErrors.initialRole && (
          <p role="alert" className="text-caption text-danger">
            {fieldErrors.initialRole}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-4">
        <h2 className="text-h3 text-text">Password</h2>

        <FormField
          label="Password"
          helperText="At least 8 characters."
          error={fieldErrors.password || null}
        >
          {({ id, describedBy, invalid, className }) => (
            <input
              id={id}
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={className}
              required
            />
          )}
        </FormField>

        <FormField label="Confirm password" error={fieldErrors.confirmPassword || null}>
          {({ id, describedBy, invalid, className }) => (
            <input
              id={id}
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={className}
              required
            />
          )}
        </FormField>
      </div>

      <Button type="submit" fullWidth loading={loading} loadingLabel="Creating account…">
        Create account
      </Button>
    </form>
  );
}
