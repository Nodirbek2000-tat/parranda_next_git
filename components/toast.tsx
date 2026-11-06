"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

interface ToastItem {
  id: number;
  tone: "success" | "error";
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((item) => item.id !== id)), []);

  const push = useCallback(
    (tone: ToastItem["tone"], message: string) => {
      counter.current += 1;
      const id = counter.current;
      setItems((list) => [...list.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastApi>(() => ({ success: (m) => push("success", m), error: (m) => push("error", m) }), [push]);

  return (
    <ToastContext value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+var(--safe-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
        {items.map((item) => {
          const Icon = item.tone === "success" ? CircleCheck : CircleAlert;
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl bg-primary px-4 py-3 text-sm text-white shadow-pop"
            >
              <Icon className={item.tone === "success" ? "mt-0.5 size-4 shrink-0 text-accent-soft" : "mt-0.5 size-4 shrink-0 text-warning"} aria-hidden />
              <p className="min-w-0 flex-1 whitespace-pre-line">{item.message}</p>
              <button type="button" onClick={() => dismiss(item.id)} aria-label="Yopish" className="-mr-1 rounded p-0.5 text-white/70 hover:text-white">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast outside <ToastProvider>");
  return context;
}
