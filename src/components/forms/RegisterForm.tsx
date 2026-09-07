"use client";

import { useState } from "react";
import { registerSchema } from "@/schemas/auth.schema";
import { registerAction } from "@/app/(auth)/actions";
import { ROLE_LABELS, SELF_ASSIGNABLE_ROLES, type SelfAssignableRole } from "@/lib/constants/roles";

const inputClassName =
  "w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-emergency focus:ring-1 focus:ring-emergency";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Name
        <input
          type="text"
          name="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className={inputClassName}
          required
        />
        {fieldErrors.fullName && (
          <span className="font-normal text-red-600">{fieldErrors.fullName}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClassName}
          required
        />
        {fieldErrors.email && <span className="font-normal text-red-600">{fieldErrors.email}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Phone
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className={inputClassName}
          required
        />
        {fieldErrors.phone && <span className="font-normal text-red-600">{fieldErrors.phone}</span>}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">I am a</legend>
        <div className="grid grid-cols-2 gap-2">
          {SELF_ASSIGNABLE_ROLES.map((role) => (
            <label
              key={role}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${
                initialRole === role ? "border-emergency bg-emergency/5" : "border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="initialRole"
                value={role}
                checked={initialRole === role}
                onChange={() => setInitialRole(role)}
                className="accent-emergency"
              />
              {ROLE_LABELS[role]}
            </label>
          ))}
        </div>
        {fieldErrors.initialRole && (
          <span className="text-sm text-red-600">{fieldErrors.initialRole}</span>
        )}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClassName}
          required
        />
        {fieldErrors.password && (
          <span className="font-normal text-red-600">{fieldErrors.password}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Confirm password
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className={inputClassName}
          required
        />
        {fieldErrors.confirmPassword && (
          <span className="font-normal text-red-600">{fieldErrors.confirmPassword}</span>
        )}
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {info && <p className="text-sm text-gray-600">{info}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-emergency px-6 py-3 font-semibold text-white hover:bg-emergency-hover disabled:opacity-60"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
