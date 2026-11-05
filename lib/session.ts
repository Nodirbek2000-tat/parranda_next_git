/**
 * JWT storage in localStorage (`nnp_access`, `nnp_refresh`) exposed as a tiny
 * external store so React can subscribe with useSyncExternalStore.
 */

const ACCESS_KEY = "nnp_access";
const REFRESH_KEY = "nnp_refresh";
const LOGGED_OUT_KEY = "nnp_logged_out";

type Listener = () => void;
const listeners = new Set<Listener>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the session then lives only in memory.
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

export const session = {
  getAccess(): string | null {
    return read(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return read(REFRESH_KEY);
  },
  setTokens(access: string, refresh: string): void {
    write(ACCESS_KEY, access);
    write(REFRESH_KEY, refresh);
    clearLoggedOutFlag();
    emit();
  },
  setAccess(access: string): void {
    write(ACCESS_KEY, access);
  },
  clear(): void {
    write(ACCESS_KEY, null);
    write(REFRESH_KEY, null);
    emit();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === ACCESS_KEY || event.key === REFRESH_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

/**
 * After an explicit logout inside Telegram we must not log the user straight
 * back in with initData; this per-tab flag suppresses one automatic attempt.
 */
export function markLoggedOut(): void {
  try {
    window.sessionStorage.setItem(LOGGED_OUT_KEY, "1");
  } catch {
    // ignore
  }
}

export function wasLoggedOut(): boolean {
  try {
    return window.sessionStorage.getItem(LOGGED_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function clearLoggedOutFlag(): void {
  try {
    window.sessionStorage.removeItem(LOGGED_OUT_KEY);
  } catch {
    // ignore
  }
}
