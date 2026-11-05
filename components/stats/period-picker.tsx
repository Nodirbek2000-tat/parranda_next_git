"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { CalendarRange } from "lucide-react";
import type { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatRange, todayIso } from "@/lib/format";
import {
  activePreset,
  DEFAULT_PRESETS,
  MIN_PERIOD_DATE,
  presetRange,
  readPeriod,
  validateRange,
  type PeriodPreset,
  type PeriodQuery,
} from "@/lib/stats";
import type { StatsPeriod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/** Period from the URL (`?date_from=&date_to=`): shareable links, back button works. */
export function usePeriodQuery(): PeriodQuery {
  const params = useSearchParams();
  const from = params.get("date_from");
  const to = params.get("date_to");
  return useMemo(
    () => readPeriod({ get: (key) => (key === "date_from" ? from : key === "date_to" ? to : null) }),
    [from, to],
  );
}

/** Replace some query parameters of the current URL (others are kept). */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.toString();
  return useCallback(
    (changes: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      const search = next.toString();
      if (search === current) return;
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [current, pathname, router],
  );
}

interface PeriodPickerProps {
  presets?: readonly PeriodPreset[];
  /**
   * What "no parameters" means for this endpoint: the number of days of the
   * matching preset (30 for most stats) or a label of its own ("Butun davr").
   */
  defaultOption?: { days: number } | { label: string };
  /** Period the API actually used (shown as "06.10.2026 – 04.11.2026"). */
  period?: StatsPeriod;
  /** Last API error; 400 period messages are shown inline. */
  error?: ApiError | null;
  /**
   * Stick under the app header while the page scrolls, so every chart below keeps its period in view.
   * Put the picker directly in the page column (not inside PageHeader), or sticky has no room to work.
   */
  sticky?: boolean;
  className?: string;
}

const CUSTOM = -1;

/**
 * Segmented presets (7 / 30 / 90 kun / 1 yil) + "Boshqa" with two dates
 * (6.2). Validated with the same rules as the API before any request.
 */
export function PeriodPicker({
  presets = DEFAULT_PRESETS,
  defaultOption = { days: 30 },
  period,
  error,
  sticky = false,
  className,
}: PeriodPickerProps) {
  const query = usePeriodQuery();
  const setParams = useUrlParams();
  const today = todayIso();
  const matched = activePreset(query, presets, today);
  const defaultDays = "days" in defaultOption ? defaultOption.days : 0;
  const current = matched === 0 ? defaultDays : (matched ?? CUSTOM);
  const [customOpen, setCustomOpen] = useState(current === CUSTOM);
  const [from, setFrom] = useState(query.date_from ?? period?.date_from ?? "");
  const [to, setTo] = useState(query.date_to ?? period?.date_to ?? today);
  const [errors, setErrors] = useState<ReturnType<typeof validateRange>>({});

  const options: { key: number; label: string }[] = [
    ...("label" in defaultOption ? [{ key: 0, label: defaultOption.label }] : []),
    ...presets.map((preset) => ({ key: preset.days, label: preset.label })),
  ];

  const choose = (days: number) => {
    setCustomOpen(false);
    setErrors({});
    if (days === defaultDays) setParams({ date_from: null, date_to: null });
    else setParams(presetRange(days, today));
  };

  const openCustom = () => {
    setCustomOpen((open) => !open);
    setFrom(query.date_from ?? period?.date_from ?? "");
    setTo(query.date_to ?? period?.date_to ?? today);
    setErrors({});
  };

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateRange(from, to, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setParams({ date_from: from, date_to: to });
  };

  // API 400 for the period (e.g. a hand-edited URL) is shown next to the picker.
  const apiMessages =
    error?.status === 400
      ? [error.fields.date_from, error.fields.date_to, error.detail].filter((message): message is string =>
          Boolean(message),
        )
      : [];

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2",
        sticky &&
          "sticky top-[calc(3.5rem+var(--safe-top))] z-10 -mx-4 border-b border-line/70 bg-canvas/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-canvas/85 sm:-mx-6 sm:px-6 lg:top-16 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface p-0.5">
          <div role="radiogroup" aria-label="Davr" className="flex">
            {options.map((option) => {
              const selected = !customOpen && current === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(option.key)}
                  className={cn(
                    "h-8 shrink-0 whitespace-nowrap rounded-md px-2.5 text-[13px] transition-colors sm:px-3",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    selected ? "bg-primary font-medium text-white" : "text-muted hover:bg-subtle hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-pressed={customOpen || current === CUSTOM}
            aria-expanded={customOpen}
            onClick={openCustom}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] transition-colors sm:px-3",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              customOpen || current === CUSTOM
                ? "bg-primary font-medium text-white"
                : "text-muted hover:bg-subtle hover:text-ink",
            )}
          >
            <CalendarRange className="size-3.5" aria-hidden />
            Boshqa
          </button>
        </div>
        {period && (
          <span className="text-xs tabular-nums text-muted">
            {formatRange(period.date_from, period.date_to)} · {period.days} kun
          </span>
        )}
      </div>

      {customOpen && (
        <form
          noValidate
          onSubmit={apply}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3"
          aria-label="Ixtiyoriy davr"
        >
          <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs text-muted sm:flex-none">
            Sanadan
            <Input
              type="date"
              value={from}
              min={MIN_PERIOD_DATE}
              max={to || today}
              onChange={(event) => setFrom(event.target.value)}
              invalid={Boolean(errors.date_from)}
              className="h-9"
            />
          </label>
          <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs text-muted sm:flex-none">
            Sanagacha
            <Input
              type="date"
              value={to}
              min={from || MIN_PERIOD_DATE}
              max={today}
              onChange={(event) => setTo(event.target.value)}
              invalid={Boolean(errors.date_to)}
              className="h-9"
            />
          </label>
          <Button type="submit" size="sm" className="h-9">
            Qo‘llash
          </Button>
          {(errors.date_from || errors.date_to || errors.range) && (
            <p className="w-full text-[13px] text-danger" role="alert">
              {[errors.date_from, errors.date_to, errors.range].filter(Boolean).join(" ")}
            </p>
          )}
          <p className="w-full text-xs text-muted">Eng ko‘pi 366 kun.</p>
        </form>
      )}

      {apiMessages.length > 0 && (
        <p className="text-[13px] text-danger" role="alert">
          {apiMessages.join(" ")}
        </p>
      )}
    </div>
  );
}
