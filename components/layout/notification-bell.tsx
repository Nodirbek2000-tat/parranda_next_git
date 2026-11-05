"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, BellOff, CheckCheck, Settings2, X } from "lucide-react";
import { api, isAbortError, toApiError, type ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { MyNotification, Paginated, UnreadCount } from "@/lib/types";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationPreferencesModal } from "./notification-preferences";

const POLL_MS = 60_000;
const LIST_SIZE = 10;

/** Only same-app paths from the server are followed (never an absolute URL). */
function safePath(path: string): string | null {
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
}

/**
 * Shell bell (API_CONTRACT_V3 §15.2): unread badge polled every 60 s and on window focus;
 * dropdown (desktop) / bottom sheet (phone) with the last 10 notifications of the user.
 */
export function NotificationBell() {
  const router = useRouter();
  const panelId = useId();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [items, setItems] = useState<MyNotification[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const loadCount = useCallback((signal?: AbortSignal) => {
    api
      .get<UnreadCount>("/my/notifications/unread-count", undefined, signal)
      .then((data) => setCount(data.count))
      .catch(() => {
        // The badge is best-effort: keep the last value on errors.
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadCount(controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadCount();
    }, POLL_MS);
    const onFocus = () => loadCount();
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadCount]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api
      .get<Paginated<MyNotification>>("/my/notifications", { page_size: LIST_SIZE }, controller.signal)
      .then((data) => {
        setItems(data.results);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!isAbortError(caught)) setError(toApiError(caught));
      });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      controller.abort();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  const openItem = async (item: MyNotification) => {
    if (!item.read_at) {
      setItems((list) => list?.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)) ?? null);
      setCount((value) => Math.max(0, value - 1));
      api.post(`/my/notifications/${item.id}/read`, {}, { silent: true }).catch(() => loadCount());
    }
    const path = safePath(item.button_path);
    close();
    if (path) router.push(path);
  };

  const readAll = async () => {
    setMarkingAll(true);
    try {
      await api.post("/my/notifications/read-all", {}, { silent: true });
      const now = new Date().toISOString();
      setItems((list) => list?.map((row) => ({ ...row, read_at: row.read_at ?? now })) ?? null);
      setCount(0);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setMarkingAll(false);
    }
  };

  const badge = count > 9 ? "9+" : String(count);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={count > 0 ? `Bildirishnomalar: ${count} ta o‘qilmagan` : "Bildirishnomalar"}
        title="Bildirishnomalar"
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors",
          "hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          open && "bg-ink/5 text-ink",
        )}
      >
        <Bell className="size-[18px]" aria-hidden />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-surface">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/30 sm:bg-transparent" aria-hidden onClick={close} />
          <div
            id={panelId}
            role="dialog"
            aria-label="Bildirishnomalar"
            className={cn(
              "pb-safe fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] animate-sheet-in flex-col rounded-t-2xl border-t border-line bg-surface shadow-pop",
              "sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[min(70vh,560px)] sm:w-[380px] sm:animate-fade-in sm:rounded-xl sm:border sm:pb-0",
            )}
          >
            <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <p className="text-[15px] font-semibold text-ink">Bildirishnomalar</p>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={markingAll}
                    icon={<CheckCheck className="size-4" aria-hidden />}
                    onClick={readAll}
                    title="Barchasini o‘qilgan deb belgilash"
                  >
                    <span className="hidden sm:inline">Barchasini o‘qilgan deb belgilash</span>
                    <span className="sm:hidden">Barchasini o‘qish</span>
                  </Button>
                )}
                <IconButton
                  label="Bildirishnoma sozlamalari"
                  onClick={() => {
                    close();
                    setPrefsOpen(true);
                  }}
                >
                  <Settings2 className="size-4" aria-hidden />
                </IconButton>
                <IconButton label="Yopish" onClick={close}>
                  <X className="size-4" aria-hidden />
                </IconButton>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {error && !items ? (
                <p className="px-4 py-6 text-center text-sm text-danger">{error.message}</p>
              ) : !items ? (
                <div className="flex flex-col gap-3 px-4 py-4" role="status" aria-label="Yuklanmoqda">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <EmptyState icon={BellOff} title="Bildirishnomalar yo‘q" className="py-10" />
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((item) => {
                    const unread = !item.read_at;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => openItem(item)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                        >
                          <span
                            aria-hidden
                            className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-accent" : "bg-transparent")}
                          />
                          <span className="min-w-0 flex-1">
                            <span className={cn("block text-[13px] leading-snug text-ink", unread && "font-semibold")}>
                              {item.title || item.event_display}
                            </span>
                            {item.body && (
                              <span className="mt-0.5 line-clamp-2 block whitespace-pre-line text-xs text-muted">
                                {item.body}
                              </span>
                            )}
                            <span className="mt-1 block text-[11px] tabular-nums text-muted">
                              {formatDateTime(item.created_at)}
                              {unread && <span className="sr-only"> · o‘qilmagan</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
      {prefsOpen && <NotificationPreferencesModal onClose={() => setPrefsOpen(false)} />}
    </div>
  );
}
