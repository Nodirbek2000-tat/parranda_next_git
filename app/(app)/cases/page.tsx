"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Plus, Search } from "lucide-react";
import { CaseCard } from "@/components/case-card";
import { Empty, Input, LinkButton, Loadable, PageHeader, Select, Spinner } from "@/components/ui";
import { listOf } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { effectiveRole } from "@/lib/roles";
import { CASE_STATUS_LABELS, STAGES } from "@/lib/stages";
import type { CaseSummary, Paged } from "@/lib/types";
import { useApi, useDebounced } from "@/lib/use-api";

export default function CasesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CasesList />
    </Suspense>
  );
}

function CasesList() {
  const user = useMe();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [stage, setStage] = useState(params.get("stage") ?? "");
  const query = useDebounced(search.trim());
  const resource = useApi<Paged<CaseSummary>>("/cases", { search: query, status, stage });
  const canCreate = ["INSPECTOR", "ADMIN", "SUPERADMIN"].includes(effectiveRole(user));
  const count = resource.data && !Array.isArray(resource.data) ? resource.data.count : undefined;

  return (
    <>
      <PageHeader
        title="Xonadonlar"
        subtitle={count !== undefined ? `Jami: ${count}` : undefined}
        actions={
          canCreate && (
            <LinkButton href="/cases/new" variant="primary" size="sm" icon={<Plus className="size-4" aria-hidden />}>
              Yangi xonadon
            </LinkButton>
          )
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kod, F.I.Sh., telefon…" className="pl-9" aria-label="Qidirish" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Holat">
          <option value="">Barcha holatlar</option>
          {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Bosqich">
          <option value="">Barcha bosqichlar</option>
          {STAGES.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.title}
            </option>
          ))}
        </Select>
      </div>
      <Loadable data={resource.data} error={resource.error} reload={resource.reload}>
        {(data) => {
          const items = listOf(data);
          if (!items.length) return <Empty title="Xonadon topilmadi" icon={<ClipboardList className="size-8" aria-hidden />} />;
          return (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <CaseCard key={item.id} item={item} />
              ))}
            </div>
          );
        }}
      </Loadable>
    </>
  );
}
