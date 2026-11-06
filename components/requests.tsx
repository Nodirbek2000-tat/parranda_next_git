"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, ChevronRight, HandCoins, PackageCheck, ShieldCheck, Truck, XCircle } from "lucide-react";
import { ApiError, errorMessage, listOf } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtNumber, personName } from "@/lib/format";
import { isFeed, PRODUCTS_PATH } from "@/lib/products";
import { REQUEST_STATUS_TONES, requestsApi, type OwnerRequest, type RequestKind } from "@/lib/requests";
import type { Paged, PersonRef, Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useConfirm } from "./confirm";
import { AuthImage, LivePhotos, type Coords, type UploadedPhoto } from "./media";
import { Modal } from "./modal";
import { useToast } from "./toast";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "./ui";

export const KIND_EMOJI: Record<RequestKind, string> = { FEED: "🌾", VET: "🩺" };

export function RequestStatusBadge({ req }: { req: OwnerRequest }) {
  return <Badge tone={REQUEST_STATUS_TONES[req.status] ?? "neutral"}>{req.statusLabel}</Badge>;
}

/** Decimal input text -> number (accepts "12,5"). */
export function parseDecimal(text: string): number | null {
  const clean = text.replace(/\s/g, "").replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

export function decimalInput(text: string): string {
  return text.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1");
}

/** Approve / reject / deliver / "Oldim" buttons, driven only by the API `can` flags. */
export function RequestActions({ req, size = "md" }: { req: OwnerRequest; size?: "sm" | "md" }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [delivering, setDelivering] = useState(false);
  const { can } = req;
  if (!can.approve && !can.reject && !can.deliver && !can.confirm) return null;

  const approve = () =>
    confirm({
      title: "So‘rovni tasdiqlash",
      message:
        req.status === "PENDING_LOGISTICS"
          ? "So‘rov administrator tasdig‘iga yuboriladi."
          : req.kind === "FEED"
            ? "So‘rov tasdiqlanadi va logistikaga yetkazish vazifasi beriladi."
            : "So‘rov tasdiqlanadi va biriktirilgan veterinarga bugungi tashrif yaratiladi.",
      confirmLabel: "Tasdiqlash",
      onConfirm: async () => {
        await requestsApi.approve(req.id);
        toast.success("So‘rov tasdiqlandi");
      },
    });

  const reject = () =>
    confirm({
      title: "So‘rovni rad etish",
      message: "Xonadon egasiga rad etish sababi bilan xabar boradi.",
      confirmLabel: "Rad etish",
      tone: "danger",
      reason: { label: "Rad etish sababi" },
      onConfirm: async (reason) => {
        await requestsApi.reject(req.id, reason);
        toast.success("So‘rov rad etildi");
      },
    });

  const received = () =>
    confirm({
      title: "Oldim",
      message: req.delivery
        ? `${req.delivery.product} — ${fmtNumber(req.delivery.qty)} ${req.delivery.unit} qabul qilinganini tasdiqlaysizmi?`
        : "Yetkazilgan mahsulotni qabul qilganingizni tasdiqlaysizmi?",
      confirmLabel: "Ha, oldim",
      onConfirm: async () => {
        await requestsApi.confirm(req.id);
        toast.success("Rahmat! So‘rov yakunlandi");
      },
    });

  return (
    <div className="flex flex-wrap gap-2">
      {can.confirm && (
        <Button size={size} onClick={received} icon={<Check className="size-4" aria-hidden />}>
          Oldim
        </Button>
      )}
      {can.deliver && (
        <Button size={size} onClick={() => setDelivering(true)} icon={<Truck className="size-4" aria-hidden />}>
          Yetkazildi
        </Button>
      )}
      {can.approve && (
        <Button size={size} onClick={approve} icon={<ShieldCheck className="size-4" aria-hidden />}>
          Tasdiqlash
        </Button>
      )}
      {can.reject && (
        <Button size={size} variant="secondary" className="text-danger" onClick={reject} icon={<XCircle className="size-4" aria-hidden />}>
          Rad etish
        </Button>
      )}
      {delivering && <DeliverModal req={req} onClose={() => setDelivering(false)} />}
    </div>
  );
}

/** One request as a card (lists on `/requests`, the case page and `/my`). */
export function RequestCard({ req, showCase = true, link = true }: { req: OwnerRequest; showCase?: boolean; link?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl" aria-hidden>
          {KIND_EMOJI[req.kind]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {req.kindLabel} so‘rovi{req.qtyKg !== null ? ` · ${fmtNumber(req.qtyKg)} kg` : ""}
            </span>
            <RequestStatusBadge req={req} />
          </div>
          {showCase && (req.caseCode || req.caseName) && (
            <p className="text-[13px] text-muted">
              {req.caseId ? (
                <Link href={`/cases/${req.caseId}`} className="font-medium text-accent">
                  {req.caseCode || `#${req.caseId}`}
                </Link>
              ) : (
                req.caseCode
              )}
              {req.caseName ? ` · ${req.caseName}` : ""}
            </p>
          )}
          {req.text && <p className="mt-1 whitespace-pre-line text-sm">{req.text}</p>}
          {req.delivery && (
            <p className="mt-1 text-[13px] text-ink">
              <PackageCheck className="mr-1 inline size-3.5 text-accent" aria-hidden />
              Berildi: <b>{req.delivery.product}</b> — {fmtNumber(req.delivery.qty)} {req.delivery.unit}
            </p>
          )}
          {req.status === "REJECTED" && req.rejectReason && (
            <p className="mt-1.5 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[13px] text-danger">Rad etish sababi: {req.rejectReason}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            {personName(req.createdBy)} · {fmtDateTime(req.createdAt)}
          </p>
        </div>
        {link && (
          <Link href={`/requests/${req.id}`} aria-label="Batafsil" className="-mr-1 rounded-lg p-1 text-muted hover:bg-subtle">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        )}
      </div>
      {(req.can.approve || req.can.reject || req.can.deliver || req.can.confirm) && (
        <div className="mt-3 border-t border-line pt-3">
          <RequestActions req={req} size="sm" />
        </div>
      )}
    </div>
  );
}

/** Who did what and when, for `/requests/[id]`. */
export function RequestHistory({ req }: { req: OwnerRequest }) {
  const rows: { label: string; who: PersonRef; at: string | null }[] = [
    { label: "Yaratildi", who: req.createdBy, at: req.createdAt },
    { label: "Logistika tasdiqladi", who: req.logisticsBy, at: req.logisticsAt },
    { label: "Administrator tasdiqladi", who: req.adminBy, at: req.adminAt },
    { label: "Yetkazildi", who: req.deliveredBy, at: req.deliveredAt },
    { label: req.status === "REJECTED" ? "Rad etildi" : "Yakunlandi", who: req.status === "REJECTED" ? (req.rejectedBy ?? req.doneBy) : req.doneBy, at: req.doneAt },
  ].filter((row) => row.at);
  return (
    <ol className="flex flex-col gap-2 border-l-2 border-line pl-3 text-sm">
      {rows.map((row) => (
        <li key={row.label}>
          <span className="font-medium">{row.label}</span>
          <span className="text-muted">
            {" "}
            — {personName(row.who)}, {fmtDateTime(row.at)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function RequestPhotos({ req }: { req: OwnerRequest }) {
  if (!req.photos.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {req.photos.map((photo) => (
        <AuthImage key={photo.id} photo={photo} className="size-20" />
      ))}
    </div>
  );
}

/** LOGISTICS "Yetkazildi": FEED product, qty, ≥1 live photo, note. Stock OUT is written by the server (409 when short). */
function DeliverModal({ req, onClose }: { req: OwnerRequest; onClose: () => void }) {
  const toast = useToast();
  const products = useApi<Paged<Product>>(PRODUCTS_PATH);
  const all = products.data ? listOf(products.data) : [];
  const feed = all.filter(isFeed);
  const options = feed.length ? feed : all;
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(req.qtyKg !== null ? String(req.qtyKg) : "");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const product = options.find((p) => String(p.id) === productId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const amount = parseDecimal(qty);
    if (!productId) next.product_id = "Mahsulotni tanlang";
    if (amount === null || amount <= 0) next.qty = "Miqdorni kiriting";
    if (!photos.length) next.photo_ids = "Kamida bitta jonli rasm oling";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await requestsApi.deliver(req.id, { product_id: Number(productId), qty: amount as number, photo_ids: photos.map((p) => p.id), note: note.trim() || undefined });
      toast.success("Yetkazildi deb belgilandi");
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) setErrors(caught.fields);
      setFormError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Yem yetkazildi"
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={busy} icon={<Truck className="size-4" aria-hidden />}>
            Yetkazildi
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {req.caseCode} · so‘ralgan: {req.qtyKg !== null ? `${fmtNumber(req.qtyKg)} kg` : "miqdor ko‘rsatilmagan"}
        </p>
        {products.error && <Alert>{products.error}</Alert>}
        <Field label="Yem (mahsulot)" htmlFor="deliver-product" required error={errors.product_id}>
          <Select id="deliver-product" value={productId} onChange={(e) => setProductId(e.target.value)} invalid={!!errors.product_id}>
            <option value="">{products.loading && !all.length ? "Yuklanmoqda…" : "— tanlang —"}</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (qoldiq: {fmtNumber(p.balance)} {p.unit})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Miqdor" htmlFor="deliver-qty" required error={errors.qty}>
          <div className="relative">
            <Input id="deliver-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(decimalInput(e.target.value))} invalid={!!errors.qty} className="pr-14" />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{product?.unit ?? "kg"}</span>
          </div>
        </Field>
        <Field label="Jonli rasm (kamida 1 ta)" required error={errors.photo_ids}>
          <LivePhotos value={photos} onChange={setPhotos} coords={coords} onCoords={setCoords} />
        </Field>
        <Field label="Izoh" htmlFor="deliver-note">
          <Textarea id="deliver-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </Field>
        {formError && <Alert>{formError}</Alert>}
      </div>
    </Modal>
  );
}

/** Owner: "🌾 Yem so‘rash" / "🩺 Veterinar chaqirish" form (text, kg for feed, optional live photo). */
export function NewRequestModal({ caseId, kind, onClose }: { caseId: number; kind: RequestKind; onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [qty, setQty] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const feed = kind === "FEED";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const amount = parseDecimal(qty);
    if (!text.trim()) next.text = feed ? "Nima uchun yem kerakligini yozing" : "Muammoni qisqacha yozing";
    if (feed && qty && (amount === null || amount <= 0)) next.qty_kg = "To‘g‘ri miqdor kiriting";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await requestsApi.create(caseId, {
        kind,
        text: text.trim(),
        ...(feed && amount !== null ? { qty_kg: amount } : {}),
        ...(photos.length ? { photo_ids: photos.map((p) => p.id) } : {}),
      });
      toast.success(feed ? "Yem so‘rovi yuborildi" : "Veterinar chaqiruvi yuborildi");
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) setErrors(caught.fields);
      setFormError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={feed ? "🌾 Yem so‘rash" : "🩺 Veterinar chaqirish"}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={busy} icon={<HandCoins className="size-4" aria-hidden />}>
            Yuborish
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={feed ? "Izoh (nima uchun kerak)" : "Muammo nimada?"} htmlFor="req-text" required error={errors.text}>
          <Textarea
            id="req-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            invalid={!!errors.text}
            placeholder={feed ? "Masalan: yem 3 kunga yetadi" : "Masalan: jo‘jalar kam ovqat yeyapti"}
          />
        </Field>
        {feed && (
          <Field label="Qancha kerak" htmlFor="req-qty" error={errors.qty_kg} hint="Ixtiyoriy">
            <div className="relative">
              <Input id="req-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(decimalInput(e.target.value))} invalid={!!errors.qty_kg} className="pr-10" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">kg</span>
            </div>
          </Field>
        )}
        <Field label="Jonli rasm (ixtiyoriy)" error={errors.photo_ids}>
          <LivePhotos value={photos} onChange={setPhotos} coords={coords} onCoords={setCoords} />
        </Field>
        {formError && <Alert>{formError}</Alert>}
      </div>
    </Modal>
  );
}

export function RequestList({ items, showCase = true, empty }: { items: OwnerRequest[]; showCase?: boolean; empty?: string }) {
  if (!items.length) return <p className={cn("text-sm text-muted")}>{empty ?? "So‘rovlar yo‘q."}</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((req) => (
        <RequestCard key={req.id} req={req} showCase={showCase} />
      ))}
    </div>
  );
}
