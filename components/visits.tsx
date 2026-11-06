"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Ban, CalendarClock, CheckCheck, ChevronRight, Pill, Plus, Trash2 } from "lucide-react";
import { ApiError, errorMessage, listOf } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDate, fmtDateTime, fmtNumber, personName } from "@/lib/format";
import { isDrug, PRODUCTS_PATH } from "@/lib/products";
import { HEALTH_OPTIONS } from "@/lib/stages";
import type { Paged, Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { visitsApi, visitTone, type Visit } from "@/lib/visits";
import { useConfirm } from "./confirm";
import { AuthImage, LivePhotos, type Coords, type UploadedPhoto } from "./media";
import { decimalInput, parseDecimal } from "./requests";
import { useToast } from "./toast";
import { Alert, Badge, Button, Field, IconButton, Input, Select, Textarea } from "./ui";

export function VisitStatusBadge({ visit }: { visit: Visit }) {
  return <Badge tone={visitTone(visit)}>{visit.overdue ? "Muddati o‘tgan" : visit.statusLabel}</Badge>;
}

export function VisitCard({ visit, showCase = true }: { visit: Visit; showCase?: boolean }) {
  return (
    <Link
      href={`/visits/${visit.id}`}
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-surface p-3.5 shadow-card transition-colors hover:border-line-strong",
        visit.overdue ? "border-danger/50 bg-danger-soft/40" : "border-line",
      )}
    >
      <span
        className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", visit.overdue ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent")}
        aria-hidden
      >
        <CalendarClock className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("font-semibold", visit.overdue && "text-danger")}>{fmtDate(visit.plannedDate)}</span>
          <VisitStatusBadge visit={visit} />
          <span className="text-xs text-muted">{visit.kindLabel}</span>
        </div>
        {showCase && (
          <p className="truncate text-[13px] text-muted">
            <span className="font-medium text-accent">{visit.caseCode}</span>
            {visit.caseName ? ` · ${visit.caseName}` : ""}
          </p>
        )}
        <p className="truncate text-xs text-muted">
          Veterinar: {personName(visit.vet)}
          {visit.status === "DONE" && (
            <>
              {" "}
              · {visit.healthLabel || "—"}
              {visit.chicksCount !== null ? ` · ${fmtNumber(visit.chicksCount)} dona` : ""}
            </>
          )}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

export function VisitList({ items, showCase = true, empty }: { items: Visit[]; showCase?: boolean; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted">{empty ?? "Tashriflar yo‘q."}</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((visit) => (
        <VisitCard key={visit.id} visit={visit} showCase={showCase} />
      ))}
    </div>
  );
}

/** Result of a done visit. */
export function VisitResult({ visit }: { visit: Visit }) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-1 rounded-xl bg-subtle p-3 text-sm">
        <div>
          <dt className="inline text-muted">Bajarildi: </dt>
          <dd className="inline font-medium">{fmtDateTime(visit.doneAt)}</dd>
        </div>
        <div>
          <dt className="inline text-muted">Parrandalar soni: </dt>
          <dd className="inline font-medium">{visit.chicksCount !== null ? `${fmtNumber(visit.chicksCount)} dona` : "—"}</dd>
        </div>
        <div>
          <dt className="inline text-muted">Sog‘lig‘i: </dt>
          <dd className={cn("inline font-medium", visit.health === "bad" && "text-danger")}>{visit.healthLabel || "—"}</dd>
        </div>
        {visit.note && (
          <div>
            <dt className="inline text-muted">Izoh: </dt>
            <dd className="inline whitespace-pre-line">{visit.note}</dd>
          </div>
        )}
      </dl>
      {visit.drugs.length > 0 && (
        <div>
          <p className="mb-1 text-[13px] font-medium">Berilgan dorilar</p>
          <ul className="flex flex-col gap-1 text-sm">
            {visit.drugs.map((drug, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <Pill className="size-3.5 shrink-0 text-accent" aria-hidden />
                  {drug.product}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {fmtNumber(drug.qty)} {drug.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {visit.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visit.photos.map((photo) => (
            <AuthImage key={photo.id} photo={photo} className="size-20" />
          ))}
        </div>
      )}
    </div>
  );
}

interface DrugRow {
  uid: number;
  productId: string;
  qty: string;
}

/** The vet's complete form: chicks count, health, drug rows (product + qty), live photo (≥1), note. */
export function VisitCompleteForm({ visit }: { visit: Visit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const products = useApi<Paged<Product>>(PRODUCTS_PATH);
  const all = products.data ? listOf(products.data) : [];
  const drugs = all.filter(isDrug);
  const options = drugs.length ? drugs : all;
  const [chicks, setChicks] = useState("");
  const [health, setHealth] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<DrugRow[]>([]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const setRow = (uid: number, patch: Partial<DrugRow>) => setRows((list) => list.map((row) => (row.uid === uid ? { ...row, ...patch } : row)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    const count = Number(chicks);
    if (!chicks || !Number.isInteger(count) || count < 0) next.chicks_count = "Parrandalar sonini kiriting";
    if (!health) next.health = "Tanlang";
    if (!photos.length) next.photo_ids = "Kamida bitta jonli rasm oling";
    const drugBody: { product_id: number; qty: number }[] = [];
    rows.forEach((row) => {
      if (!row.productId && !row.qty) return;
      const qty = parseDecimal(row.qty);
      if (!row.productId || qty === null || qty <= 0) next[`drug-${row.uid}`] = "Dori va miqdorni kiriting";
      else drugBody.push({ product_id: Number(row.productId), qty });
    });
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError("Maydonlarni to‘ldiring.");
      return;
    }
    await confirm({
      title: "Tashrifni yakunlash",
      message: drugBody.length ? "Tashrif yakunlanadi, berilgan dorilar ombordan chiqim qilinadi." : "Tashrif yakunlanadi.",
      confirmLabel: "Bajarildi",
      onConfirm: async () => {
        try {
          await visitsApi.complete(visit.id, { chicks_count: count, health, note: note.trim(), photo_ids: photos.map((p) => p.id), drugs: drugBody });
        } catch (caught) {
          if (caught instanceof ApiError) setErrors(caught.fields);
          throw caught;
        }
        toast.success("Tashrif yakunlandi");
      },
    }).catch((caught: unknown) => setFormError(errorMessage(caught)));
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parrandalar soni" htmlFor="v-chicks" required error={errors.chicks_count}>
          <div className="relative">
            <Input id="v-chicks" inputMode="numeric" value={chicks} onChange={(e) => setChicks(e.target.value.replace(/[^\d]/g, ""))} invalid={!!errors.chicks_count} className="pr-14" />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">dona</span>
          </div>
        </Field>
        <Field label="Sog‘lig‘i" htmlFor="v-health" required error={errors.health}>
          <Select id="v-health" value={health} onChange={(e) => setHealth(e.target.value)} invalid={!!errors.health}>
            <option value="">— tanlang —</option>
            {HEALTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium">Berilgan dorilar</p>
        {products.error && <Alert>{products.error}</Alert>}
        {rows.map((row) => (
          <div key={row.uid} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <Select
                aria-label="Dori"
                value={row.productId}
                onChange={(e) => setRow(row.uid, { productId: e.target.value })}
                invalid={!!errors[`drug-${row.uid}`]}
                className="min-w-0 flex-1"
              >
                <option value="">— dori —</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({fmtNumber(p.balance)} {p.unit})
                  </option>
                ))}
              </Select>
              <Input
                aria-label="Miqdor"
                inputMode="decimal"
                placeholder="Miqdor"
                value={row.qty}
                onChange={(e) => setRow(row.uid, { qty: decimalInput(e.target.value) })}
                invalid={!!errors[`drug-${row.uid}`]}
                className="w-24 shrink-0"
              />
              <IconButton label="Qatorni o‘chirish" onClick={() => setRows((list) => list.filter((r) => r.uid !== row.uid))} className="mt-1 hover:text-danger">
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            </div>
            {errors[`drug-${row.uid}`] && <p className="text-[13px] text-danger">{errors[`drug-${row.uid}`]}</p>}
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => setRows((list) => [...list, { uid: Date.now() + list.length, productId: "", qty: "" }])}
        >
          Dori qo‘shish
        </Button>
        {errors.drugs && <p className="text-[13px] text-danger">{errors.drugs}</p>}
      </div>

      <Field label="Jonli rasm (kamida 1 ta)" required error={errors.photo_ids}>
        <LivePhotos value={photos} onChange={setPhotos} coords={coords} onCoords={setCoords} />
      </Field>
      <Field label="Izoh" htmlFor="v-note" error={errors.note}>
        <Textarea id="v-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {formError && <Alert>{formError}</Alert>}
      <Button type="submit" icon={<CheckCheck className="size-4" aria-hidden />} className="w-full sm:w-auto sm:self-start">
        Bajarildi
      </Button>
    </form>
  );
}

/** ADMIN: cancel a planned visit with a reason. */
export function CancelVisitButton({ visit }: { visit: Visit }) {
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      className="text-danger"
      icon={<Ban className="size-4" aria-hidden />}
      onClick={() =>
        confirm({
          title: "Tashrifni bekor qilish",
          message: `${visit.caseCode} · ${fmtDate(visit.plannedDate)} tashrifi bekor qilinadi.`,
          confirmLabel: "Bekor qilish",
          tone: "danger",
          reason: { label: "Sabab" },
          onConfirm: async (reason) => {
            await visitsApi.cancel(visit.id, reason);
            toast.success("Tashrif bekor qilindi");
          },
        })
      }
    >
      Bekor qilish
    </Button>
  );
}
