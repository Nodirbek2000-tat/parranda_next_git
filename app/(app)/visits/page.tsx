"use client";

import { useState } from "react";
import { RefreshCw, Stethoscope } from "lucide-react";
import { Button, Empty, Loadable, PageHeader } from "@/components/ui";
import { VisitCard } from "@/components/visits";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { effectiveRole } from "@/lib/roles";
import { useApi } from "@/lib/use-api";
import { toVisits, VISITS_PATH, type VisitStatus } from "@/lib/visits";

const TABS: { key: VisitStatus; label: string }[] = [
  { key: "PLANNED", label: "Rejalashtirilgan" },
  { key: "DONE", label: "Bajarilgan" },
  { key: "CANCELLED", label: "Bekor qilingan" },
];

/** Vet visits: VET sees own (`mine=1`), ADMIN / SUPERADMIN see all. Overdue planned visits are red and first. */
export default function VisitsPage() {
  const user = useMe();
  const vet = effectiveRole(user) === "VET";
  const [tab, setTab] = useState<VisitStatus>("PLANNED");
  const resource = useApi<unknown>(VISITS_PATH, vet ? { mine: 1 } : undefined);

  return (
    <>
      <PageHeader
        title={vet ? "Mening tashriflarim" : "Veterinar tashriflari"}
        subtitle="Parvarish davridagi haftalik ko‘riklar va chaqiruvlar"
        actions={
          <Button variant="secondary" size="sm" onClick={resource.reload} loading={resource.loading} icon={<RefreshCw className="size-4" aria-hidden />}>
            Yangilash
          </Button>
        }
      />
      <Loadable data={resource.data} error={resource.error} reload={resource.reload}>
        {(data) => {
          const all = toVisits(data);
          const shown = all
            .filter((v) => v.status === tab)
            .sort((a, b) => {
              if (tab === "PLANNED") {
                if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
                return (a.plannedDate ?? "").localeCompare(b.plannedDate ?? "");
              }
              return (b.doneAt ?? b.plannedDate ?? "").localeCompare(a.doneAt ?? a.plannedDate ?? "");
            });
          const overdue = all.filter((v) => v.overdue).length;
          return (
            <>
              <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
                  {TABS.map((t) => {
                    const count = all.filter((v) => v.status === t.key).length;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={cn("h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium", tab === t.key ? "bg-primary text-white" : "text-muted hover:text-ink")}
                      >
                        {t.label}
                        {count > 0 && <span className={cn("ml-1.5 rounded-full px-1.5 text-xs", tab === t.key ? "bg-white/20" : "bg-subtle")}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              {tab === "PLANNED" && overdue > 0 && <p className="mb-3 text-sm font-semibold text-danger">Muddati o‘tgan: {overdue} ta</p>}
              {shown.length === 0 ? (
                <Empty title="Tashriflar yo‘q" icon={<Stethoscope className="size-8" aria-hidden />}>
                  {tab === "PLANNED" ? "Yangi tashrif rejalashtirilganda Telegram orqali xabar olasiz." : null}
                </Empty>
              ) : (
                <div className="flex flex-col gap-3">
                  {shown.map((visit) => (
                    <VisitCard key={visit.id} visit={visit} />
                  ))}
                </div>
              )}
            </>
          );
        }}
      </Loadable>
    </>
  );
}
