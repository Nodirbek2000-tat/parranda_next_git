"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { collect, useForm } from "@/lib/form";
import { CATEGORY_LABELS, todayIso } from "@/lib/format";
import { ORDER_KIND_LABELS } from "@/lib/status";
import { useApi, useDebounced } from "@/lib/use-api";
import type { CatalogProduct, Order, OrderKind, ProductCategory } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_ITEMS = 20;
const KINDS: { value: OrderKind; label: string; hint: string }[] = [
  { value: "SUPPLY_REQUEST", label: "Yem yoki mahsulot talabi", hint: "Yem tugayapti yoki dori, vaksina kerak" },
  { value: "PRODUCT_ORDER", label: "Mahsulot buyurtmasi", hint: "Jihoz va boshqa mahsulotlar" },
];

interface Line {
  product: CatalogProduct;
  quantity: string;
}

function isWhole(product: CatalogProduct): boolean {
  return product.unit === "dona" || product.unit === "qop";
}

function stepOf(product: CatalogProduct): number {
  return product.unit === "kg" ? 10 : 1;
}

function lineError(line: Line): string | undefined {
  const raw = line.quantity.replace(",", ".").trim();
  if (!raw) return "Miqdorni kiriting";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "Son kiriting";
  if (value <= 0) return "0 dan katta bo‘lsin";
  if (isWhole(line.product) && !Number.isInteger(value)) return `“${line.product.unit}” uchun butun son kiriting`;
  return undefined;
}

/** “Yangi buyurtma” sheet of /my/orders (V3 §15.3): kind, products from the catalog, quantities, note, date. */
export function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (order: Order) => void }) {
  const [kind, setKind] = useState<OrderKind>("SUPPLY_REQUEST");
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search.trim(), 250);
  const catalog = useApi<CatalogProduct[]>("/catalog/products");
  const [lines, setLines] = useState<Line[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const form = useForm({ note: "", desired_date: "" });

  const categories = useMemo(() => {
    const present = new Set((catalog.data ?? []).map((product) => product.category));
    return (Object.keys(CATEGORY_LABELS) as ProductCategory[]).filter((value) => present.has(value));
  }, [catalog.data]);

  const visible = useMemo(() => {
    const query = debounced.toLocaleLowerCase("uz");
    return (catalog.data ?? []).filter(
      (product) =>
        (!category || product.category === category) && (!query || product.name.toLocaleLowerCase("uz").includes(query)),
    );
  }, [catalog.data, category, debounced]);

  const selected = new Set(lines.map((line) => line.product.id));
  const toggle = (product: CatalogProduct) => {
    setLines((current) =>
      current.some((line) => line.product.id === product.id)
        ? current.filter((line) => line.product.id !== product.id)
        : current.length >= MAX_ITEMS
          ? current
          : [...current, { product, quantity: "" }],
    );
  };
  const setQuantity = (id: number, quantity: string) =>
    setLines((current) => current.map((line) => (line.product.id === id ? { ...line, quantity } : line)));
  const bump = (line: Line, direction: 1 | -1) => {
    const value = Number(line.quantity.replace(",", ".")) || 0;
    const next = Math.max(0, value + direction * stepOf(line.product));
    setQuantity(line.product.id, next ? String(next) : "");
  };

  const submit = form.handleSubmit(
    (values) => {
      setShowErrors(true);
      return collect([
        ["items", lines.length === 0 ? "Kamida bitta mahsulot tanlang." : lines.some((line) => lineError(line)) ? "Miqdorlarni tekshiring." : undefined],
        ["desired_date", values.desired_date && values.desired_date < todayIso() ? "Sana o‘tgan kun bo‘lishi mumkin emas." : undefined],
        ["note", values.note.length > 500 ? "Izoh 500 ta belgidan oshmasin." : undefined],
      ]);
    },
    (values) =>
      api.post<Order>("/orders", {
        kind,
        items: lines.map((line) => ({ product: line.product.id, quantity: Number(line.quantity.replace(",", ".")) })),
        note: values.note.trim(),
        desired_date: values.desired_date || null,
      }),
    onCreated,
  );

  return (
    <Modal
      title="Yangi buyurtma"
      description="Kerakli mahsulotlarni tanlang — administrator ko‘rib chiqib, yetkazib berishni rejalashtiradi."
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending} disabled={lines.length === 0}>
            Yuborish{lines.length > 0 ? ` (${lines.length})` : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div role="radiogroup" aria-label="Buyurtma turi" className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-subtle p-1">
          {KINDS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={kind === item.value}
              onClick={() => setKind(item.value)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-md px-2 py-1.5 text-center text-[13px] leading-tight transition-colors",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                kind === item.value ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {ORDER_KIND_LABELS[item.value]}
            </button>
          ))}
        </div>
        <p className="-mt-3 text-xs text-muted">{KINDS.find((item) => item.value === kind)?.hint}</p>

        {/* Selected products with quantities */}
        <section aria-label="Tanlangan mahsulotlar" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium text-ink">Tanlangan mahsulotlar</h3>
            <span className="text-xs tabular-nums text-muted">
              {lines.length} / {MAX_ITEMS}
            </span>
          </div>
          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">
              Quyidagi katalogdan mahsulot tanlang.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
              {lines.map((line) => {
                const error = showErrors ? lineError(line) : undefined;
                const inputId = `qty-${line.product.id}`;
                return (
                  <li key={line.product.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <label htmlFor={inputId} className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {line.product.name}
                      </label>
                      <IconButton label={`${line.product.name}: olib tashlash`} tone="quiet-danger" onClick={() => toggle(line.product)}>
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconButton label="Kamaytirish" onClick={() => bump(line, -1)}>
                        <Minus className="size-4" aria-hidden />
                      </IconButton>
                      <Input
                        id={inputId}
                        inputMode={isWhole(line.product) ? "numeric" : "decimal"}
                        placeholder="0"
                        value={line.quantity}
                        invalid={Boolean(error)}
                        onChange={(event) => setQuantity(line.product.id, event.target.value)}
                        className="w-28 text-center tabular-nums"
                      />
                      <IconButton label="Ko‘paytirish" onClick={() => bump(line, 1)}>
                        <Plus className="size-4" aria-hidden />
                      </IconButton>
                      <span className="text-sm text-muted">{line.product.unit}</span>
                      {!line.product.in_stock && <Badge tone="warning" className="ml-auto">Hozircha omborda yo‘q</Badge>}
                    </div>
                    {error && <p className="text-xs text-danger">{error}</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {form.errors.items && <Alert>{form.errors.items}</Alert>}
        </section>

        {/* Catalog */}
        <section aria-label="Mahsulotlar katalogi" className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">Katalog</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="catalog-search" className="sr-only">
              Mahsulot qidirish
            </label>
            <Input
              id="catalog-search"
              type="search"
              placeholder="Mahsulot nomi"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          {categories.length > 1 && (
            <div role="tablist" aria-label="Toifa" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
              {[{ value: "" as const, label: "Barchasi" }, ...categories.map((value) => ({ value, label: CATEGORY_LABELS[value] }))].map(
                (item) => (
                  <button
                    key={item.value || "all"}
                    type="button"
                    role="tab"
                    aria-selected={category === item.value}
                    onClick={() => setCategory(item.value)}
                    className={cn(
                      "h-8 shrink-0 rounded-lg px-3 text-[13px] transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      category === item.value ? "bg-primary font-medium text-white" : "bg-surface text-muted ring-1 ring-inset ring-line hover:text-ink",
                    )}
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
          )}
          {!catalog.data ? (
            catalog.error ? (
              <ErrorState error={catalog.error} onRetry={catalog.reload} />
            ) : (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            )
          ) : visible.length === 0 ? (
            <p className="px-1 py-3 text-[13px] text-muted">Mahsulot topilmadi.</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">
              {visible.map((product) => {
                const active = selected.has(product.id);
                const full = !active && lines.length >= MAX_ITEMS;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      disabled={full}
                      onClick={() => toggle(product)}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
                        active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{product.name}</span>
                        <span className="text-xs text-muted">
                          {product.category_display} · {product.unit}
                        </span>
                      </span>
                      <span className={cn("text-xs", product.in_stock ? "text-accent" : "text-warning-ink")}>
                        {product.in_stock ? "Omborda bor" : "Hozircha yo‘q"}
                      </span>
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border",
                          active ? "border-accent bg-accent text-white" : "border-line text-muted",
                        )}
                        aria-hidden
                      >
                        {active ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kerakli sana" {...form.field("desired_date")} hint="Ixtiyoriy">
            <Input type="date" min={todayIso()} {...form.control("desired_date")} />
          </Field>
          <Field label="Izoh" {...form.field("note")} hint="Ixtiyoriy" className="sm:col-span-2">
            <Textarea rows={2} maxLength={500} placeholder="Masalan: yem 3 kunga yetadi" {...form.control("note")} />
          </Field>
        </div>
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}
