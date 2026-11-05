import { CloudOff, LogOut, RefreshCw } from "lucide-react";
import type { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoMark } from "./logo";

/** Placeholder while the session is resolved (also the prerendered shell). */
export function ShellSkeleton() {
  return (
    <div className="min-h-app lg:pl-64" role="status" aria-label="Yuklanmoqda">
      <div className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-surface lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-line px-5">
          <LogoMark />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex flex-col gap-2 px-3 py-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 sm:px-6 lg:h-16 lg:px-8">
        <LogoMark className="size-8 lg:invisible" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

interface SessionErrorProps {
  error: ApiError;
  onRetry: () => void;
  onSignOut: () => void;
}

export function SessionError({ error, onRetry, onSignOut }: SessionErrorProps) {
  return (
    <div className="flex min-h-app items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger">
          <CloudOff className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-base font-semibold text-ink">Profilni yuklab bo‘lmadi</h1>
        <p className="mt-1 text-sm text-muted">{error.message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={onRetry} icon={<RefreshCw className="size-4" aria-hidden />}>
            Qayta urinish
          </Button>
          <Button variant="ghost" onClick={onSignOut} icon={<LogOut className="size-4" aria-hidden />}>
            Chiqish
          </Button>
        </div>
      </div>
    </div>
  );
}
