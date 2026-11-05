"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ApiError, buildPath, dataRevision, isAbortError, requestUrl, toApiError, type Query } from "./api";
import type { Paginated } from "./types";

export interface ApiResource<T> {
  /** Latest successful data (kept while a refetch or filter change is loading). */
  data: T | undefined;
  /** Error of the latest request; may be set while older `data` is still shown. */
  error: ApiError | null;
  /** A request for the current key is in flight. */
  loading: boolean;
  reload: () => void;
}

interface ResourceState<T> {
  key: string | null;
  data: T | undefined;
  error: ApiError | null;
}

type Loader<T> = (url: string, signal: AbortSignal) => Promise<T>;

const loadOne = <T,>(url: string, signal: AbortSignal): Promise<T> => requestUrl<T>(url, { signal });

/**
 * Shared state machine: `url` identifies the data, `load` fetches it. Refetches
 * on reload() and after every successful mutation (dataRevision in api.ts).
 */
function useResource<T>(url: string | null, load: Loader<T>): ApiResource<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({ key: null, data: undefined, error: null });
  const revision = useSyncExternalStore(dataRevision.subscribe, dataRevision.get, () => 0);
  const requestKey = url === null ? null : `${url}#${nonce}.${revision}`;

  useEffect(() => {
    if (url === null || requestKey === null) return;
    const controller = new AbortController();
    load(url, controller.signal)
      .then((data) => setState({ key: requestKey, data, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState((previous) => ({ key: requestKey, data: previous.data, error: toApiError(error) }));
      });
    return () => controller.abort();
  }, [url, requestKey, load]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return {
    data: state.data,
    error: state.key === requestKey ? state.error : null,
    loading: requestKey !== null && state.key !== requestKey,
    reload,
  };
}

/**
 * GET a contract endpoint and keep it in component state.
 * Pass `null` as path to skip the request. Changing `query` refetches.
 */
export function useApi<T>(path: string | null, query?: Query): ApiResource<T> {
  return useResource<T>(path === null ? null : buildPath(path, query), loadOne);
}

export interface PagedResource<T> extends ApiResource<Paginated<T>> {
  page: number;
  setPage: (page: number) => void;
}

/**
 * A paginated list with its page number. When the current page stops existing
 * (a mutation removed its last rows, so the refetch answers 404 "Sahifa
 * topilmadi"), the list steps back a page instead of showing stale rows.
 */
export function usePagedApi<T>(path: string, query: Query, pageSize: number): PagedResource<T> {
  const [page, setPage] = useState(1);
  const resource = useApi<Paginated<T>>(path, { ...query, page, page_size: pageSize });
  if (page > 1 && resource.error?.status === 404) {
    // Adjusting state while rendering (React re-renders before committing).
    setPage(page - 1);
  }
  return { ...resource, page, setPage };
}

/** Largest page the contract allows. */
export const MAX_PAGE_SIZE = 200;
/** Safety stop for select boxes: 50 pages × 200 rows. */
const MAX_PAGES = 50;

async function loadAllPages<T>(firstPageUrl: string, signal: AbortSignal): Promise<Paginated<T>> {
  const results: T[] = [];
  let count = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${firstPageUrl}${firstPageUrl.includes("?") ? "&" : "?"}page=${page}`;
    const chunk = await requestUrl<Paginated<T>>(url, { signal });
    results.push(...chunk.results);
    count = chunk.count;
    if (!chunk.next) break;
  }
  return { count, next: null, previous: null, results };
}

/**
 * Every row of a paginated endpoint (all pages, 200 rows per request), for
 * select boxes that must offer each record, not just the first page.
 */
export function useAllPages<T>(path: string | null, query?: Query): ApiResource<Paginated<T>> {
  const url = path === null ? null : buildPath(path, { ...query, page_size: MAX_PAGE_SIZE });
  return useResource<Paginated<T>>(url, loadAllPages);
}

/** Debounced copy of a value (for search inputs). */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
