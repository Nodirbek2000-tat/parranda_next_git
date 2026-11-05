"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Search, SearchX, X } from "lucide-react";
import { api, isAbortError, toApiError, type ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useDebounced } from "@/lib/use-api";
import type { SearchItem, SearchResult } from "@/lib/types";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const MIN_QUERY = 2;

function useSearch(query: string) {
  const debounced = useDebounced(query.trim(), 300);
  const active = debounced.length >= MIN_QUERY;
  const [state, setState] = useState<{ q: string; data: SearchResult | null; error: ApiError | null }>({
    q: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    api
      .get<SearchResult>("/search", { q: debounced.slice(0, 100) }, controller.signal)
      .then((data) => setState({ q: debounced, data, error: null }))
      .catch((caught: unknown) => {
        if (!isAbortError(caught)) setState({ q: debounced, data: null, error: toApiError(caught) });
      });
    return () => controller.abort();
  }, [debounced, active]);

  const current = active && state.q === debounced;
  return {
    active,
    loading: active && !current,
    data: current ? state.data : null,
    error: current ? state.error : null,
  };
}

function Results({ query, onPick }: { query: string; onPick: (item: SearchItem) => void }) {
  const result = useSearch(query);
  if (!result.active) {
    return <p className="px-4 py-6 text-center text-[13px] text-muted">Kamida 2 ta belgi kiriting: kod, nom yoki telefon.</p>;
  }
  if (result.loading && !result.data) {
    return (
      <div className="flex justify-center py-8" role="status">
        <LoaderCircle className="size-5 animate-spin text-accent" aria-label="Qidirilmoqda" />
      </div>
    );
  }
  if (result.error) return <p className="px-4 py-6 text-center text-sm text-danger">{result.error.message}</p>;
  if (!result.data || result.data.groups.length === 0) {
    return <EmptyState icon={SearchX} title="Hech narsa topilmadi" className="py-8" />;
  }
  return (
    <div className="flex flex-col py-1">
      {result.data.groups.map((group) => (
        <section key={group.type} aria-label={group.label} className="py-1">
          <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">{group.label}</p>
          <ul>
            {group.items.map((item) => (
              <li key={`${group.type}-${item.id}`}>
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  className="flex w-full flex-col px-4 py-2 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none"
                >
                  <span className="truncate text-sm text-ink">{item.title}</span>
                  <span className="truncate text-xs text-muted">{item.subtitle}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Global search (API_CONTRACT_V3 §12): a field in the top bar on desktop, an icon that opens a
 * full-screen sheet on phones. Results are scoped by the server to what the role may see.
 */
export function GlobalSearch() {
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const pick = (item: SearchItem) => {
    if (!item.path.startsWith("/") || item.path.startsWith("//")) return;
    setFocused(false);
    setSheetOpen(false);
    setQuery("");
    router.push(item.path);
  };

  useEffect(() => {
    if (!focused) return;
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [focused]);

  return (
    <>
      {/* Desktop */}
      <div ref={boxRef} className="relative hidden w-full max-w-md md:block">
        <label htmlFor={inputId} className="sr-only">
          Qidirish
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setFocused(false);
              (event.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Qidirish: xonadon, partiya, mahsulot…"
          autoComplete="off"
          maxLength={100}
          className={cn(
            "block h-9 w-full rounded-lg border border-line bg-subtle pl-9 pr-3 text-sm text-ink placeholder:text-muted/70",
            "hover:border-line-strong focus:border-accent focus:bg-surface focus:outline-2 focus:outline-offset-0 focus:outline-accent/30",
          )}
        />
        {focused && query.trim().length > 0 && (
          <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(70vh,520px)] animate-fade-in overflow-y-auto rounded-xl border border-line bg-surface shadow-pop">
            <Results query={query} onPick={pick} />
          </div>
        )}
      </div>

      {/* Phone */}
      <IconButton label="Qidirish" className="size-9 md:hidden" onClick={() => setSheetOpen(true)}>
        <Search className="size-[18px]" aria-hidden />
      </IconButton>
      {sheetOpen && (
        <div role="dialog" aria-label="Qidirish" className="pt-safe fixed inset-0 z-50 flex flex-col bg-surface md:hidden">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSheetOpen(false);
              }}
              aria-label="Qidirish"
              placeholder="Xonadon, partiya, mahsulot…"
              autoComplete="off"
              maxLength={100}
              className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/70"
            />
            <IconButton label="Yopish" onClick={() => setSheetOpen(false)}>
              <X className="size-4" aria-hidden />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Results query={query} onPick={pick} />
          </div>
        </div>
      )}
    </>
  );
}
