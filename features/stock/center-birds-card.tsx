"use client";

import { Bird } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { useAllPages } from "@/lib/use-api";
import type { Batch } from "@/lib/types";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TableSkeleton } from "@/components/ui/skeleton";

const COLUMNS: Column<Batch>[] = [
  { key: "code", header: "Partiya", primary: true, cell: (row) => <span className="font-medium tabular-nums">{row.code}</span> },
  { key: "type", header: "Turi", cell: (row) => row.poultry_type_display },
  { key: "breed", header: "Zoti", hideOnMobile: true, cell: (row) => row.breed },
  { key: "arrived", header: "Kelgan", hideOnMobile: true, cell: (row) => <span className="tabular-nums">{formatDate(row.arrived_at)}</span> },
  { key: "stock", header: "Markazda", align: "right", cell: (row) => `${formatNumber(row.center_stock)} dona` },
];

/**
 * TZ §7 "Parranda" category of the warehouse: birds are stored as batches (V3 §20.7), so the center's
 * bird stock is listed here per batch, next to the products.
 */
export function CenterBirdsCard() {
  const batches = useAllPages<Batch>("/batches");
  const rows = (batches.data?.results ?? []).filter((row) => row.center_stock > 0);
  const total = rows.reduce((sum, row) => sum + row.center_stock, 0);
  return (
    <Card>
      <CardHeader
        title="Parranda (markazda)"
        description={batches.data ? `Jami: ${formatNumber(total)} dona · partiyalar bo‘yicha` : "Partiyalar bo‘yicha"}
        actions={
          <LinkButton href="/batches" size="sm">
            Partiyalar
          </LinkButton>
        }
      />
      <div className="mt-3 border-t border-line">
        {!batches.data && batches.error ? (
          <ErrorState error={batches.error} onRetry={batches.reload} />
        ) : !batches.data ? (
          <TableSkeleton rows={2} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Bird} title="Markazda parranda yo‘q" />
        ) : (
          <DataTable caption="Markazdagi parranda" rows={rows} columns={COLUMNS} rowKey={(row) => row.id} rowHref={(row) => `/batches/${row.id}`} />
        )}
      </div>
    </Card>
  );
}
