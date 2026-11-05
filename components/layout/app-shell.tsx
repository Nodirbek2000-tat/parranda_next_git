"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Ellipsis, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { homeFor, isActivePath, navGroups, navItemsFor, primaryItemsFor, type NavItem } from "@/lib/nav";
import { session } from "@/lib/session";
import { useCompanySettings } from "@/lib/use-settings";
import { IconButton } from "@/components/ui/button";
import { GlobalSearch } from "./global-search";
import { guardRedirect } from "./guard";
import { Logo, LogoMark } from "./logo";
import { NotificationBell } from "./notification-bell";
import { ShellSkeleton, SessionError } from "./shell-states";
import { UserMenu } from "./user-menu";

const LOGOUT_TIMEOUT_MS = 4000;

/**
 * `POST /api/auth/logout` (V3 §2.3) before the local sign-out. Logging out always succeeds
 * locally, even when the server cannot be reached; a slow server never blocks it for long.
 */
async function serverLogout(all: boolean): Promise<void> {
  const refresh = session.getRefresh();
  const call = api.post("/auth/logout", { refresh: refresh ?? "", all }, { silent: true });
  if (all) {
    await call; // "end every session" must really reach the server: errors are shown by the caller
    return;
  }
  await Promise.race([call.catch(() => undefined), new Promise((resolve) => window.setTimeout(resolve, LOGOUT_TIMEOUT_MS))]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, error, retry, signOut } = useAuth();
  // After an explicit logout go to a clean /login (no ?next= back to this page).
  // The layout can stay mounted (hidden) across navigations, so the flag only
  // applies until the next sign-in.
  const [signedOut, setSignedOut] = useState(false);
  const redirect = signedOut && status !== "authenticated" ? "/login" : guardRedirect(status, user, pathname);

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (status === "error" && error) return <SessionError error={error} onRetry={retry} onSignOut={signOut} />;
  if (!user || redirect) return <ShellSkeleton />;

  const items = navItemsFor(user);
  const groups = navGroups(items);
  const handleSignOut = async (all = false) => {
    await serverLogout(all);
    setSignedOut(true);
    signOut();
  };

  return (
    <div className="min-h-app lg:pl-64">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Asosiy mazmunga o‘tish
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <Link
          href={homeFor(user.role)}
          className="flex h-16 items-center border-b border-line px-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <ShellLogo />
        </Link>
        <nav aria-label="Asosiy menyu" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {groups.work.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={isActivePath(pathname, item.href, items)} />
              </li>
            ))}
          </ul>
          {groups.config.length > 0 && (
            <>
              <h2 id="nav-config-heading" className="mt-6 px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted/80">
                Sozlash
              </h2>
              <ul aria-labelledby="nav-config-heading" className="flex flex-col gap-1">
                {groups.config.map((item) => (
                  <li key={item.href}>
                    <SidebarLink item={item} active={isActivePath(pathname, item.href, items)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>
        <p className="border-t border-line px-5 py-4 text-xs leading-relaxed text-muted">
          © NNP
          <br />
          Navobod naslli parranda qisqarmasi
        </p>
      </aside>

      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
          <Link href={homeFor(user.role)} className="flex items-center gap-2 rounded-lg lg:hidden" aria-label="Bosh sahifa">
            <LogoMark className="size-8" />
            <span className="text-sm font-semibold tracking-wide text-ink">NNP</span>
          </Link>
          <div className="hidden min-w-0 flex-1 md:flex">
            <GlobalSearch />
          </div>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <span className="md:hidden">
              <GlobalSearch />
            </span>
            <NotificationBell />
            <UserMenu user={user} onSignOut={handleSignOut} />
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full min-w-0 max-w-7xl px-4 py-5 outline-none sm:px-6 sm:py-6 lg:px-8 lg:py-8",
          items.length > 1 ? "pb-[calc(6rem+var(--safe-bottom))] lg:pb-12" : "pb-[calc(2.5rem+var(--safe-bottom))]",
        )}
      >
        {children}
      </main>

      {items.length > 1 && <BottomNav items={items} primary={primaryItemsFor(user, items)} pathname={pathname} />}
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent",
        active ? "bg-accent-soft font-medium text-primary" : "text-muted hover:bg-subtle hover:text-ink",
      )}
    >
      <Icon className={cn("size-4.5 shrink-0", active ? "text-accent" : "")} aria-hidden />
      {item.label}
    </Link>
  );
}

/** Sidebar logo with the company name from `/api/settings` (falls back to the built-in name). */
function ShellLogo() {
  const settings = useCompanySettings();
  return <Logo name={settings?.short_name} subtitle={settings?.company_name} />;
}

/** Phone bottom bar: up to 5 slots; extra sections open in the "Yana" sheet. */
function BottomNav({ items, primary, pathname }: { items: NavItem[]; primary: NavItem[]; pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const overflow = items.length > 5;
  const visible = overflow ? primary : items;
  const rest = overflow ? items.filter((item) => !visible.includes(item)) : [];
  const restActive = rest.some((item) => isActivePath(pathname, item.href, items));

  return (
    <>
      <nav
        aria-label="Asosiy menyu"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/90 lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl">
          {visible.map((item) => (
            <li key={item.href} className="min-w-0 flex-1">
              <BottomNavLink item={item} active={isActivePath(pathname, item.href, items)} />
            </li>
          ))}
          {rest.length > 0 && (
            <li className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className={cn(BOTTOM_ITEM, restActive ? "font-medium text-primary" : "text-muted")}
              >
                <span className={cn(BOTTOM_ICON, restActive && "bg-accent-soft text-accent")}>
                  <Ellipsis className="size-[18px]" aria-hidden />
                </span>
                <span className="max-w-full truncate">Yana</span>
              </button>
            </li>
          )}
        </ul>
      </nav>
      {moreOpen && <MoreSheet items={rest} allItems={items} pathname={pathname} onClose={() => setMoreOpen(false)} />}
    </>
  );
}

const BOTTOM_ITEM =
  "flex h-16 w-full flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-none transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
const BOTTOM_ICON = "flex h-7 w-12 items-center justify-center rounded-full transition-colors";

function BottomNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(BOTTOM_ITEM, active ? "font-medium text-primary" : "text-muted")}
    >
      <span className={cn(BOTTOM_ICON, active && "bg-accent-soft text-accent")}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="max-w-full truncate">{item.shortLabel}</span>
    </Link>
  );
}

/** Bottom sheet (native <dialog>: focus trap, Esc) with the remaining sections. */
function MoreSheet({
  items,
  allItems,
  pathname,
  onClose,
}: {
  items: NavItem[];
  allItems: NavItem[];
  pathname: string;
  onClose: () => void;
}) {
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
      aria-label="Boshqa bo‘limlar"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="pb-safe mb-0 mt-auto w-full max-w-none animate-sheet-in rounded-t-2xl border-t border-line bg-surface p-0 text-ink shadow-pop"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="text-[15px] font-semibold">Boshqa bo‘limlar</p>
        <IconButton label="Yopish" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </IconButton>
      </div>
      <ul className="grid grid-cols-2 gap-2 px-4 pb-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href, allItems);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 items-center gap-3 rounded-xl border px-3 text-sm transition-colors",
                  active ? "border-accent/30 bg-accent-soft font-medium text-primary" : "border-line text-ink hover:bg-subtle",
                )}
              >
                <Icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-muted")} aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
