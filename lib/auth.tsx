"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { api, ApiError, isAbortError, toApiError } from "./api";
import { markLoggedOut, session } from "./session";
import type { AuthResponse, User } from "./types";

export type AuthStatus = "loading" | "anonymous" | "authenticated" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  error: ApiError | null;
  /** Store tokens + user returned by /api/auth/login or /api/auth/telegram. */
  signIn: (auth: AuthResponse) => void;
  signOut: () => void;
  /** Re-load /api/auth/me (e.g. after the password was changed). */
  refreshUser: () => Promise<User | null>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface UserState {
  /** The refresh token the user was loaded for (stable for the whole session). */
  sessionKey: string | null;
  user: User | null;
  error: ApiError | null;
}

const EMPTY: UserState = { sessionKey: null, user: null, error: null };

/** undefined on the server / during hydration, then the refresh token or null. */
function useSessionKey(): string | null | undefined {
  return useSyncExternalStore<string | null | undefined>(
    session.subscribe,
    () => session.getRefresh(),
    () => undefined,
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionKey = useSessionKey();
  const [state, setState] = useState<UserState>(EMPTY);
  const [attempt, setAttempt] = useState(0);
  /** Session already populated by signIn: skip the redundant /me request. */
  const preloaded = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionKey || preloaded.current === sessionKey) return;
    const controller = new AbortController();
    api
      .get<User>("/auth/me", undefined, controller.signal)
      .then((user) => setState({ sessionKey, user, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState({ sessionKey, user: null, error: toApiError(error) });
      });
    return () => controller.abort();
  }, [sessionKey, attempt]);

  const signIn = useCallback((auth: AuthResponse) => {
    preloaded.current = auth.refresh;
    setState({ sessionKey: auth.refresh, user: auth.user, error: null });
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
    const user = await api.get<User>("/auth/me");
    preloaded.current = key;
    setState({ sessionKey: key, user, error: null });
    return user;
  }, []);

  const retry = useCallback(() => {
    preloaded.current = null;
    setState(EMPTY);
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus;
    let user: User | null = null;
    let error: ApiError | null = null;
    if (sessionKey === undefined) status = "loading";
    else if (sessionKey === null) status = "anonymous";
    else if (state.sessionKey !== sessionKey) status = "loading";
    else if (state.user) {
      status = "authenticated";
      user = state.user;
    } else if (state.error) {
      status = "error";
      error = state.error;
    } else status = "loading";
    return { status, user, error, signIn, signOut, refreshUser, retry };
  }, [sessionKey, state, signIn, signOut, refreshUser, retry]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** Narrowed accessor for pages rendered behind the route guard. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser used outside an authenticated route");
  return user;
}
