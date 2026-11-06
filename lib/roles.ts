import type { LucideIcon } from "lucide-react";
import { ClipboardList, House, LayoutDashboard, Package, ScrollText, SquarePlus, Users, Warehouse, ListTodo } from "lucide-react";
import type { Me, Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Administrator",
  INSPECTOR: "Inspektor",
  HR: "HR",
  DIRECTOR: "Direktor",
  BUILDER: "Qurilish",
  WAREHOUSE: "Omborchi",
  INCUBATOR: "Inkubatsiya",
  LOGISTICS: "Logistika",
  VET: "Veterinar",
  OWNER: "Xonadon egasi",
  ACCOUNTANT: "Buxgalter",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[];
const STAFF: readonly Role[] = ALL_ROLES.filter((role) => role !== "OWNER");

export function roleLabel(role: string | undefined | null): string {
  return (role && ROLE_LABELS[role as Role]) || role || "—";
}

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  roles: readonly Role[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/tasks", label: "Mening vazifalarim", short: "Vazifalar", icon: ListTodo, roles: STAFF },
  { href: "/cases", label: "Xonadonlar", short: "Xonadonlar", icon: ClipboardList, roles: STAFF },
  { href: "/cases/new", label: "Yangi xonadon", short: "Yangi", icon: SquarePlus, roles: ["INSPECTOR", "ADMIN", "SUPERADMIN"] },
  { href: "/dashboard", label: "Boshqaruv paneli", short: "Panel", icon: LayoutDashboard, roles: ["SUPERADMIN", "ADMIN", "DIRECTOR", "HR"] },
  { href: "/warehouse", label: "Ombor", short: "Ombor", icon: Warehouse, roles: ["WAREHOUSE", "ADMIN", "SUPERADMIN"] },
  { href: "/packages", label: "Paketlar", short: "Paketlar", icon: Package, roles: ["ADMIN", "SUPERADMIN", "WAREHOUSE", "INSPECTOR"] },
  { href: "/users", label: "Foydalanuvchilar", short: "Xodimlar", icon: Users, roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/audit", label: "Audit jurnali", short: "Audit", icon: ScrollText, roles: ["SUPERADMIN"] },
  { href: "/my", label: "Mening xonadonim", short: "Xonadonim", icon: House, roles: ["OWNER"] },
];

/** Route prefix -> allowed roles; the longest matching prefix wins. */
const ROUTES: { prefix: string; roles: readonly Role[] }[] = [
  ...NAV_ITEMS.filter((item) => item.href !== "/packages").map((item) => ({ prefix: item.href, roles: item.roles })),
  // packages are readable by every staff role (the menu shows them only where useful)
  { prefix: "/packages", roles: STAFF },
  { prefix: "/change-password", roles: ALL_ROLES },
].sort((a, b) => b.prefix.length - a.prefix.length);

export function effectiveRole(user: Pick<Me, "role" | "is_superadmin">): Role {
  return user.is_superadmin ? "SUPERADMIN" : user.role;
}

export function navFor(user: Me): NavItem[] {
  const role = effectiveRole(user);
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccess(user: Me, pathname: string): boolean {
  const role = effectiveRole(user);
  // Owners open their own case from the bot button (`/cases/{id}`); the API limits it to their case.
  if (role === "OWNER" && /^\/cases\/\d+$/.test(pathname)) return true;
  const rule = ROUTES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule) return true;
  // `/cases/123` falls back to the `/cases` rule; `/cases/new` has its own.
  return rule.roles.includes(role);
}

export function homeFor(user: Me): string {
  return user.role === "OWNER" ? "/my" : "/tasks";
}

export function isAdmin(user: Me): boolean {
  const role = effectiveRole(user);
  return role === "ADMIN" || role === "SUPERADMIN";
}

/** `next=` must be a local path. */
export function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return null;
  return value;
}
