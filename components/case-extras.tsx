"use client";

import { useState } from "react";
import { Sprout, Stethoscope, UserCog } from "lucide-react";
import { listOf } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { caseFinance, hasAnyCost } from "@/lib/finance";
import { fmtDate, fmtMoney, fmtNumber, personName } from "@/lib/format";
import { growingText } from "@/lib/growing";
import { isAdmin } from "@/lib/roles";
import type { CaseDetail, Growing, Paged, StaffUser } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { VETS_QUERY, visitsApi } from "@/lib/visits";
import { useToast } from "./toast";
import { Alert, Button, Card, Select } from "./ui";

/** "23-kun / 45" with a progress bar. */
export function GrowingProgress({ growing, big = false, className }: { growing: Growing; big?: boolean; className?: string }) {
  const pct = Math.min(100, Math.max(0, (growing.day / Math.max(1, growing.total_days)) * 100));
  const left = growing.total_days - growing.day;
  const ending = left <= 2;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
          <Sprout className="size-4 text-accent" aria-hidden /> Parvarish davri
        </span>
        <span className={cn("font-semibold tabular-nums", big ? "text-2xl" : "text-base", ending ? "text-warning-ink" : "text-primary")}>{growingText(growing)}</span>
      </div>
      <div className={cn("overflow-hidden rounded-full bg-subtle ring-1 ring-inset ring-line", big ? "h-3" : "h-2")}>
        <div className={cn("h-full rounded-full", ending ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted">
        {growing.started_at ? `Boshlangan: ${fmtDate(growing.started_at)}` : ""}
        {growing.ends_at ? ` · Tugashi: ${fmtDate(growing.ends_at)}` : ""}
        {left > 0 ? ` · ${left} kun qoldi` : " · Davr tugadi"}
      </p>
    </div>
  );
}

/** "Veterinar" block: the assigned vet; ADMIN picks / changes it. */
export function VetBlock({ detail }: { detail: CaseDetail }) {
  const user = useMe();
  const toast = useToast();
  const canAssign = detail.status !== "REJECTED" && (detail.can?.assign_vet ?? isAdmin(user));
  const [editing, setEditing] = useState(false);
  const [vetId, setVetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vets = useApi<Paged<StaffUser>>(canAssign && editing ? "/users" : null, VETS_QUERY);
  const list = vets.data ? listOf(vets.data).filter((u) => u.role === "VET" && u.is_active !== false) : [];
  const current = detail.vet_user;

  const save = async () => {
    if (!vetId) {
      setError("Veterinarni tanlang");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await visitsApi.assignVet(detail.id, Number(vetId));
      toast.success("Veterinar biriktirildi");
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Stethoscope className="size-4.5 text-accent" aria-hidden /> Veterinar
        </h2>
        {canAssign && !editing && (
          <Button
            size="sm"
            variant="secondary"
            icon={<UserCog className="size-4" aria-hidden />}
            onClick={() => {
              setVetId(current?.id ? String(current.id) : "");
              setEditing(true);
            }}
          >
            {current ? "O‘zgartirish" : "Biriktirish"}
          </Button>
        )}
      </div>
      {!editing ? (
        <p className={cn("mt-2 text-sm", !current && "text-muted")}>{current ? personName(current) : "Veterinar biriktirilmagan"}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {vets.error && <Alert>{vets.error}</Alert>}
          <Select aria-label="Veterinar" value={vetId} onChange={(e) => setVetId(e.target.value)}>
            <option value="">{vets.loading && !list.length ? "Yuklanmoqda…" : "— veterinarni tanlang —"}</option>
            {list.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.username}
                {u.phone ? ` · ${u.phone}` : ""}
              </option>
            ))}
          </Select>
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={save}>
              Saqlash
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
              Bekor qilish
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Finance: cost breakdown, revenue, profit (green / red). Shown as soon as any cost exists. */
export function FinanceBlock({ detail }: { detail: CaseDetail }) {
  const finance = caseFinance(detail);
  if (!hasAnyCost(finance)) return null;
  const max = Math.max(1, ...finance.costs.map((c) => c.value));
  const profitTone = finance.profit === null ? "" : finance.profit >= 0 ? "text-accent" : "text-danger";
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold">Moliya</h2>
      <ul className="flex flex-col gap-2">
        {finance.costs
          .filter((c) => c.value > 0)
          .map((c) => (
            <li key={c.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-muted">{c.label}</span>
                <span className="shrink-0 tabular-nums font-medium">{fmtMoney(c.value)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                <div className="h-full rounded-full bg-accent/70" style={{ width: `${(c.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
      </ul>
      <dl className="mt-3 grid gap-1.5 border-t border-line pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="font-medium">Jami xarajat</dt>
          <dd className="tabular-nums font-semibold">{fmtMoney(finance.totalCost)}</dd>
        </div>
        {finance.perBirdCost !== null && (
          <div className="flex justify-between gap-3 text-muted">
            <dt>1 parranda tannarxi</dt>
            <dd className="tabular-nums">{fmtMoney(finance.perBirdCost)}</dd>
          </div>
        )}
        {finance.kg !== null && (
          <div className="flex justify-between gap-3 text-muted">
            <dt>Vazn</dt>
            <dd className="tabular-nums">{fmtNumber(finance.kg)} kg</dd>
          </div>
        )}
        {finance.pricePerKg !== null && (
          <div className="flex justify-between gap-3 text-muted">
            <dt>1 kg narxi</dt>
            <dd className="tabular-nums">{fmtMoney(finance.pricePerKg)}</dd>
          </div>
        )}
        {finance.revenue !== null && (
          <div className="flex justify-between gap-3">
            <dt className="font-medium">Daromad (sotuv)</dt>
            <dd className="tabular-nums font-semibold">{fmtMoney(finance.revenue)}</dd>
          </div>
        )}
        {finance.profit !== null && (
          <div className={cn("mt-1 flex justify-between gap-3 rounded-xl px-3 py-2", finance.profit >= 0 ? "bg-accent-soft" : "bg-danger-soft")}>
            <dt className="font-semibold">{finance.profit >= 0 ? "Foyda" : "Zarar"}</dt>
            <dd className={cn("tabular-nums text-base font-bold", profitTone)}>{fmtMoney(finance.profit)}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
