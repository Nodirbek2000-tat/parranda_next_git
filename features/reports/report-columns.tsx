import Link from "next/link";
import type { Column } from "@/components/ui/data-table";
import { formatDate, formatNumber } from "@/lib/format";
import type { DailyReport } from "@/lib/types";

export function reportColumns({ household = false }: { household?: boolean } = {}): Column<DailyReport>[] {
  const columns: Column<DailyReport>[] = [
    {
      key: "date",
      header: "Sana",
      primary: true,
      cell: (row) => <span className="font-medium tabular-nums">{formatDate(row.date)}</span>,
    },
  ];
  if (household) {
    columns.push({
      key: "household",
      header: "Xonadon",
      cell: (row) => (
        <Link href={`/households/${row.household.id}`} className="text-ink hover:text-accent hover:underline">
          {row.household.name}
        </Link>
      ),
    });
  }
  columns.push(
    { key: "birds", header: "Parranda", align: "right", cell: (row) => formatNumber(row.bird_count) },
    { key: "eggs", header: "Tuxum", align: "right", cell: (row) => formatNumber(row.eggs) },
    { key: "feed", header: "Yem, kg", align: "right", cell: (row) => formatNumber(row.feed_kg) },
    {
      key: "deaths",
      header: "Nobud",
      align: "right",
      cell: (row) => <span className={row.deaths > 0 ? "font-medium text-danger" : undefined}>{formatNumber(row.deaths)}</span>,
    },
    { key: "meat", header: "Go‘sht, kg", align: "right", hideOnMobile: true, cell: (row) => formatNumber(row.meat_kg) },
    {
      key: "weight",
      header: "O‘rt. vazn, g",
      align: "right",
      hideOnMobile: true,
      cell: (row) => formatNumber(row.avg_weight_g),
    },
    { key: "note", header: "Izoh", hideOnMobile: true, className: "min-w-48 whitespace-normal", cell: (row) => <span className="text-muted">{row.note || "—"}</span> },
  );
  return columns;
}
