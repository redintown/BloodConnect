"use client";

import { useState } from "react";
import { loginSchema } from "@/schemas/auth.schema";
import { loginAction } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";

/**
 * Sign-in form. Presentation only — validation (loginSchema), the
 * `loginAction` server action, its redirect and its error mapping are
 * unchanged from Phase 10.
 *
 * The submit is `primary` (ink), not emergency red: emergency red is reserved
 * for emergency flows so it keeps meaning where it matters.
 */
export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guards a second submit from an Enter keypress while the action is in flight.
    if (loading) return;
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: flattened.email?.[0] ?? "",
        password: flattened.password?.[0] ?? "",
      });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    const result = await loginAction(parsed.data, next);
    setLoading(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error && (
        <Alert variant="danger" title="Could not sign in">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-4">
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

        <FormField label="Password" error={fieldErrors.password || null}>
          {({ id, describedBy, invalid, className }) => (
            <input
              id={id}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={className}
              required
            />
          )}
        </FormField>
      </div>

      <Button type="submit" fullWidth loading={loading} loadingLabel="Signing in…">
        Sign in
      </Button>
    </form>
  );
}
