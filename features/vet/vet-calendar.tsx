"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Stethoscope, Syringe } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate, todayIso, WEEKDAY_SHORT, weekdayIndex } from "@/lib/format";
import { VET_VISIT_STATUS } from "@/lib/status";
import { useApi } from "@/lib/use-api";
import type { VetCalendarDay } from "@/lib/types";
import { IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUrlParams } from "@/components/stats/period-picker";
import { MONTH_NAMES, monthBounds, shiftMonth, vetName } from "./shared";

/**
 * Month grid of `GET /api/vet/calendar` (V3 §8.7): dots for visits (primary) and vaccinations (accent),
 * overdue = danger. Tapping a day lists its items below. Month and day live in the URL (`?month=`, `?day=`).
 */
export function VetCalendar({ mine }: { mine: boolean }) {
  const params = useSearchParams();
  const setParams = useUrlParams();
  const today = todayIso();
  const rawMonth = params.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : today.slice(0, 7);
  const { from, to } = monthBounds(month);
  const rawDay = params.get("day") ?? "";
  const day = rawDay >= from && rawDay <= to ? rawDay : today >= from && today <= to ? today : from;
  const calendar = useApi<VetCalendarDay[]>("/vet/calendar", { date_from: from, date_to: to, vet: mine ? "me" : undefined });
  const days = calendar.data ?? [];
  const selected = days.find((item) => item.date === day);
  const lead = weekdayIndex(from);
  const [year, mon] = month.split("-").map(Number);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <IconButton label="Oldingi oy" onClick={() => setParams({ month: shiftMonth(month, -1), day: null })}>
            <ChevronLeft className="size-4" aria-hidden />
          </IconButton>
          <div className="flex flex-col items-center">
            <p className="text-sm font-semibold text-ink">
              {MONTH_NAMES[mon - 1]} {year}
            </p>
            {month !== today.slice(0, 7) && (
              <button type="button" className="text-xs text-accent hover:underline" onClick={() => setParams({ month: null, day: null })}>
                Bugunga qaytish
              </button>
            )}
          </div>
          <IconButton label="Keyingi oy" onClick={() => setParams({ month: shiftMonth(month, 1), day: null })}>
            <ChevronRight className="size-4" aria-hidden />
          </IconButton>
        </div>
        <StaleDataError error={calendar.data ? calendar.error : null} onRetry={calendar.reload} />
        {!calendar.data && calendar.error ? (
          <ErrorState error={calendar.error} onRetry={calendar.reload} />
        ) : (
          <div className="p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted">
              {WEEKDAY_SHORT.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
            <div className={cn("grid grid-cols-7 gap-1", calendar.loading && calendar.data && "opacity-60")}>
              {Array.from({ length: lead }, (_, index) => (
                <span key={`lead-${index}`} aria-hidden />
              ))}
              {!calendar.data
                ? Array.from({ length: 30 }, (_, index) => <Skeleton key={index} className="aspect-square rounded-lg" />)
                : days.map((item) => {
                    const visits = item.visits.length;
                    const vaccinations = item.vaccinations.length;
                    const overdue = item.visits.some((v) => v.is_overdue) || item.vaccinations.some((v) => v.is_overdue);
                    const active = item.date === day;
                    const isToday = item.date === today;
                    return (
                      <button
                        key={item.date}
                        type="button"
                        onClick={() => setParams({ day: item.date })}
                        aria-pressed={active}
                        aria-label={`${formatDate(item.date)}: ${visits} ta tekshiruv, ${vaccinations} ta emlash`}
                        className={cn(
                          "relative flex aspect-square min-h-11 flex-col sm:aspect-auto sm:h-16 items-center justify-start gap-1 rounded-lg border p-1 text-sm tabular-nums transition-colors sm:p-1.5",
                          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                          active ? "border-primary bg-primary text-white" : "border-transparent hover:bg-subtle",
                          !active && isToday && "border-accent font-semibold text-accent",
                          !active && overdue && "ring-1 ring-inset ring-danger/50",
                        )}
                      >
                        <span>{Number(item.date.slice(8))}</span>
                        <span className="flex flex-wrap items-center justify-center gap-0.5">
                          {visits > 0 && <Dot className={active ? "bg-white" : overdue ? "bg-danger" : "bg-primary"} count={visits} />}
                          {vaccinations > 0 && <Dot className={active ? "bg-white/70" : "bg-accent"} count={vaccinations} />}
                        </span>
                      </button>
                    );
                  })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" /> Tekshiruv
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent" /> Emlash
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-danger" /> Muddati o‘tgan
              </span>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">{formatDate(day)}</p>
          <p className="text-xs text-muted">
            {selected ? `${selected.visits.length} ta tekshiruv · ${selected.vaccinations.length} ta emlash` : "Yuklanmoqda…"}
          </p>
        </div>
        {selected && selected.visits.length === 0 && selected.vaccinations.length === 0 ? (
          <EmptyState icon={Stethoscope} title="Bu kunga reja yo‘q" />
        ) : (
          <ul className="divide-y divide-line">
            {selected?.visits.map((visit) => (
              <li key={`v-${visit.id}`}>
                <Link href={`/vet/visits/${visit.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-subtle">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Stethoscope className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{visit.household.name}</span>
                      <StatusBadge map={VET_VISIT_STATUS} status={visit.status} overdue={visit.is_overdue} />
                    </span>
                    <span className="block text-xs tabular-nums text-muted">
                      {visit.code} · {vetName(visit.vet)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {selected?.vaccinations.map((item) => (
              <li key={`e-${item.id}`}>
                <Link
                  href={`/vet?tab=vaccinations&day=${day}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-subtle"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Syringe className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{item.vaccine_name}</span>
                      <StatusBadge map={VET_VISIT_STATUS} status={item.status} overdue={item.is_overdue} />
                    </span>
                    <span className="block text-xs tabular-nums text-muted">
                      {item.code} · {item.household.name}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Dot({ className, count }: { className: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className={cn("size-1.5 rounded-full", className)} />
      {count > 1 && <span className="text-[9px] leading-none opacity-80">{count}</span>}
    </span>
  );
}
