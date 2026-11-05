"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { Query } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { usePagedApi } from "@/lib/use-api";
import type {  } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";

interface PagedTableCardProps<T> {
  title: string;
  path: string;
  query?: Query;
  columns: readonly Column<T>[];
  rowKey: (row: T) => string | number;
  emptyTitle: string;
  emptyIcon?: LucideIcon;
  actions?: ReactNode;
  pageSize?: number;
  /** Whole-row link (staff detail pages). */
  rowHref?: (row: T) => string;
}

/** Card with a paginated contract list (`?page=&page_size=`). */
export function PagedTableCard<T>({
  title,
  path,
  query,
  columns,
  rowKey,
  emptyTitle,
  emptyIcon,
  actions,
  pageSize = 20,
  rowHref,
}: PagedTableCardProps<T>) {
  const list = usePagedApi<T>(path, query ?? {}, pageSize);
  const { page, setPage } = list;
  const data = list.data;

  return (
    <Card>
      <CardHeader
        title={title}
        description={data && data.count > 0 ? `Jami: ${formatNumber(data.count)}` : undefined}
        actions={actions}
      />
      <div className="mt-3 border-t border-line">
        <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
        {!data && list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !data ? (
          <TableSkeleton rows={3} />
        ) : data.results.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} />
        ) : (
          <>
            <DataTable
              caption={title}
              rows={data.results}
              columns={columns}
              rowKey={rowKey}
              rowHref={rowHref}
              stale={list.loading}
            />
            <Pagination page={page} count={data.count} pageSize={pageSize} onPageChange={setPage} disabled={list.loading} />
          </>
        )}
      </div>
    </Card>
  );
}
