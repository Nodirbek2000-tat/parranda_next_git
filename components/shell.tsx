"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { KeyRound, LogOut, Menu, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth, type AuthStatus } from "@/lib/auth";
import { session } from "@/lib/session";
import { cn } from "@/lib/cn";
import { canAccess, homeFor, navFor, roleLabel, type NavItem } from "@/lib/roles";
import type { Me } from "@/lib/types";
import { Alert, Button, IconButton, Spinner } from "./ui";

export const BRAND = "Navobod naslli parranda";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9 shrink-0", className)} role="img" aria-label="NNP">
      <rect width="40" height="40" rx="10" fill="#FFFFFF" />
      <path d="M23 12.5c-.8-2.6.6-5 2.9-5.3.4-2.4 3-3.6 5-2.3 1.8-1.2 4.4-.2 4.6 2.2 2 .6 2.6 3.2 1 4.8-.5 2.2-2.4 3.4-4.4 3.1z" fill="#E3262B" />
      <text x="18.5" y="29" textAnchor="middle" fontSize="14" fontWeight="800" letterSpacing="-0.3" fill="#1F6FB5" fontFamily="Arial, sans-serif">
        NNP
      </text>
    </svg>
  );
}

/** Where the protected area must send the visitor, or null to render. */
function guardRedirect(status: AuthStatus, user: Me | null, pathname: string): string | null {
  if (status === "anonymous") return `/login?next=${encodeURIComponent(pathname)}`;
  if (status !== "authenticated" || !user) return null;
  if (user.must_change_password) return "/change-password";
  if (!canAccess(user, pathname)) return homeFor(user);
  return null;
}

function isActive(pathname: string, href: string, items: NavItem[]): boolean {
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false;
  // the longest matching menu item wins (`/cases/new` over `/cases`)
  return !items.some((other) => other.href.length > href.length && (pathname === other.href || pathname.startsWith(`${other.href}/`)));
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, error, retry, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const redirect = leaving && status !== "authenticated" ? "/login" : guardRedirect(status, user, pathname);

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (status === "error" && error) {
    return (
      <main className="mx-auto flex min-h-app max-w-sm flex-col justify-center gap-4 px-4">
        <Alert>{error}</Alert>
        <div className="flex gap-2">
          <Button onClick={retry}>Qayta urinish</Button>
          <Button variant="secondary" onClick={signOut}>
            Chiqish
          </Button>
        </div>
      </main>
    );
  }
  if (!user || redirect) return <Spinner className="min-h-app" />;

  const items = navFor(user);
  const logout = () => {
    // Blacklist the refresh token on the server (best effort), then clear the local session.
    const refresh = session.getRefresh();
    if (refresh) void api.post("/auth/logout", { refresh }).catch(() => undefined);
    setLeaving(true);
    signOut();
  };

  return (
    <div className="min-h-app lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-primary text-white lg:flex">
        <Link href={homeFor(user)} className="flex h-16 items-center gap-3 px-5">
          <LogoMark className="size-8 ring-1 ring-white/20 rounded-[10px]" />
          <span className="leading-tight">
            <span className="block text-sm font-semibold">NNP</span>
            <span className="block text-xs text-white/60">{BRAND}</span>
          </span>
        </Link>
        <nav aria-label="Asosiy menyu" className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href, items);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                      active ? "bg-white/12 font-medium text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-3">
          <p className="truncate px-2 text-sm font-medium">{user.full_name || user.username}</p>
          <p className="truncate px-2 text-xs text-white/60">{user.role_display || roleLabel(user.role)}</p>
          <div className="mt-2 flex gap-1">
            <Link href="/change-password" className="flex h-9 flex-1 items-center gap-2 rounded-lg px-2 text-xs text-white/70 hover:bg-white/8 hover:text-white">
              <KeyRound className="size-4" aria-hidden /> Parol
            </Link>
            <button type="button" onClick={logout} className="flex h-9 flex-1 items-center gap-2 rounded-lg px-2 text-xs text-white/70 hover:bg-white/8 hover:text-white">
              <LogOut className="size-4" aria-hidden /> Chiqish
            </button>
          </div>
        </div>
      </aside>

      <header className="pt-safe sticky top-0 z-20 bg-primary text-white lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href={homeFor(user)} className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="size-8 rounded-[10px] ring-1 ring-white/20" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{user.full_name || user.username}</span>
              <span className="block truncate text-xs text-white/60">{user.role_display || roleLabel(user.role)}</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-5xl px-4 py-4 pb-[calc(6rem+var(--safe-bottom))] sm:px-6 lg:px-8 lg:py-8 lg:pb-12">{children}</main>

      <BottomNav items={items} pathname={pathname} user={user} onLogout={logout} />
    </div>
  );
}

const BOTTOM_ITEM = "flex h-16 w-full flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-none";

function BottomNav({ items, pathname, user, onLogout }: { items: NavItem[]; pathname: string; user: Me; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const visible = items.slice(0, 4);
  return (
    <>
      <nav aria-label="Asosiy menyu" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
        <ul className="mx-auto flex max-w-xl">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href, items);
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(BOTTOM_ITEM, active ? "font-semibold text-primary" : "text-muted")}>
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-accent-soft text-accent")}>
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="max-w-full truncate">{item.short}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button type="button" onClick={() => setOpen(true)} className={cn(BOTTOM_ITEM, "text-muted")} aria-haspopup="dialog">
              <span className="flex h-7 w-12 items-center justify-center rounded-full">
                <Menu className="size-[18px]" aria-hidden />
              </span>
              Menyu
            </button>
          </li>
        </ul>
      </nav>
      {open && <MenuSheet items={items} pathname={pathname} user={user} onLogout={onLogout} onClose={() => setOpen(false)} />}
    </>
  );
}

function MenuSheet({ items, pathname, user, onLogout, onClose }: { items: NavItem[]; pathname: string; user: Me; onLogout: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label="Menyu"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="pb-safe mb-0 mt-auto w-full max-w-none animate-sheet-in rounded-t-2xl bg-surface p-0 text-ink shadow-pop"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{user.full_name || user.username}</p>
          <p className="text-xs text-muted">
            {user.role_display || roleLabel(user.role)} · {user.username}
          </p>
        </div>
        <IconButton label="Yopish" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </IconButton>
      </div>
      <ul className="grid grid-cols-2 gap-2 px-4 pb-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href, items);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className={cn("flex h-14 items-center gap-3 rounded-xl border px-3 text-sm", active ? "border-accent/30 bg-accent-soft font-medium text-primary" : "border-line")}
              >
                <Icon className="size-[18px] shrink-0 text-accent" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 border-t border-line px-4 py-3">
        <Link href="/change-password" onClick={onClose} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-sm">
          <KeyRound className="size-4" aria-hidden /> Parolni almashtirish
        </Link>
        <button type="button" onClick={onLogout} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-danger-soft text-sm font-medium text-danger">
          <LogOut className="size-4" aria-hidden /> Chiqish
        </button>
      </div>
    </dialog>
  );
}
