"use client";

import Script from "next/script";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { initTelegram, TELEGRAM_SCRIPT_SRC, telegramUnavailable } from "@/lib/telegram";
import { ConfirmProvider } from "./confirm";
import { ToastProvider } from "./toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </AuthProvider>
      {/* Telegram Web App SDK: ready() + expand(); initData drives auto-login. */}
      <Script src={TELEGRAM_SCRIPT_SRC} strategy="afterInteractive" onReady={initTelegram} onError={telegramUnavailable} />
    </ToastProvider>
  );
}
