"use client";

import { useCallback, useId, useState, type ChangeEvent, type FormEvent } from "react";
import { toApiError, type FieldErrors } from "./api";
import { todayIso } from "./format";

type Values = Record<string, string>;

export interface FormController<V extends Values> {
  values: V;
  errors: FieldErrors;
  formError: string | null;
  pending: boolean;
  set: (name: keyof V & string, value: string) => void;
  /** Props for <Field>: htmlFor + error. */
  field: (name: keyof V & string) => { htmlFor: string; error: string | undefined };
  /** Props for <Input>/<Select>/<Textarea>. */
  control: (name: keyof V & string) => {
    id: string;
    name: string;
    value: string;
    invalid: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  };
  /**
   * Returns a submit handler: runs `validate`, then `action`. DRF field errors
   * are shown next to the fields, `detail` / non-field errors above the footer.
   */
  handleSubmit: <T>(
    validate: (values: V) => FieldErrors,
    action: (values: V) => Promise<T>,
    onSuccess: (result: T) => void,
  ) => (event: FormEvent<HTMLFormElement>) => void;
}

export function useForm<V extends Values>(initial: V): FormController<V> {
  const prefix = useId();
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = useCallback((name: keyof V & string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  const field = (name: keyof V & string) => ({ htmlFor: `${prefix}-${name}`, error: errors[name] });

  const control = (name: keyof V & string) => ({
    id: `${prefix}-${name}`,
    name,
    value: values[name],
    invalid: Boolean(errors[name]),
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      set(name, event.target.value),
  });

  const handleSubmit: FormController<V>["handleSubmit"] = (validate, action, onSuccess) => (event) => {
    event.preventDefault();
    if (pending) return;
    const clientErrors = validate(values);
    setFormError(null);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }
    setErrors({});
    setPending(true);
    action(values)
      .then((result) => {
        setPending(false);
        onSuccess(result);
      })
      .catch((caught: unknown) => {
        const error = toApiError(caught);
        setPending(false);
        // A server error can only be shown next to a field that is on screen (forms
        // hide preset fields, e.g. a fixed batch/household); the rest go above the footer.
        const visible = (key: string) => key in values && document.getElementById(`${prefix}-${key}`) !== null;
        const entries = Object.entries(error.fields);
        const known = Object.fromEntries(entries.filter(([key]) => visible(key)));
        setErrors(known);
        const unknownMessages = entries.filter(([key]) => !visible(key)).map(([, message]) => message);
        const general = [error.detail, ...unknownMessages].filter((message): message is string => Boolean(message));
        if (general.length > 0) setFormError(general.join(" "));
        else setFormError(Object.keys(known).length === 0 ? error.message : null);
      });
  };

  return { values, errors, formError, pending, set, field, control, handleSubmit };
}

/* ---------- Validators: return an Uzbek message or undefined ---------- */

export const REQUIRED = "Maydonni to‘ldiring";

export function required(value: string): string | undefined {
  return value.trim() ? undefined : REQUIRED;
}

function parse(value: string): number {
  return Number(value.replace(",", ".").replace(/\s/g, ""));
}

/** Parse a numeric input ("12,5" is accepted). Empty string -> undefined. */
export function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = parse(value);
  return Number.isFinite(number) ? number : undefined;
}

export function positiveInt(value: string): string | undefined {
  if (!value.trim()) return REQUIRED;
  const number = parse(value);
  if (!Number.isInteger(number)) return "Butun son kiriting";
  if (number <= 0) return "0 dan katta son kiriting";
  return undefined;
}

export function nonNegativeInt(value: string, optional = false): string | undefined {
  if (!value.trim()) return optional ? undefined : REQUIRED;
  const number = parse(value);
  if (!Number.isInteger(number)) return "Butun son kiriting";
  if (number < 0) return "Manfiy bo‘lishi mumkin emas";
  return undefined;
}

export function positiveNumber(value: string): string | undefined {
  if (!value.trim()) return REQUIRED;
  const number = parse(value);
  if (!Number.isFinite(number)) return "Son kiriting";
  if (number <= 0) return "0 dan katta son kiriting";
  return undefined;
}

export function nonNegativeNumber(value: string, optional = false): string | undefined {
  if (!value.trim()) return optional ? undefined : REQUIRED;
  const number = parse(value);
  if (!Number.isFinite(number)) return "Son kiriting";
  if (number < 0) return "Manfiy bo‘lishi mumkin emas";
  return undefined;
}

export function notFutureDate(value: string, optional = false): string | undefined {
  if (!value) return optional ? undefined : REQUIRED;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Sanani to‘g‘ri kiriting";
  if (value > todayIso()) return "Sana kelajakda bo‘lishi mumkin emas";
  return undefined;
}

export function coordinate(value: string, kind: "lat" | "lng"): string | undefined {
  if (!value.trim()) return undefined;
  const number = parse(value);
  const limit = kind === "lat" ? 90 : 180;
  if (!Number.isFinite(number) || Math.abs(number) > limit) {
    return kind === "lat" ? "Kenglik −90 va 90 oralig‘ida bo‘lsin" : "Uzunlik −180 va 180 oralig‘ida bo‘lsin";
  }
  return undefined;
}

/** Build an errors object from [field, message|undefined] pairs. */
export function collect(pairs: [string, string | undefined][]): FieldErrors {
  const result: FieldErrors = {};
  for (const [key, message] of pairs) if (message) result[key] = message;
  return result;
}
