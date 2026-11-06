"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Card, Empty, Input, Loadable, PageHeader } from "@/components/ui";
import { listOf } from "@/lib/api";
import { fmtDateTime, personName } from "@/lib/format";
import type { AuditRow, Paged } from "@/lib/types";
import { useApi, useDebounced } from "@/lib/use-api";

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  return <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-subtle p-2 text-[11px]">{JSON.stringify(value, null, 2)}</pre>;
}

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim()).toLowerCase();
  const resource = useApi<Paged<AuditRow>>("/audit", { limit: 500 });

  return (
    <>
      <PageHeader title="Audit jurnali" subtitle="So‘nggi 500 ta amal (o‘zgartirib bo‘lmaydi)" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Amal, obyekt, foydalanuvchi…"
        className="mb-4"
        aria-label="Qidirish"
      />
      <Loadable data={resource.data} error={resource.error} reload={resource.reload}>
        {(data) => {
          const rows = listOf(data).filter(
            (row) => !q || [row.action, row.object_type, String(row.object_id ?? ""), personName(row.actor, row.actor_name)].some((v) => (v ?? "").toLowerCase().includes(q)),
          );
          if (!rows.length) return <Empty title="Yozuvlar yo‘q" icon={<ScrollText className="size-8" aria-hidden />} />;
          return (
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <Card key={row.id} className="p-3">
                  <details>
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-medium">{row.action}</span>
                        <span className="text-xs text-muted">{fmtDateTime(row.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted">
                        {personName(row.actor, row.actor_name)}
                        {row.object_type ? ` · ${row.object_type}` : ""}
                        {row.object_id !== undefined && row.object_id !== null ? ` #${row.object_id}` : ""}
                      </p>
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium">Oldin</p>
                        <Json value={row.before} />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium">Keyin</p>
                        <Json value={row.after} />
                      </div>
                    </div>
                  </details>
                </Card>
              ))}
            </div>
          );
        }}
      </Loadable>
    </>
  );
}
