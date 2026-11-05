import Link from "next/link";
import type { Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { DocumentFilesButton } from "./document-files";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { StockTransaction, StockTransactionType } from "@/lib/types";
import type { BadgeTone } from "@/components/ui/badge";

const TYPE_TONE: Record<StockTransactionType, BadgeTone> = {
  IN: "success",
  OUT: "warning",
  ADJUST_IN: "info",
  ADJUST_OUT: "danger",
};

interface Options {
  /** Show the household (recipient) column. */
  household?: boolean;
  /** Show balance after the operation (warehouse view). */
  balance?: boolean;
  /** Show the product column (hidden on the product page itself). */
  product?: boolean;
  /** Link product and household names to their pages (staff views). */
  links?: boolean;
}

export function transactionColumns({
  household = true,
  balance = true,
  product = true,
  links = household,
}: Options = {}): Column<StockTransaction>[] {
  const columns: Column<StockTransaction>[] = [];
  if (product) {
    columns.push({
      key: "product",
      header: "Mahsulot",
      primary: true,
      cell: (row) =>
        links ? (
          <Link href={`/warehouse/${row.product.id}`} className="font-medium text-ink hover:text-accent hover:underline">
            {row.product.name}
          </Link>
        ) : (
          <span className="font-medium">{row.product.name}</span>
        ),
    });
  } else {
    columns.push({
      key: "op-primary",
      header: "Operatsiya",
      primary: true,
      cell: (row) => <span className="font-medium tabular-nums">{row.op_id}</span>,
    });
  }
  columns.push(
    {
      key: "type",
      header: "Turi",
      cell: (row) => <Badge tone={TYPE_TONE[row.type]}>{row.type_display}</Badge>,
    },
    {
      key: "quantity",
      header: "Miqdori",
      align: "right",
      cell: (row) => (
        <span className="inline-flex flex-col items-end">
          <span>
            {row.type === "IN" || row.type === "ADJUST_IN" ? "+" : "−"}
            {formatNumber(row.quantity)} {row.product.unit}
          </span>
          {row.lots && row.lots.length > 0 && (
            <span className="text-xs text-muted" title="Partiyalar">
              {row.lots
                .slice(0, 3)
                .map((lot) => `${lot.lot_no || `#${lot.lot_id}`}${row.lots!.length > 1 ? ` · ${formatNumber(lot.quantity)}` : ""}`)
                .join(", ")}
              {row.lots.length > 3 ? ` +${row.lots.length - 3}` : ""}
            </span>
          )}
        </span>
      ),
    },
  );
  if (balance) {
    columns.push({
      key: "balance",
      header: "Qoldiq",
      align: "right",
      cell: (row) => `${formatNumber(row.balance_after)} ${row.product.unit}`,
    });
  }
  if (household) {
    columns.push({
      key: "household",
      header: "Xonadon",
      cell: (row) =>
        row.household ? (
          links ? (
            <Link href={`/households/${row.household.id}`} className="text-ink hover:text-accent hover:underline">
              {row.household.name}
            </Link>
          ) : (
            row.household.name
          )
        ) : (
          <span className="text-muted">—</span>
        ),
    });
  }
  columns.push(
    {
      key: "doc",
      header: "Hujjat",
      cell: (row) => (
        <span className="whitespace-nowrap">
          {row.reference?.path ? (
            <Link href={row.reference.path} className="tabular-nums text-ink hover:text-accent hover:underline">
              {row.document_no}
            </Link>
          ) : (
            <span className="tabular-nums">{row.document_no}</span>
          )}
          <DocumentFilesButton files={row.files ?? []} title={`${row.op_id} · ${row.document_no}`} />
        </span>
      ),
    },
    ...(product
      ? [
          {
            key: "op",
            header: "Operatsiya",
            hideOnMobile: true,
            cell: (row: StockTransaction) => <span className="tabular-nums text-muted">{row.op_id}</span>,
          },
        ]
      : []),
    {
      key: "at",
      header: "Vaqt",
      cell: (row) => <span className="tabular-nums">{formatDateTime(row.created_at)}</span>,
    },
  );
  return columns;
}
