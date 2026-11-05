import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Bird,
  Car,
  ChartLine,
  ClipboardCheck,
  FileSpreadsheet,
  House,
  IdCard,
  LayoutDashboard,
  Map,
  MessageSquareHeart,
  ScrollText,
  Settings,
  ShoppingCart,
  Stethoscope,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import type { Role } from "./types";

export interface NavItem {
  href: string;
  label: string;
  /** Compact label for the mobile bottom navigation. */
  shortLabel: string;
  icon: LucideIcon;
  roles: readonly Role[];
  /** Roles for which the item sits directly in the phone bottom bar (≤ 4 + "Yana"). */
  primaryFor?: readonly Role[];
  /** Shown / allowed only for the Super Admin (`user.is_super_admin`). */
  superOnly?: boolean;
}

/** The minimal user shape navigation needs (the full `User` fits). */
export interface NavUser {
  role: Role;
  is_super_admin?: boolean;
}

const A: Role = "ADMIN";
const W: Role = "WAREHOUSE";
const L: Role = "LOGISTICS";
const V: Role = "VET";
const O: Role = "OWNER";
const ALL: readonly Role[] = [A, W, L, V, O];

/** API_CONTRACT_V3 §15.1 — order = sidebar order. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Boshqaruv paneli", shortLabel: "Panel", icon: LayoutDashboard, roles: [A, W], primaryFor: [A, W] },
  { href: "/stats", label: "Statistika", shortLabel: "Statistika", icon: ChartLine, roles: [A, W] },
  { href: "/households", label: "Xonadonlar", shortLabel: "Xonadonlar", icon: House, roles: [A, W, V], primaryFor: [W] },
  { href: "/batches", label: "Partiyalar", shortLabel: "Partiyalar", icon: Bird, roles: [A, W] },
  { href: "/warehouse", label: "Ombor", shortLabel: "Ombor", icon: Warehouse, roles: [A, W], primaryFor: [A, W] },
  { href: "/warehouse/inventory", label: "Inventarizatsiya", shortLabel: "Inventar", icon: ClipboardCheck, roles: [A, W] },
  { href: "/orders", label: "Buyurtmalar", shortLabel: "Buyurtmalar", icon: ShoppingCart, roles: [A, W], primaryFor: [A] },
  { href: "/logistics", label: "Logistika", shortLabel: "Logistika", icon: Truck, roles: [A, W, L], primaryFor: [A, L] },
  { href: "/logistics/vehicles", label: "Transport", shortLabel: "Transport", icon: Car, roles: [A, L], primaryFor: [L] },
  { href: "/logistics/drivers", label: "Haydovchilar", shortLabel: "Haydovchilar", icon: IdCard, roles: [A, L], primaryFor: [L] },
  { href: "/vet", label: "Veterinariya", shortLabel: "Vet", icon: Stethoscope, roles: [A, V], primaryFor: [V] },
  { href: "/vet/requests", label: "Murojaatlar", shortLabel: "Murojaatlar", icon: MessageSquareHeart, roles: [A, V], primaryFor: [V] },
  { href: "/reports", label: "Hisobotlar", shortLabel: "Hisobotlar", icon: FileSpreadsheet, roles: ALL },
  { href: "/map", label: "Xarita", shortLabel: "Xarita", icon: Map, roles: [A, W, V], primaryFor: [V] },
  { href: "/users", label: "Xodimlar", shortLabel: "Xodimlar", icon: Users, roles: [A] },
  { href: "/notifications", label: "Bildirishnomalar", shortLabel: "Xabarlar", icon: BellRing, roles: [A] },
  { href: "/audit", label: "Audit jurnali", shortLabel: "Audit", icon: ScrollText, roles: [A] },
  { href: "/settings", label: "Sozlamalar", shortLabel: "Sozlamalar", icon: Settings, roles: [A], superOnly: true },
  { href: "/my", label: "Mening xonadonim", shortLabel: "Xonadonim", icon: House, roles: [O], primaryFor: [O] },
  { href: "/my/orders", label: "Buyurtmalarim", shortLabel: "Buyurtma", icon: ShoppingCart, roles: [O], primaryFor: [O] },
  { href: "/my/deliveries", label: "Yetkazib berishlar", shortLabel: "Yetkazish", icon: Truck, roles: [O], primaryFor: [O] },
  { href: "/my/vet", label: "Veterinar", shortLabel: "Veterinar", icon: Stethoscope, roles: [O], primaryFor: [O] },
];

interface RouteRule {
  prefix: string;
  roles: readonly Role[];
  superOnly?: boolean;
}

/**
 * Route prefix -> roles allowed, derived from NAV_ITEMS. The LONGEST matching prefix wins
 * (`/warehouse/inventory` before `/warehouse`, `/logistics/vehicles` before `/logistics`,
 * `/vet/requests` before `/vet`, `/my/orders` before `/my`); detail routes inherit their prefix.
 */
const ROUTE_ACCESS: readonly RouteRule[] = [
  ...NAV_ITEMS.map((item) => ({ prefix: item.href, roles: item.roles, superOnly: item.superOnly })),
  // Detail routes without their own menu item.
  { prefix: "/vet/visits", roles: [A, V] },
  { prefix: "/change-password", roles: ALL },
].sort((a, b) => b.prefix.length - a.prefix.length);

function hasRole(user: NavUser, item: { roles: readonly Role[]; superOnly?: boolean }): boolean {
  if (!item.roles.includes(user.role)) return false;
  return !item.superOnly || Boolean(user.is_super_admin);
}

export function navItemsFor(user: NavUser): NavItem[] {
  return NAV_ITEMS.filter((item) => hasRole(user, item));
}

/** Items shown directly in the phone bottom bar (max 4; the rest go under "Yana"). */
export function primaryItemsFor(user: NavUser, items: readonly NavItem[]): NavItem[] {
  return items.filter((item) => item.primaryFor?.includes(user.role)).slice(0, 4);
}

export function homeFor(role: Role): string {
  switch (role) {
    case "OWNER":
      return "/my";
    case "LOGISTICS":
      return "/logistics";
    case "VET":
      return "/vet";
    default:
      return "/dashboard";
  }
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Detail pages a role may open by link although the list is not in its menu (V3 §15.3). */
const DETAIL_EXTRA: readonly { pattern: RegExp; roles: readonly Role[] }[] = [
  // An owner follows a link to his own delivery task; the API answers 404 for other households.
  { pattern: /^\/logistics\/\d+$/, roles: [O] },
];

export function canAccess(user: NavUser, pathname: string): boolean {
  if (DETAIL_EXTRA.some((extra) => extra.roles.includes(user.role) && extra.pattern.test(pathname))) return true;
  const rule = ROUTE_ACCESS.find((entry) => matches(pathname, entry.prefix));
  return rule ? hasRole(user, rule) : true;
}

/** Active state of a menu item: the most specific item wins (`/warehouse/inventory` does not light up `/warehouse`). */
export function isActivePath(pathname: string, href: string, items: readonly NavItem[] = NAV_ITEMS): boolean {
  if (!matches(pathname, href)) return false;
  return !items.some((item) => item.href.length > href.length && matches(item.href, href) && matches(pathname, item.href));
}

/** Placeholder origin: only used to resolve `next` the way the browser would. */
const PROBE_ORIGIN = "https://nnp.invalid";

/**
 * Only allow a same-origin path as the post-login destination. The value is
 * resolved with the WHATWG URL parser (as router.replace() does), so tricks
 * like "/\t/evil.example" or "/\\evil.example" that become another origin
 * are rejected. Returns the normalized path, search and hash.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  // Control characters and backslashes are never part of a path this app generates.
  if (!value || !value.startsWith("/") || /[\u0000-\u001F\u007F\\]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return null;
  }
  // "/..//evil.example" resolves to the path "//evil.example", which is protocol-relative.
  if (url.origin !== PROBE_ORIGIN || url.pathname.startsWith("//")) return null;
  if (matches(url.pathname, "/login")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
