"use client";

import { useState, type ComponentProps, type FocusEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL = cn(
  "block w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-muted/70",
  "focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/30",
  "disabled:bg-subtle disabled:text-muted",
);

function controlClass(invalid: boolean | undefined, className?: string) {
  return cn(CONTROL, invalid ? "border-danger" : "border-line hover:border-line-strong", className);
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint or error message (the error replaces the hint). */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface ControlProps {
  invalid?: boolean;
}

function describedBy(id: string | undefined, invalid: boolean | undefined) {
  return id && invalid ? `${id}-error` : undefined;
}

/** `2026-11-05` → `05.11.2026` (TZ §12: dates are DD.MM.YYYY everywhere). */
function isoToDisplay(value: unknown): string {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

/**
 * Native date picker (phone pickers, keyboard entry) that always READS as DD.MM.YYYY: while the field is not
 * focused the locale text of the browser (e.g. MM/DD/YYYY in an English Telegram WebView) is hidden under a
 * DD.MM.YYYY overlay; on focus the native editor is shown. The value stays ISO (YYYY-MM-DD) for the API.
 */
function DateInput({ invalid, className, id, onFocus, onBlur, ...props }: ComponentProps<"input"> & ControlProps) {
  const [focused, setFocused] = useState(false);
  const shown = isoToDisplay(props.value ?? props.defaultValue);
  return (
    <span className="relative block w-full min-w-0">
      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(id, invalid)}
        className={controlClass(invalid, cn("h-10", !focused && "text-transparent", className))}
        onFocus={(event: FocusEvent<HTMLInputElement>) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event: FocusEvent<HTMLInputElement>) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...props}
        type="date"
      />
      {!focused && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-sm tabular-nums",
            shown ? (props.disabled ? "text-muted" : "text-ink") : "text-muted/70",
          )}
        >
          {shown || "kk.oo.yyyy"}
        </span>
      )}
    </span>
  );
}

export function Input({ invalid, className, id, ...props }: ComponentProps<"input"> & ControlProps) {
  if (props.type === "date") return <DateInput invalid={invalid} className={className} id={id} {...props} />;
  return (
    <input
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(id, invalid)}
      className={controlClass(invalid, cn("h-10", className))}
      {...props}
    />
  );
}

export function Select({ invalid, className, id, children, ...props }: ComponentProps<"select"> & ControlProps) {
  return (
    <select
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(id, invalid)}
      className={controlClass(invalid, cn("h-10 pr-8", className))}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ invalid, className, id, ...props }: ComponentProps<"textarea"> & ControlProps) {
  return (
    <textarea
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy(id, invalid)}
      className={controlClass(invalid, cn("min-h-20 py-2", className))}
      {...props}
    />
  );
}
