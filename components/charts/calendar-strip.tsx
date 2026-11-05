"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { formatDate, WEEKDAY_SHORT, weekdayIndex } from "@/lib/format";

export type CalendarDayState = "reported" | "missing" | "pending" | "none";

export interface CalendarDay {
  date: string;
  state: CalendarDayState;
  /** Shown when the day is selected, e.g. "Tuxum: 410 dona · Yem: 55 kg". */
  detail?: string;
}

const MONTH_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

const STATE_LABEL: Record<CalendarDayState, string> = {
  reported: "Hisobot kiritilgan",
  missing: "Hisobot kiritilmagan",
  pending: "Bugun — kutilmoqda",
  none: "Hisobot kutilmagan",
};

const STATE_CLASS: Record<CalendarDayState, string> = {
  reported: "bg-accent text-white",
  missing: "bg-danger-soft text-danger ring-1 ring-inset ring-danger/30",
  // Today, due but not over yet: dashed outline, never the "missing" red.
  pending: "bg-surface text-ink outline-1 outline-dashed -outline-offset-1 outline-accent",
  none: "bg-ink/[0.04] text-muted",
};

/** Up to ~2 months: one numbered cell per day, weeks as rows. Longer: compact heatmap, weeks as columns. */
const FULL_GRID_MAX_DAYS = 62;
/** Compact cell size and gap (px). */
const CELL = 12;
const GAP = 3;

/**
 * One cell per day, Monday-first weeks (6.2 CalendarStrip).
 * State is shown by fill and by an outline on missing days (not hue alone), and every cell has a
 * text label; tapping a cell shows its date and numbers below the grid. Arrow keys move between days.
 * Periods longer than two months (90 kun, 1 yil) use a compact heatmap (weeks as columns, scrolls
 * sideways inside its own box on a phone) instead of a 53-row column of numbered cells.
 */
export function CalendarStrip({ days, caption }: { days: readonly CalendarDay[]; caption: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const compact = days.length > FULL_GRID_MAX_DAYS;
  const lastDate = days.at(-1)?.date;

  // The heatmap opens at the most recent weeks (the right end).
  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollLeft = box.scrollWidth;
  }, [compact, lastDate]);

  if (days.length === 0) return null;
  const lead = weekdayIndex(days[0].date);
  const current = days.find((day) => day.date === selected) ?? null;
  // Roving tab stop: the selected day, else the last day of the period.
  const selectedIndex = days.findIndex((day) => day.date === selected);
  const tabStop = focusIndex ?? (selectedIndex >= 0 ? selectedIndex : days.length - 1);
  const states = new Set(days.map((day) => day.state));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = compact
      ? { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
      : { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: number | null = null;
    if (event.key in steps) next = tabStop + steps[event.key];
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = days.length - 1;
    if (next === null) return;
    event.preventDefault();
    const clamped = Math.min(days.length - 1, Math.max(0, next));
    setFocusIndex(clamped);
    cellRefs.current[clamped]?.focus();
  };

  const cell = (day: CalendarDay, index: number) => (
    <button
      key={day.date}
      ref={(node) => {
        cellRefs.current[index] = node;
      }}
      type="button"
      tabIndex={index === tabStop ? 0 : -1}
      aria-label={`${formatDate(day.date)}: ${STATE_LABEL[day.state]}`}
      aria-pressed={selected === day.date}
      title={compact ? `${formatDate(day.date)}: ${STATE_LABEL[day.state]}` : undefined}
      onFocus={() => setFocusIndex(index)}
      onClick={() => setSelected((value) => (value === day.date ? null : day.date))}
      className={cn(
        "flex items-center justify-center tabular-nums transition-shadow",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
        compact ? "rounded-[3px]" : "aspect-square max-h-10 rounded-md text-[11px]",
        STATE_CLASS[day.state],
        selected === day.date && (compact ? "ring-2 ring-primary" : "ring-2 ring-primary ring-offset-1"),
      )}
      style={compact ? { width: CELL, height: CELL } : undefined}
    >
      {compact ? null : day.date.endsWith("-01") || index === 0 ? (
        <span className="leading-none">
          {Number(day.date.slice(8, 10))}
          <span className="block text-[9px] opacity-75">{MONTH_SHORT[Number(day.date.slice(5, 7)) - 1]}</span>
        </span>
      ) : (
        Number(day.date.slice(8, 10))
      )}
    </button>
  );

  let grid;
  if (compact) {
    const weeks = Math.ceil((lead + days.length) / 7);
    // Month label above the first week that contains the 1st of a month (and above the first week).
    const monthLabels: { column: number; label: string }[] = [];
    days.forEach((day, index) => {
      const column = Math.floor((lead + index) / 7);
      if (index === 0 || day.date.endsWith("-01")) {
        const label = MONTH_SHORT[Number(day.date.slice(5, 7)) - 1];
        const previous = monthLabels.at(-1);
        // Two labels in neighbouring columns would overlap: the later month wins.
        if (previous && column - previous.column < 3) monthLabels.pop();
        monthLabels.push({ column, label });
      }
    });
    const columns = `repeat(${weeks}, ${CELL}px)`;
    grid = (
      // Weekday labels stay put; only the weeks scroll (the box opens at the latest week).
      <div className="flex max-w-full gap-2">
        <div
          aria-hidden
          className="grid shrink-0 text-[9px] leading-none text-muted"
          style={{ gridTemplateRows: `${CELL}px repeat(7, ${CELL}px)`, rowGap: GAP }}
        >
          <span />
          {WEEKDAY_SHORT.map((label, index) => (
            <span key={label} className="flex items-center">
              {index % 2 === 0 ? label : ""}
            </span>
          ))}
        </div>
        <div ref={scrollRef} className="no-scrollbar min-w-0 overflow-x-auto pb-1">
          <div className="flex w-max flex-col" style={{ rowGap: GAP }}>
            <div aria-hidden className="relative text-[9px] leading-none text-muted" style={{ height: CELL }}>
              {monthLabels.map(({ column, label }) => (
                <span key={`${column}-${label}`} className="absolute bottom-0" style={{ left: column * (CELL + GAP) }}>
                  {label}
                </span>
              ))}
            </div>
            <div
              role="group"
              aria-label={caption}
              onKeyDown={onKeyDown}
              className="grid grid-flow-col"
              style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gridTemplateColumns: columns, gap: GAP }}
            >
              {Array.from({ length: lead }, (_, index) => (
                <span key={`lead-${index}`} aria-hidden />
              ))}
              {days.map(cell)}
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    grid = (
      <div className="grid max-w-md grid-cols-7 gap-1.5" role="group" aria-label={caption} onKeyDown={onKeyDown}>
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} aria-hidden className="pb-0.5 text-center text-[11px] font-medium text-muted">
            {label}
          </div>
        ))}
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} aria-hidden />
        ))}
        {days.map(cell)}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {grid}
      <p className="mt-3 min-h-5 text-[13px] text-ink" aria-live="polite">
        {current ? (
          <>
            <span className="font-medium tabular-nums">{formatDate(current.date)}</span>
            <span className="text-muted"> · {STATE_LABEL[current.state]}</span>
            {current.detail && <span className="text-muted"> · {current.detail}</span>}
          </>
        ) : (
          <span className="text-muted">Kun haqida ma’lumot uchun katakchani bosing</span>
        )}
      </p>
      {/* Legend: reported / missing always, "today" and "not expected" only when they occur. */}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {(Object.keys(STATE_LABEL) as CalendarDayState[])
          .filter((state) => state === "reported" || state === "missing" || states.has(state))
          .map((state) => (
            <li key={state} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-[3px]", STATE_CLASS[state])} aria-hidden />
              {STATE_LABEL[state]}
            </li>
          ))}
      </ul>
    </div>
  );
}
