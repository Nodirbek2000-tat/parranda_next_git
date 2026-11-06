"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button, Card, Loadable, PageHeader, Stat } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtNumber, personName } from "@/lib/format";
import { STAGES } from "@/lib/stages";
import type { PersonRef, Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Raw = Record<string, unknown>;

interface StageCount {
  number: number;
  title: string;
  count: number;
  overdue: number;
}

interface DashEvent {
  case?: { id: number; code: string; name?: string } | number | null;
  case_id?: number;
  case_code?: string;
  stage_number?: number;
  action: string;
  action_display?: string;
  actor?: PersonRef;
  actor_name?: string;
  note?: string;
  created_at: string;
}

const ACTIONS: Record<string, string> = { create: "Yaratildi", submit: "Topshirildi", approve: "Tasdiqlandi", return: "Qaytarildi", reject: "Rad etildi" };

function num(...values: unknown[]): number {
  for (const value of values) if (value !== undefined && value !== null && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function pick<T>(raw: Raw, ...keys: string[]): T | undefined {
  for (const key of keys) if (raw[key] !== undefined) return raw[key] as T;
  const totals = raw.totals as Raw | undefined;
  if (totals) for (const key of keys) if (totals[key] !== undefined) return totals[key] as T;
  return undefined;
}

/** Accepts `[{number, count}]` or `{"1": 3}` / `{"1": {count, overdue}}`. */
function stageCounts(raw: Raw): StageCount[] {
  const source = pick<unknown>(raw, "stages", "per_stage", "by_stage", "stage_counts");
  const map = new Map<number, { count: number; overdue: number; title?: string }>();
  if (Array.isArray(source)) {
    for (const row of source as Raw[]) {
      const n = num(row.number, row.stage, row.stage_number, row.current_stage);
      map.set(n, { count: num(row.count, row.total), overdue: num(row.overdue, row.overdue_count), title: row.title as string | undefined });
    }
  } else if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source as Raw)) {
      const n = Number(key);
      if (value && typeof value === "object") {
        const v = value as Raw;
        map.set(n, { count: num(v.count, v.total), overdue: num(v.overdue), title: v.title as string | undefined });
      } else map.set(n, { count: num(value), overdue: 0 });
    }
  }
  return STAGES.map((def) => {
    const found = map.get(def.number);
    return { number: def.number, title: found?.title || def.title, count: found?.count ?? 0, overdue: found?.overdue ?? 0 };
  });
}

export default function DashboardPage() {
  const resource = useApi<Raw>("/dashboard");
  return (
    <>
      <PageHeader
        title="Boshqaruv paneli"
        actions={
          <Button variant="secondary" size="sm" onClick={resource.reload} loading={resource.loading} icon={<RefreshCw className="size-4" aria-hidden />}>
            Yangilash
          </Button>
        }
      />
      <Loadable data={resource.data} error={resource.error} reload={resource.reload}>
        {(raw) => {
          const stages = stageCounts(raw);
          const inProgress = num(pick(raw, "in_progress", "in_progress_count", "active"), stages.reduce((sum, s) => sum + s.count, 0));
          const overdue = num(pick(raw, "overdue", "overdue_count", "overdue_total"));
          const done = num(pick(raw, "done", "done_count", "done_total"));
          const rejected = num(pick(raw, "rejected", "rejected_count", "rejected_total"));
          const lowStock = pick<Product[]>(raw, "low_stock", "low_stock_products") ?? [];
          const events = pick<DashEvent[]>(raw, "events", "latest_events", "recent_events") ?? [];
          const max = Math.max(1, ...stages.map((s) => s.count));
          return (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Jarayonda" value={fmtNumber(inProgress)} />
                <Stat label="Muddati o‘tgan" value={fmtNumber(overdue)} tone={overdue ? "red" : undefined} />
                <Stat label="Yakunlangan" value={fmtNumber(done)} tone="green" />
                <Stat label="Rad etilgan" value={fmtNumber(rejected)} />
              </div>

              <Card>
                <h2 className="mb-3 font-semibold">Bosqichlar bo‘yicha</h2>
                <ul className="flex flex-col gap-2">
                  {stages.map((s) => (
                    <li key={s.number}>
                      <Link href={`/cases?stage=${s.number}`} className="block rounded-lg px-1 py-0.5 hover:bg-subtle">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate">
                            {s.number}. {s.title}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            <b>{s.count}</b>
                            {s.overdue > 0 && <span className="ml-1.5 font-semibold text-danger">({s.overdue} kechikkan)</span>}
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-subtle">
                          <div className={cn("h-full rounded-full", s.overdue ? "bg-danger" : "bg-accent")} style={{ width: `${(s.count / max) * 100}%` }} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <h2 className="mb-3 font-semibold">Kam qolgan mahsulotlar</h2>
                  {lowStock.length === 0 ? (
                    <p className="text-sm text-muted">Hammasi yetarli.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {lowStock.map((p) => (
                        <li key={p.id} className="flex justify-between gap-3">
                          <span className="min-w-0 truncate">{p.name}</span>
                          <span className="shrink-0 tabular-nums font-semibold text-danger">
                            {fmtNumber(p.balance)} {p.unit}
                            {p.min_stock !== undefined && <span className="font-normal text-muted"> / min {fmtNumber(p.min_stock)}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card>
                  <h2 className="mb-3 font-semibold">So‘nggi harakatlar</h2>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted">Hali harakat yo‘q.</p>
                  ) : (
                    <ul className="flex flex-col gap-2 text-sm">
                      {events.map((e, index) => {
                        const caseId = e.case_id ?? (e.case && typeof e.case === "object" ? e.case.id : typeof e.case === "number" ? e.case : undefined);
                        const caseCode = e.case_code ?? (e.case && typeof e.case === "object" ? e.case.code : undefined);
                        return (
                        <li key={index} className="border-b border-line pb-2 last:border-0 last:pb-0">
                          <p>
                            {caseId ? (
                              <Link href={`/cases/${caseId}`} className="font-medium text-accent">
                                {caseCode ?? `#${caseId}`}
                              </Link>
                            ) : (
                              <span className="font-medium">{caseCode}</span>
                            )}
                            {e.stage_number ? ` · ${e.stage_number}-bosqich` : ""} · {e.action_display || ACTIONS[e.action] || e.action}
                          </p>
                          <p className="text-xs text-muted">
                            {personName(e.actor, e.actor_name)} · {fmtDateTime(e.created_at)}
                          </p>
                          {e.note && <p className="text-xs">«{e.note}»</p>}
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          );
        }}
      </Loadable>
    </>
  );
}
