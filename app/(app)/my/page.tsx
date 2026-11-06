"use client";

import { House } from "lucide-react";
import { CaseCard } from "@/components/case-card";
import { CaseView } from "@/components/case-view";
import { Alert, Empty, Loadable, PageHeader, Spinner } from "@/components/ui";
import { listOf } from "@/lib/api";
import type { CaseDetail, CaseSummary, Paged } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** Owner cabinet: own case timeline (read-only) + the stage-9 confirm form when it is their turn. */
export default function MyPage() {
  const list = useApi<Paged<CaseSummary>>("/cases");
  const items = list.data ? listOf(list.data) : [];
  const single = items.length === 1 ? items[0] : null;
  const detail = useApi<CaseDetail>(single ? `/cases/${single.id}` : null);

  return (
    <>
      <PageHeader title="Mening xonadonim" />
      <Loadable data={list.data} error={list.error} reload={list.reload}>
        {() => {
          if (!items.length)
            return (
              <Empty title="Xonadon biriktirilmagan" icon={<House className="size-8" aria-hidden />}>
                Savollar bo‘lsa, administrator bilan bog‘laning.
              </Empty>
            );
          if (!single)
            return (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <CaseCard key={item.id} item={item} />
                ))}
              </div>
            );
          if (detail.data) return <CaseView detail={detail.data} readOnly />;
          return detail.error ? <Alert>{detail.error}</Alert> : <Spinner />;
        }}
      </Loadable>
    </>
  );
}
