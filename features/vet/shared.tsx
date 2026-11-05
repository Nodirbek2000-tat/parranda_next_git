"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { collect, useForm } from "@/lib/form";
import { formatDate } from "@/lib/format";
import { OVERDUE_CLASS } from "@/lib/status";
import { useAllPages } from "@/lib/use-api";
import type { HouseholdShort, Product, ProductCategory, User, UserRef } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { householdLabel, useHouseholdOptions } from "../options";

export const VET_PATH = "/vet";

/** Role helpers for the vet pages (buttons follow `allowed_actions`; these only decide which create forms exist). */
export function useVetRole() {
  const user = useCurrentUser();
  return { user, isVet: user.role === "VET", isAdmin: user.role === "ADMIN", isOwner: user.role === "OWNER" };
}

/** Active VET users for the “Veterinar” select (ADMIN only: `/api/users` is admin-only; a VET plans for himself). */
export function useVetOptions(enabled: boolean) {
  const list = useAllPages<User>(enabled ? "/users" : null, { role: "VET" });
  const vets = (list.data?.results ?? []).filter((user) => user.is_active);
  return { vets, loading: enabled && !list.data && !list.error };
}

/** Active products of one category (vaccines, vet drugs) with the current balance for the hint. */
export function useProductsOf(categories: readonly ProductCategory[], enabled = true) {
  const list = useAllPages<Product>(enabled ? "/products" : null, { is_active: true });
  return (list.data?.results ?? []).filter((product) => categories.includes(product.category));
}

/** Active households for planning selects (inactive ones cannot be planned, V3 §8). */
export function useActiveHouseholds(enabled = true) {
  const list = useHouseholdOptions(enabled);
  return {
    households: (list.data?.results ?? []).filter((household) => household.is_active),
    loading: enabled && !list.data && !list.error,
  };
}

export function HouseholdLink({ household, owner = false }: { household: HouseholdShort; owner?: boolean }) {
  if (owner) return <span>{household.name}</span>;
  return (
    <Link href={`/households/${household.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
      {household.name}
      <span className="ml-1 text-xs font-normal tabular-nums text-muted">{household.code}</span>
    </Link>
  );
}

export function vetName(vet: UserRef | null): string {
  return vet ? vet.full_name : "Biriktirilmagan";
}

/** Planned date with an overdue marker (danger outline, §15.3). */
export function PlannedDate({ date, overdue }: { date: string; overdue: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 tabular-nums">
      <span className="whitespace-nowrap">{formatDate(date)}</span>
      {overdue && (
        <Badge tone="danger" className={cn("gap-1", OVERDUE_CLASS)}>
          <CalendarClock className="size-3" aria-hidden />
          Muddati o‘tgan
        </Badge>
      )}
    </span>
  );
}

export function Info({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink [overflow-wrap:anywhere]">{value || "—"}</dd>
    </div>
  );
}

/** Multi-line free text (conclusion, recommendations) as written by the vet. */
export function TextBlock({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{text}</p>
    </div>
  );
}

export function HouseholdSelect({
  value,
  onChange,
  id,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  invalid?: boolean;
}) {
  const { households, loading } = useActiveHouseholds();
  return (
    <Select id={id} value={value} invalid={invalid} onChange={(event) => onChange(event.target.value)} disabled={loading}>
      <option value="">{loading ? "Yuklanmoqda…" : "Xonadonni tanlang"}</option>
      {households.map((household) => (
        <option key={household.id} value={household.id}>
          {householdLabel(household)}
        </option>
      ))}
    </Select>
  );
}

/** Reason dialog for the cancel actions (`{reason}` 3–500, V3 §8.1 / §8.2). */
export function ReasonModal({
  title,
  description,
  path,
  confirmLabel = "Bekor qilish",
  success,
  onClose,
  onDone,
}: {
  title: string;
  description: ReactNode;
  path: string;
  confirmLabel?: string;
  success: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const form = useForm({ reason: "" });
  const onSubmit = form.handleSubmit(
    (values) => collect([["reason", values.reason.trim().length < 3 ? "Sababni yozing (kamida 3 ta belgi)" : undefined]]),
    (values) => api.post(path, { reason: values.reason.trim() }),
    () => {
      toast.success(success);
      onDone();
    },
  );
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Yopish
          </Button>
          <Button type="submit" variant="danger" loading={form.pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label="Sabab" required {...form.field("reason")}>
        <Textarea {...form.control("reason")} rows={3} maxLength={500} autoFocus />
      </Field>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

/** First of the current month / last day of the month as ISO dates. */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const MONTH_NAMES = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
] as const;

/** Switch with a visible label (the shared `Switch` only carries an aria-label). */
export function SwitchRow({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-subtle/40 px-3 py-2.5">
      <span className="text-sm text-ink">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}