"use client";

import type { ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/components/toast";
import { api } from "./api";

export interface DeleteRequest {
  /** "Xonadonni o‘chirish" */
  title: string;
  /** What exactly is deleted, shown in the first dialog. */
  what: ReactNode;
  /** API path, e.g. `/cases/12`. */
  path: string;
  /** Toast after success. */
  done: string;
  /** Runs after a successful delete (navigate away, close a modal …). */
  after?: () => void;
}

/**
 * Two-step delete used everywhere: 1) "…ni o‘chirish" 2) "Rostdan ham o‘chirasizmi?".
 * The API error (403 / 409 with an Uzbek `detail`) stays inside the second dialog.
 * Lists refresh by themselves (every successful write bumps the data revision).
 */
export function useDelete() {
  const confirm = useConfirm();
  const toast = useToast();
  return async ({ title, what, path, done, after }: DeleteRequest) => {
    const first = await confirm({
      title,
      message: what,
      confirmLabel: "Davom etish",
      tone: "danger",
      onConfirm: async () => undefined,
    });
    if (!first) return;
    const second = await confirm({
      title: "Rostdan ham o‘chirasizmi?",
      message: "O‘chirilgan yozuv ro‘yxatlardan butunlay yo‘qoladi. Eski tarix saqlanib qoladi.",
      confirmLabel: "Ha, butunlay o‘chirish",
      tone: "danger",
      onConfirm: async () => {
        await api.delete(path);
        toast.success(done);
      },
    });
    if (second) after?.();
  };
}
