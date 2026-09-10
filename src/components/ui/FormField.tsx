"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared control styling. One input look for the whole app — this replaces
 * the three divergent `inputClassName` strings that were copied per form.
 */
export const fieldControlClassName =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-body text-text " +
  "min-h-control placeholder:text-text-tertiary " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 " +
  "disabled:bg-muted disabled:text-text-tertiary";

/** Applied by FormField when `error` is set, so invalid fields read as invalid. */
export const fieldControlErrorClassName = "border-danger focus-visible:ring-danger";

export interface FormFieldRenderProps {
  /** Wire to the control's `id`. */
  id: string;
  /** Wire to `aria-describedby` — covers helper text and error. */
  describedBy: string | undefined;
  /** Wire to `aria-invalid`. */
  invalid: boolean | undefined;
  /** Wire to `required`. */
  required: boolean | undefined;
  /** Token control classes, already including the error state. */
  className: string;
}

/**
 * Makes accessible form markup the default: generated id, real `htmlFor`
 * label association, helper/error text linked via aria-describedby, and
 * aria-invalid on failure. Errors are announced (role="alert").
 *
 * Children is a render prop so the control keeps full ownership of its own
 * type and props while the wiring is handled here. Apply the pieces
 * explicitly — they are named for intent, not for DOM attributes:
 *
 *   <FormField label="Email" error={errors.email}>
 *     {({ id, describedBy, invalid, className }) => (
 *       <input
 *         id={id}
 *         type="email"
 *         aria-describedby={describedBy}
 *         aria-invalid={invalid}
 *         className={className}
 *       />
 *     )}
 *   </FormField>
 */
export function FormField({
  label,
  helperText,
  error,
  required,
  hideLabel = false,
  className,
  children,
}: {
  label: string;
  helperText?: string;
  error?: string | null;
  required?: boolean;
  /** Visually hides the label but keeps it for screen readers. */
  hideLabel?: boolean;
  className?: string;
  children: (field: FormFieldRenderProps) => React.ReactNode;
}) {
  const generatedId = useId();
  const id = `field-${generatedId}`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  const describedBy =
    [helperText ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-label text-text",
          hideLabel && "sr-only"
        )}
      >
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>

      {children({
        id,
        describedBy,
        invalid: error ? true : undefined,
        required: required || undefined,
        className: cn(fieldControlClassName, error && fieldControlErrorClassName),
      })}

      {helperText && (
        <p id={helperId} className="text-caption text-text-tertiary">
          {helperText}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
