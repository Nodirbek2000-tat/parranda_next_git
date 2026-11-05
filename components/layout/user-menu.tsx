"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials, userRoleLabel } from "@/lib/format";
import type { User } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm";

const ITEM =
  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-ink transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

/**
 * Account menu (V3 §15.2): change password, "Chiqish" (logout of this device) and
 * "Barcha qurilmalardan chiqish" (all sessions, with a confirm dialog).
 */
export function UserMenu({ user, onSignOut }: { user: User; onSignOut: (all?: boolean) => Promise<void> }) {
  const confirm = useConfirm();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOutHere = async () => {
    setOpen(false);
    setLeaving(true);
    await onSignOut(false);
  };

  const signOutEverywhere = () => {
    setOpen(false);
    void confirm({
      title: "Barcha qurilmalardan chiqish",
      message:
        "Bu hisob bilan ochilgan barcha brauzer va Telegram Web App sessiyalari darhol yakunlanadi. Qayta kirish uchun login va parol kerak bo‘ladi.",
      confirmLabel: "Hammasidan chiqish",
      tone: "danger",
      onConfirm: () => onSignOut(true),
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={leaving}
        className="flex min-w-0 items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:pl-2"
      >
        <span className="hidden min-w-0 text-right leading-tight sm:block">
          <span className="block max-w-40 truncate text-sm font-medium text-ink">{user.full_name}</span>
          <span className="block truncate text-xs text-muted">{userRoleLabel(user)}</span>
        </span>
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            user.is_super_admin ? "bg-primary text-white" : "bg-accent-soft text-accent",
          )}
        >
          {initials(user.full_name)}
        </span>
        <ChevronDown className="hidden size-3.5 text-muted sm:block" aria-hidden />
        <span className="sr-only">Hisob menyusi</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 animate-fade-in rounded-xl border border-line bg-surface p-1.5 shadow-pop"
        >
          <div className="border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-medium text-ink">{user.full_name}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted">
              {user.is_super_admin && <ShieldCheck className="size-3.5 text-accent" aria-hidden />}
              {userRoleLabel(user)} · {user.username}
            </p>
          </div>
          <div className="flex flex-col gap-0.5 pt-1.5">
            <Link href="/change-password" role="menuitem" className={ITEM} onClick={() => setOpen(false)}>
              <KeyRound className="size-4 text-muted" aria-hidden />
              Parolni almashtirish
            </Link>
            <button type="button" role="menuitem" className={ITEM} onClick={signOutHere}>
              <LogOut className="size-4 text-muted" aria-hidden />
              Chiqish
            </button>
            <button type="button" role="menuitem" className={cn(ITEM, "text-danger hover:bg-danger-soft")} onClick={signOutEverywhere}>
              <MonitorSmartphone className="size-4" aria-hidden />
              Barcha qurilmalardan chiqish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
