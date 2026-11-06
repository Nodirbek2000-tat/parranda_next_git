import type { PersonRef } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `05.11.2026` */
export function fmtDate(value: string | null | undefined): string {
  const d = toDate(value);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : "—";
}

/** `05.11.2026 14:30` */
export function fmtDateTime(value: string | null | undefined): string {
  const d = toDate(value);
  return d ? `${fmtDate(value)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "—";
}

export function fmtNumber(value: number | string | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(digits).replace(/\.?0+$/, "");
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac ? `${grouped},${frac}` : grouped;
}

export function fmtMoney(value: number | string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : `${fmtNumber(value, 0)} so‘m`;
}

export function personName(ref: PersonRef, fallback?: string | null): string {
  if (fallback) return fallback;
  if (ref === null || ref === undefined || ref === "") return "—";
  if (typeof ref === "string") return ref;
  if (typeof ref === "number") return `#${ref}`;
  return ref.full_name || ref.username || (ref.id ? `#${ref.id}` : "—");
}

export interface Deadline {
  text: string;
  overdue: boolean;
}

/** Deadline text: "3 kun qoldi", "Bugun", "2 kun kechikdi". */
export function deadline(due: string | null | undefined, overdueFlag?: boolean): Deadline | null {
  const d = toDate(due);
  if (!d) return null;
  const diffMs = d.getTime() - Date.now();
  const overdue = overdueFlag ?? diffMs < 0;
  const days = Math.ceil(Math.abs(diffMs) / 86_400_000);
  if (overdue) {
    const late = Math.max(1, Math.floor(-diffMs / 86_400_000));
    return { text: diffMs < 0 ? `${late} kun kechikdi (${fmtDate(due)})` : `Muddati o‘tgan (${fmtDate(due)})`, overdue: true };
  }
  if (diffMs < 86_400_000) return { text: `Bugun tugaydi (${fmtDateTime(due)})`, overdue: false };
  return { text: `${days} kun qoldi (${fmtDate(due)})`, overdue: false };
}
