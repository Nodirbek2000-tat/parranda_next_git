"use client";

import { useSyncExternalStore } from "react";

/** The subset of Telegram.WebApp used by this app. */
interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  isVersionAtLeast?: (version: string) => boolean;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
    /** Bridge injected by the native Telegram clients (Android, iOS, macOS, Desktop). */
    TelegramWebviewProxy?: unknown;
  }
}

export const TELEGRAM_SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js";

export interface TelegramState {
  /** The script finished loading (or failed); `initData` is final. */
  loaded: boolean;
  /** Raw initData; empty outside Telegram. */
  initData: string;
  /**
   * The page runs inside a Telegram client. Only then may initData be used
   * without a click: in an ordinary browser it can come from a link crafted by
   * someone else (`#tgWebAppData=<their initData>`), which would silently sign
   * the visitor into that person's account (login CSRF).
   */
  insideTelegram: boolean;
}

/** Display name of the Telegram user in initData (unverified, for labels only). */
export function telegramUserLabel(initData: string): string | null {
  try {
    const raw = new URLSearchParams(initData).get("user");
    if (!raw) return null;
    const user = JSON.parse(raw) as { first_name?: unknown; last_name?: unknown; username?: unknown };
    if (typeof user.username === "string" && user.username) return `@${user.username}`;
    const name = [user.first_name, user.last_name].filter((part) => typeof part === "string" && part).join(" ");
    return name || null;
  } catch {
    return null;
  }
}

/**
 * Native clients inject TelegramWebviewProxy before any page script runs;
 * Telegram Web embeds the app in an iframe (next.config.ts only allows
 * Telegram Web to frame this app, so a foreign page cannot fake this).
 */
function detectTelegramHost(): boolean {
  return window.TelegramWebviewProxy !== undefined || window.parent !== window;
}

/**
 * Telegram passes the signed launch data in the URL hash (`#tgWebAppData=...`).
 * A bot button opens a deep link such as `/my` or `/households/5`; for a new
 * session the route guard redirects to /login, which drops the hash, usually
 * before the SDK script (loaded after hydration) has read it. This module is
 * evaluated before hydration, so the launch data is captured here and used
 * when the SDK reports an empty `initData`.
 */
const launchInitData: string = (() => {
  if (typeof window === "undefined") return "";
  try {
    return new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData") ?? "";
  } catch {
    return "";
  }
})();

const PENDING: TelegramState = { loaded: false, initData: "", insideTelegram: false };
let state: TelegramState = PENDING;
const listeners = new Set<() => void>();

function setState(next: TelegramState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Called from the <Script> onReady / onError handlers. */
export function initTelegram(): void {
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    try {
      webApp.ready();
      webApp.expand();
      // Hex colours are accepted since Bot API 6.9; older clients only log a warning.
      if (webApp.isVersionAtLeast?.("6.9")) {
        webApp.setHeaderColor?.("#FFFFFF");
        webApp.setBackgroundColor?.("#F3F5F2");
      }
    } catch {
      // Older Telegram clients may not support every method.
    }
  }
  setState({ loaded: true, initData: webApp?.initData || launchInitData, insideTelegram: detectTelegramHost() });
}

export function telegramUnavailable(): void {
  setState({ loaded: true, initData: launchInitData, insideTelegram: detectTelegramHost() });
}

export function useTelegram(): TelegramState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => PENDING,
  );
}
