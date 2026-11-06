"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { api, ApiError, isAbortError } from "./api";
import { markLoggedOut, session } from "./session";
import type { AuthResponse, Me } from "./types";

export type AuthStatus = "loading" | "anonymous" | "authenticated" | "error";

interface AuthValue {
  status: AuthStatus;
  user: Me | null;
  error: string | null;
  signIn: (auth: AuthResponse) => void;
  signOut: () => void;
  refreshUser: () => Promise<Me | null>;
  retry: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

interface UserState {
  key: string | null;
  user: Me | null;
  error: string | null;
}

const EMPTY: UserState = { key: null, user: null, error: null };

/** undefined during SSR/hydration, then the refresh token or null. */
function useSessionKey(): string | null | undefined {
  return useSyncExternalStore<string | null | undefined>(session.subscribe, () => session.getRefresh(), () => undefined);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionKey = useSessionKey();
  const [state, setState] = useState<UserState>(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const preloaded = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionKey || preloaded.current === sessionKey) return;
    const controller = new AbortController();
    api
      .get<Me>("/auth/me", undefined, controller.signal)
      .then((user) => setState({ key: sessionKey, user, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState({ key: sessionKey, user: null, error: error instanceof ApiError ? error.message : "Server bilan aloqa yo‘q." });
      });
    return () => controller.abort();
  }, [sessionKey, attempt]);

  const signIn = useCallback((auth: AuthResponse) => {
    preloaded.current = auth.refresh;
    setState({ key: auth.refresh, user: auth.user, error: null });
    session.setTokens(auth.access, auth.refresh);
  }, []);

  const signOut = useCallback(() => {
    preloaded.current = null;
    markLoggedOut();
    setState(EMPTY);
    session.clear();
  }, []);

  const refreshUser = useCallback(async () => {
    const key = session.getRefresh();
    if (!key) return null;
    const user = await api.get<Me>("/auth/me");
    preloaded.current = key;
    setState({ key, user, error: null });
    return user;
  }, []);

  const retry = useCallback(() => {
    preloaded.current = null;
    setState(EMPTY);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<AuthValue>(() => {
    let status: AuthStatus = "loading";
    let user: Me | null = null;
    let error: string | null = null;
    if (sessionKey === undefined) status = "loading";
    else if (sessionKey === null) status = "anonymous";
    else if (state.key !== sessionKey) status = "loading";
    else if (state.user) {
      status = "authenticated";
      user = state.user;
    } else if (state.error) {
      status = "error";
      error = state.error;
    }
    return { status, user, error, signIn, signOut, refreshUser, retry };
  }, [sessionKey, state, signIn, signOut, refreshUser, retry]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** For pages behind the shell guard. */
export function useMe(): Me {
  const { user } = useAuth();
  if (!user) throw new Error("useMe outside an authenticated route");
  return user;
}
