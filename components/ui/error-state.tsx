import { CloudOff, RefreshCw } from "lucide-react";
import type { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/**
 * Shown above data that is still on screen when a refetch failed, so stale
 * rows are never presented as current without a warning.
 */
export function StaleDataError({
  error,
  onRetry,
  className,
}: {
  error: ApiError | null;
  onRetry: () => void;
  className?: string;
}) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-danger/25 bg-danger-soft px-4 py-2.5 text-sm text-danger sm:px-6",
        className,
      )}
    >
      <span className="flex min-w-0 items-start gap-2">
        <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0">Ma’lumot yangilanmadi: {error.message}</span>
      </span>
      <Button variant="secondary" size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} onClick={onRetry}>
        Qayta urinish
      </Button>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center" role="alert">
      <span className="flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger">
        <CloudOff className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium text-ink">Ma’lumotni yuklab bo‘lmadi</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{error.message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" icon={<RefreshCw className="size-3.5" aria-hidden />} onClick={onRetry}>
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
