import Link from "next/link";
import type { Column } from "@/components/ui/data-table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import type { Movement, MovementType } from "@/lib/types";

const TYPE_TONES: Record<MovementType, BadgeTone> = {
  DISTRIBUTE: "success",
  RETURN: "neutral",
  DEATH: "danger",
  OUT: "warning",
};

export function MovementTypeBadge({ movement }: { movement: Pick<Movement, "type" | "type_display"> }) {
  return <Badge tone={TYPE_TONES[movement.type]}>{movement.type_display}</Badge>;
}

interface Options {
  /** Hide the household column (household page). */
  household?: boolean;
  /** Link household and batch names to their pages (staff only). */
  linkHouseholds?: boolean;
  /** Link batch codes to /batches/{id} (default: like households; off for VET, who cannot open /batches). */
  linkBatches?: boolean;
  /** Show the batch column (hidden on the batch page itself). */
  batch?: boolean;
}

export function movementColumns({
  household = true,
  linkHouseholds = true,
  linkBatches = linkHouseholds,
  batch = true,
}: Options = {}): Column<Movement>[] {
  const columns: Column<Movement>[] = [
    {
      key: "op",
      header: "Operatsiya",
      primary: true,
      cell: (row) => <span className="font-medium tabular-nums">{row.op_id}</span>,
    },
    { key: "type", header: "Turi", cell: (row) => <MovementTypeBadge movement={row} /> },
  ];
  if (batch) {
    columns.push({
      key: "batch",
      header: "Partiya",
      cell: (row) =>
        linkBatches ? (
          <Link href={`/batches/${row.batch.id}`} className="tabular-nums text-ink hover:text-accent hover:underline">
            {row.batch.code}
          </Link>
        ) : (
          <span className="tabular-nums">{row.batch.code}</span>
        ),
    });
  }
  if (household) {
    columns.push({
      key: "household",
      header: "Xonadon",
      cell: (row) =>
        row.household ? (
          linkHouseholds ? (
            <Link href={`/households/${row.household.id}`} className="text-ink hover:text-accent hover:underline">
              {row.household.name}
            </Link>
          ) : (
            row.household.name
          )
        ) : (
          <span className="text-muted">Markaz</span>
        ),
    });
  }
  columns.push(
    { key: "quantity", header: "Miqdori", align: "right", cell: (row) => formatNumber(row.quantity) },
    { key: "date", header: "Sana", cell: (row) => <span className="tabular-nums">{formatDate(row.date)}</span> },
    {
      key: "by",
      header: "Kiritgan",
      hideOnMobile: true,
      cell: (row) => <span className="text-muted">{row.created_by.full_name}</span>,
    },
  );
  return columns;
}
