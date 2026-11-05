import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Rendered as the row title (and link) in the mobile card layout. */
  primary?: boolean;
  /** Omit this column in the mobile card layout. */
  hideOnMobile?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string | number;
  /** Accessible table caption (visually hidden). */
  caption: string;
  rowHref?: (row: T) => string;
  actions?: (row: T) => ReactNode;
  /** Dim the rows while a refetch is running. */
  stale?: boolean;
  /** Tables longer than this scroll inside the card with a sticky header (desktop). */
  maxRowsBeforeScroll?: number;
  /** Value columns per row in the phone card layout (3 for short numeric tables). */
  mobileColumns?: 2 | 3;
}

/**
 * Table on md+ screens, stacked cards on phones (Telegram Web App).
 * Numbers use tabular figures; the primary column links to the detail page.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  rowHref,
  actions,
  stale = false,
  maxRowsBeforeScroll = 25,
  mobileColumns = 2,
}: DataTableProps<T>) {
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column !== primary && !column.hideOnMobile);

  const renderPrimary = (row: T) => {
    const content = primary.cell(row);
    if (!rowHref) return content;
    return (
      <Link
        href={rowHref(row)}
        className="rounded font-medium text-ink hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {content}
      </Link>
    );
  };

  return (
    <div className={cn("transition-opacity", stale && "opacity-60")} aria-busy={stale || undefined}>
      <div
        className={cn(
          "hidden overflow-x-auto md:block",
          rows.length > maxRowsBeforeScroll && "max-h-[min(72vh,760px)] overflow-y-auto overscroll-contain",
        )}
      >
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-[1] h-10 whitespace-nowrap border-b border-line bg-surface px-4 text-xs font-medium text-muted first:pl-6 last:pr-6",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.header}
                </th>
              ))}
              {actions && (
                <th
                  scope="col"
                  className="sticky top-0 z-[1] h-10 border-b border-line bg-surface px-4 pr-6 text-right text-xs font-medium text-muted"
                >
                  <span className="sr-only">Amallar</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="group transition-colors hover:bg-subtle">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "h-12 whitespace-nowrap border-b border-line px-4 py-2 align-middle first:pl-6 last:pr-6 group-last:border-b-0",
                      column.align === "right" ? "text-right tabular-nums" : "text-left",
                      column.className,
                    )}
                  >
                    {column === primary ? renderPrimary(row) : column.cell(row)}
                  </td>
                ))}
                {actions && (
                  <td className="h-12 border-b border-line px-4 py-2 pr-6 text-right group-last:border-b-0">
                    <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-3">
            <div className="text-sm">{renderPrimary(row)}</div>
            {secondary.length > 0 && (
              <dl
                className={cn(
                  "mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]",
                  mobileColumns === 3 && "min-[360px]:grid-cols-3 min-[360px]:gap-x-3",
                )}
              >
                {secondary.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-muted">{column.header}</dt>
                    <dd className={cn("min-w-0 break-words text-ink", column.align === "right" && "tabular-nums")}>
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && <div className="mt-3 flex flex-wrap gap-2">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
