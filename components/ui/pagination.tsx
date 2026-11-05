import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { Button } from "./button";

interface PaginationProps {
  page: number;
  count: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ page, count, pageSize, onPageChange, disabled }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (count === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <nav
      aria-label="Sahifalar"
      className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted sm:px-6"
    >
      <p className="tabular-nums">
        {formatNumber(from)}–{formatNumber(to)} / {formatNumber(count)}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            icon={<ChevronLeft className="size-4" aria-hidden />}
            aria-label="Oldingi sahifa"
          />
          <span className="tabular-nums text-ink">
            {page} / {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= pages}
            icon={<ChevronRight className="size-4" aria-hidden />}
            aria-label="Keyingi sahifa"
          />
        </div>
      )}
    </nav>
  );
}
