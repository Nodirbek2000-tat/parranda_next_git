"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { buildPath, dataRevision, errorMessage, isAbortError, requestUrl, type Query } from "./api";

export interface Resource<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

interface State<T> {
  key: string | null;
  data: T | undefined;
  error: string | null;
}

/** GET an endpoint into state; `null` path skips. Refetches after every successful write. */
export function useApi<T>(path: string | null, query?: Query): Resource<T> {
  const url = path === null ? null : buildPath(path, query);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>({ key: null, data: undefined, error: null });
  const revision = useSyncExternalStore(dataRevision.subscribe, dataRevision.get, () => 0);
  const key = url === null ? null : `${url}#${nonce}.${revision}`;

  useEffect(() => {
    if (url === null || key === null) return;
    const controller = new AbortController();
    requestUrl<T>(url, { signal: controller.signal })
      .then((data) => setState({ key, data, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState((prev) => ({ key, data: prev.data, error: errorMessage(error) }));
      });
    return () => controller.abort();
  }, [url, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return {
    data: state.data,
    error: state.key === key ? state.error : null,
    loading: key !== null && state.key !== key,
    reload,
  };
}

export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
