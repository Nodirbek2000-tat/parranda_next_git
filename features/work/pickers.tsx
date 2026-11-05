"use client";

import { useState } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import type { HouseholdRef } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { ROLE_LABELS } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/use-api";
import type { Household, Paginated, Role, User } from "@/lib/types";
import { IconButton } from "@/components/ui/button";

const RESULTS = 8;

interface PickerProps<T> {
  id: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  value: T | null;
  onChange: (value: T | null) => void;
  placeholder: string;
  label: (item: T) => string;
  sublabel?: (item: T) => string;
  itemKey: (item: T) => number;
  invalid?: boolean;
  disabled?: boolean;
  /** Fixed value (no clearing / searching). */
  locked?: boolean;
}

/**
 * Search-as-you-type picker over a paginated list endpoint (`?search=&page_size=8`): fits phones
 * better than a select with hundreds of rows.
 */
export function SearchPicker<T>({
  id,
  path,
  query,
  value,
  onChange,
  placeholder,
  label,
  sublabel,
  itemKey,
  invalid,
  disabled,
  locked,
}: PickerProps<T>) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(search.trim(), 300);
  const results = useApi<Paginated<T>>(open && !value ? path : null, { ...query, search: debounced, page_size: RESULTS });

  if (value) {
    return (
      <div
        className={cn(
          "flex min-h-10 items-center gap-2 rounded-lg border bg-surface py-1 pl-3 pr-1 text-sm",
          invalid ? "border-danger" : "border-line",
          (disabled || locked) && "bg-subtle",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink">{label(value)}</span>
          {sublabel && <span className="block truncate text-xs text-muted">{sublabel(value)}</span>}
        </span>
        {!locked && (
          <IconButton
            label="Tanlovni bekor qilish"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setOpen(true);
            }}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        )}
      </div>
    );
  }

  const rows = results.data?.results ?? [];

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-5 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        disabled={disabled}
        value={search}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
        }}
        className={cn(
          "block h-10 w-full rounded-lg border bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted/70",
          "focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/30 disabled:bg-subtle",
          invalid ? "border-danger" : "border-line hover:border-line-strong",
        )}
      />
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-card"
        >
          {!results.data && !results.error ? (
            <li className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              Qidirilmoqda…
            </li>
          ) : results.error && !results.data ? (
            <li className="px-3 py-2 text-[13px] text-danger">{results.error.message}</li>
          ) : rows.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">Hech narsa topilmadi</li>
          ) : (
            rows.map((item) => (
              <li key={itemKey(item)} role="option" aria-selected={false}>
                <button
                  type="button"
                  // Keep the input focused until the choice is applied (blur would close the list first).
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(item);
                    setSearch("");
                    setOpen(false);
                  }}
                  className={cn("flex w-full flex-col px-3 py-2 text-left hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none", results.loading && "opacity-60")}
                >
                  <span className="truncate text-sm text-ink">{label(item)}</span>
                  {sublabel && <span className="truncate text-xs text-muted">{sublabel(item)}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function householdText(item: { code: string; name: string }): string {
  return `${item.code} — ${item.name}`;
}

/** Household search (`GET /api/households?search=`). */
export function HouseholdPicker(props: {
  id: string;
  value: HouseholdRef | null;
  onChange: (value: HouseholdRef | null) => void;
  invalid?: boolean;
  disabled?: boolean;
  locked?: boolean;
}) {
  return (
    <SearchPicker<HouseholdRef & Partial<Pick<Household, "district" | "owner">>>
      {...props}
      path="/households"
      placeholder="Xonadon kodi yoki nomi"
      label={householdText}
      sublabel={(item) => [item.owner?.full_name, item.district].filter(Boolean).join(" · ")}
      itemKey={(item) => item.id}
      onChange={(item) => props.onChange(item ? { id: item.id, code: item.code, name: item.name } : null)}
    />
  );
}

export type UserOption = Pick<User, "id" | "full_name"> & Partial<Pick<User, "role" | "username" | "role_display">>;

/** Staff search (`GET /api/users?search=&role=`, ADMIN). */
export function UserPicker({
  role,
  ...props
}: {
  id: string;
  role?: Role | "";
  value: UserOption | null;
  onChange: (value: UserOption | null) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <SearchPicker<UserOption>
      {...props}
      path="/users"
      query={{ role: role || undefined, is_active: true }}
      placeholder="Xodim ismi yoki logini"
      label={(item) => item.full_name}
      sublabel={(item) => [item.role ? ROLE_LABELS[item.role] : item.role_display, item.username].filter(Boolean).join(" · ")}
      itemKey={(item) => item.id}
    />
  );
}
