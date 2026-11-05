"use client";

import { useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { DetailResponse, TempPasswordResponse, User } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { TempPasswordModal } from "./user-modals";

export interface AccountRef {
  id: number;
  username: string;
  full_name: string;
}

interface AccountActions {
  resetPassword: (account: AccountRef) => void;
  unlinkTelegram: (account: AccountRef) => void;
  setActive: (account: AccountRef, active: boolean) => void;
  /** `POST /api/users/{id}/end-sessions` (V3 §2.4), optionally unlinking Telegram too. */
  endSessions: (account: AccountRef & { telegram_linked?: boolean }) => void;
  /** Render this once: the one-time temporary password dialog. */
  dialogs: ReactNode;
}

/**
 * ADMIN account operations (contract: /api/users/{id}/...), each behind a
 * confirmation. Lists refresh automatically after the mutation (dataRevision).
 */
export function useAccountActions(): AccountActions {
  const confirm = useConfirm();
  const toast = useToast();
  const [temp, setTemp] = useState<{ username: string; password: string } | null>(null);

  const resetPassword = (account: AccountRef) => {
    void confirm({
      title: "Parolni tiklash",
      confirmLabel: "Parolni tiklash",
      message: (
        <p>
          <strong>{account.full_name}</strong> uchun yangi vaqtinchalik parol yaratiladi. Eski parol ishlamay qoladi va
          birinchi kirishda parolni almashtirish so‘raladi.
        </p>
      ),
      onConfirm: async () => {
        const response = await api.post<TempPasswordResponse>(`/users/${account.id}/reset-password`);
        setTemp({ username: account.username, password: response.temp_password });
      },
    });
  };

  const unlinkTelegram = (account: AccountRef) => {
    void confirm({
      title: "Telegramni uzish",
      confirmLabel: "Uzish",
      tone: "danger",
      message: (
        <p>
          <strong>{account.full_name}</strong> Telegram akkauntidan uziladi va bildirishnomalar to‘xtaydi. Qayta
          bog‘lash uchun botda /start bosish kerak bo‘ladi.
        </p>
      ),
      onConfirm: async () => {
        const response = await api.post<DetailResponse>(`/users/${account.id}/unlink-telegram`);
        toast.success(response.detail || "Telegram uzildi");
      },
    });
  };

  const setActive = (account: AccountRef, active: boolean) => {
    void confirm({
      title: active ? "Hisobni faollashtirish" : "Hisobni bloklash",
      confirmLabel: active ? "Faollashtirish" : "Bloklash",
      tone: active ? "primary" : "danger",
      message: active ? (
        <p>
          <strong>{account.full_name}</strong> yana tizimga kira oladi.
        </p>
      ) : (
        <p>
          <strong>{account.full_name}</strong> tizimga va Web Appga kira olmaydi. Ma’lumotlari saqlanib qoladi.
        </p>
      ),
      onConfirm: async () => {
        await api.patch<User>(`/users/${account.id}`, { is_active: active });
        toast.success(active ? "Hisob faollashtirildi" : "Hisob bloklandi");
      },
    });
  };

  const endSessions = (account: AccountRef & { telegram_linked?: boolean }) => {
    const choice = { unlink: false };
    void confirm({
      title: "Sessiyalarni yakunlash",
      confirmLabel: "Yakunlash",
      tone: "danger",
      message: (
        <div className="flex flex-col gap-3">
          <p>
            <strong>{account.full_name}</strong> barcha brauzer va Web App sessiyalaridan darhol chiqariladi. Qayta
            kirish uchun login va parol kerak bo‘ladi.
          </p>
          {account.telegram_linked ? (
            <UnlinkChoice onChange={(value) => (choice.unlink = value)} />
          ) : null}
          <p className="text-[13px] text-muted">
            Eslatma: hozir ochiq Telegram Web App ham yopiladi, lekin Telegram uzilmasa bot va Telegram ichida qayta
            ochilgan Web App orqali kirish saqlanadi. To‘liq to‘xtatish uchun Telegramni ham uzing.
          </p>
        </div>
      ),
      onConfirm: async () => {
        const response = await api.post<DetailResponse>(`/users/${account.id}/end-sessions`, {
          unlink_telegram: choice.unlink,
        });
        toast.success(response.detail || "Barcha sessiyalar yakunlandi");
      },
    });
  };

  const dialogs = temp ? (
    <TempPasswordModal username={temp.username} password={temp.password} onClose={() => setTemp(null)} />
  ) : null;

  return { resetPassword, unlinkTelegram, setActive, endSessions, dialogs };
}

function UnlinkChoice({ onChange }: { onChange: (value: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-subtle px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          setChecked(event.target.checked);
          onChange(event.target.checked);
        }}
        className="mt-0.5 size-4 accent-[var(--color-danger)]"
      />
      <span className="text-sm">Telegramni ham uzish (bot orqali kirish ham to‘xtaydi)</span>
    </label>
  );
}
