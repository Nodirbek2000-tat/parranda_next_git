"use client";

import { ListChecks, RefreshCw } from "lucide-react";
import { CaseCard, currentStage } from "@/components/case-card";
import { Button, Empty, Loadable, PageHeader } from "@/components/ui";
import { listOf } from "@/lib/api";
import { deadline } from "@/lib/format";
import type { CaseSummary, Paged } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** "Mening vazifalarim": cases where I must act now (`mine=1`). Overdue first. */
export default function TasksPage() {
  const resource = useApi<Paged<CaseSummary>>("/cases", { mine: 1 });
  return (
    <>
      <PageHeader
        title="Mening vazifalarim"
        subtitle="Sizning harakatingizni kutayotgan xonadonlar"
        actions={
          <Button variant="secondary" size="sm" onClick={resource.reload} loading={resource.loading} icon={<RefreshCw className="size-4" aria-hidden />}>
            Yangilash
          </Button>
        }
      />
      <Loadable data={resource.data} error={resource.error} reload={resource.reload}>
        {(data) => {
          const items = listOf(data)
            .map((item) => {
              const stage = currentStage(item);
              return { item, stage, overdue: !!deadline(stage.dueAt, stage.overdue)?.overdue };
            })
            .sort((a, b) => {
              if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
              return (a.stage.dueAt ?? "9").localeCompare(b.stage.dueAt ?? "9");
            });
          if (!items.length)
            return (
              <Empty title="Hozircha vazifa yo‘q" icon={<ListChecks className="size-8" aria-hidden />}>
                Yangi vazifa kelganda Telegram orqali xabar olasiz.
              </Empty>
            );
          const overdue = items.filter((row) => row.overdue).length;
          return (
            <div className="flex flex-col gap-3">
              {overdue > 0 && <p className="text-sm font-semibold text-danger">Muddati o‘tgan: {overdue} ta</p>}
              {items.map(({ item }) => (
                <CaseCard key={item.id} item={item} />
              ))}
            </div>
          );
        }}
      </Loadable>
    </>
  );
}
