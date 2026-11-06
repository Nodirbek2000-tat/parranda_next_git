"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Package as PackageIcon, Pencil, Plus, Search } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { Alert, Badge, Button, Card, Empty, Field, IconButton, Input, Loadable, PageHeader, Select } from "@/components/ui";
import { api, ApiError, errorMessage, listOf } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtMoney, fmtNumber, personName } from "@/lib/format";
import type { Paged, Product, StockMove } from "@/lib/types";
import { useApi, useDebounced } from "@/lib/use-api";

const UNITS = ["kg", "dona", "qop", "m", "m²", "litr"];
const CATEGORIES: Record<string, string> = {
  material: "Qurilish materiali",
  jihoz: "Jihoz",
  yem: "Yem",
  dori: "Veterinariya dorisi",
  boshqa: "Boshqa",
};

function isLow(p: Product): boolean {
  if (p.is_low !== undefined) return p.is_low;
  return p.min_stock !== undefined && p.min_stock !== null && Number(p.balance) <= Number(p.min_stock);
}

export default function WarehousePage() {
  const [tab, setTab] = useState<"stock" | "moves">("stock");
  const [kirim, setKirim] = useState<Product | true | null>(null);
  const [editing, setEditing] = useState<Product | true | null>(null);
  const products = useApi<Paged<Product>>("/products");

  return (
    <>
      <PageHeader
        title="Ombor"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} icon={<Plus className="size-4" aria-hidden />}>
              Mahsulot
            </Button>
            <Button size="sm" onClick={() => setKirim(true)} icon={<ArrowDownToLine className="size-4" aria-hidden />}>
              Kirim
            </Button>
          </>
        }
      />
      <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1">
        {(
          [
            ["stock", "Qoldiqlar"],
            ["moves", "Harakatlar tarixi"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn("h-9 rounded-lg px-4 text-sm font-medium", tab === key ? "bg-primary text-white" : "text-muted hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "stock" ? (
        <Loadable data={products.data} error={products.error} reload={products.reload}>
          {(data) => <ProductList products={listOf(data)} onKirim={setKirim} onEdit={setEditing} />}
        </Loadable>
      ) : (
        <MovesList />
      )}

      {kirim && <KirimModal products={listOf(products.data)} initial={kirim === true ? null : kirim} onClose={() => setKirim(null)} />}
      {editing && <ProductModal product={editing === true ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ProductList({ products, onKirim, onEdit }: { products: Product[]; onKirim: (p: Product) => void; onEdit: (p: Product) => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const q = search.trim().toLowerCase();
  const rows = products.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!category || p.category === category));
  const low = products.filter(isLow).length;

  return (
    <div className="flex flex-col gap-3">
      {low > 0 && <Alert tone="warning">Kam qolgan mahsulotlar: {low} ta</Alert>}
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot nomi…" className="pl-9" aria-label="Qidirish" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Turkum">
          <option value="">Barcha turkumlar</option>
          {Object.entries(CATEGORIES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {!rows.length ? (
        <Empty title="Mahsulot topilmadi" icon={<PackageIcon className="size-8" aria-hidden />} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((p) => (
            <li key={p.id}>
              <Card className={cn("flex items-center gap-3 p-3", isLow(p) && "border-danger/40")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {p.name} {p.is_demo && <Badge>DEMO</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {p.category_display || CATEGORIES[p.category] || p.category}
                    {p.price ? ` · ${fmtMoney(p.price)}/${p.unit}` : ""}
                    {p.min_stock !== undefined && p.min_stock !== null ? ` · min ${fmtNumber(p.min_stock)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-base font-semibold tabular-nums", isLow(p) ? "text-danger" : "text-ink")}>{fmtNumber(p.balance)}</p>
                  <p className="text-xs text-muted">{p.unit}</p>
                </div>
                <IconButton label="Kirim" onClick={() => onKirim(p)} className="border border-line text-accent">
                  <ArrowDownToLine className="size-4" aria-hidden />
                </IconButton>
                <IconButton label="Tahrirlash" onClick={() => onEdit(p)}>
                  <Pencil className="size-4" aria-hidden />
                </IconButton>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MovesList() {
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim()).toLowerCase();
  const moves = useApi<Paged<StockMove>>("/stock/moves", { type, limit: 500 });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulot yoki xonadon kodi…" aria-label="Qidirish" />
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Turi">
          <option value="">Kirim va chiqim</option>
          <option value="IN">Kirim</option>
          <option value="OUT">Chiqim</option>
        </Select>
      </div>
      <Loadable data={moves.data} error={moves.error} reload={moves.reload}>
        {(data) => {
          const rows = listOf(data).filter((m) => {
            if (!q) return true;
            const product = m.product_name ?? (m.product && typeof m.product === "object" ? m.product.name : "");
            const code = m.case_code ?? (m.case && typeof m.case === "object" ? m.case.code : "");
            return [product, code, m.note].some((v) => (v ?? "").toLowerCase().includes(q));
          });
          if (!rows.length) return <Empty title="Harakatlar yo‘q" />;
          return (
            <ul className="flex flex-col gap-2">
              {rows.map((m) => {
                const productName = m.product_name ?? (m.product && typeof m.product === "object" ? m.product.name : `#${m.product}`);
                const unit = m.unit ?? (m.product && typeof m.product === "object" ? m.product.unit : "") ?? "";
                const caseCode = m.case_code ?? (m.case && typeof m.case === "object" ? m.case.code : m.case ? `#${m.case}` : "");
                return (
                  <li key={m.id}>
                    <Card className="flex items-center gap-3 p-3">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", m.type === "IN" ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning-ink")}>
                        {m.type === "IN" ? <ArrowDownToLine className="size-4" aria-hidden /> : <ArrowUpFromLine className="size-4" aria-hidden />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{productName}</p>
                        <p className="text-xs text-muted">
                          {fmtDateTime(m.created_at)} · {personName(m.created_by, m.created_by_name)}
                          {caseCode ? ` · ${caseCode}` : ""}
                        </p>
                        {m.note && <p className="truncate text-xs text-ink">{m.note}</p>}
                      </div>
                      <div className="text-right">
                        <p className={cn("font-semibold tabular-nums", m.type === "IN" ? "text-accent" : "text-warning-ink")}>
                          {m.type === "IN" ? "+" : "−"}
                          {fmtNumber(m.qty)} {unit}
                        </p>
                        {m.balance_after !== undefined && <p className="text-xs text-muted">qoldiq {fmtNumber(m.balance_after)}</p>}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </Loadable>
    </div>
  );
}

function KirimModal({ products, initial, onClose }: { products: Product[]; initial: Product | null; onClose: () => void }) {
  const toast = useToast();
  const [productId, setProductId] = useState(initial ? String(initial.id) : "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const product = products.find((p) => String(p.id) === productId);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(qty.replace(",", "."));
    const next: Record<string, string> = {};
    if (!productId) next.product_id = "Mahsulotni tanlang";
    if (!qty || !Number.isFinite(amount) || amount <= 0) next.qty = "Musbat son kiriting";
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    setFormError(null);
    try {
      await api.post("/stock/in", { product_id: Number(productId), qty: amount, note: note.trim() });
      toast.success(`Kirim qilindi: ${product?.name ?? ""} +${fmtNumber(amount)} ${product?.unit ?? ""}`);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) setErrors(caught.fields);
      setFormError(errorMessage(caught));
      setPending(false);
    }
  };

  return (
    <Modal
      title="Kirim"
      onClose={onClose}
      onSubmit={onSubmit}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={pending}>
            Kirim qilish
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Mahsulot" htmlFor="k-product" required error={errors.product_id}>
          <Select id="k-product" value={productId} onChange={(e) => setProductId(e.target.value)} invalid={!!errors.product_id}>
            <option value="">— tanlang —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({fmtNumber(p.balance)} {p.unit})
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Miqdori${product ? ` (${product.unit})` : ""}`} htmlFor="k-qty" required error={errors.qty}>
          <Input id="k-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ""))} invalid={!!errors.qty} />
        </Field>
        <Field label="Izoh" htmlFor="k-note" error={errors.note}>
          <Input id="k-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Yetkazib beruvchi, hujjat raqami…" />
        </Field>
        {formError && <Alert>{formError}</Alert>}
      </div>
    </Modal>
  );
}

function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: product?.name ?? "",
    unit: product?.unit ?? "dona",
    category: product?.category ?? "material",
    price: product?.price !== undefined && product?.price !== null ? String(product.price) : "",
    min_stock: product?.min_stock !== undefined && product?.min_stock !== null ? String(product.min_stock) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: "Majburiy maydon" });
      return;
    }
    setPending(true);
    setFormError(null);
    const body = {
      name: form.name.trim(),
      unit: form.unit,
      category: form.category,
      price: form.price ? Number(form.price.replace(",", ".")) : 0,
      min_stock: form.min_stock ? Number(form.min_stock.replace(",", ".")) : 0,
    };
    try {
      if (product) await api.patch(`/products/${product.id}`, body);
      else await api.post("/products", body);
      toast.success(product ? "Mahsulot saqlandi" : "Mahsulot qo‘shildi");
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) setErrors(caught.fields);
      setFormError(errorMessage(caught));
      setPending(false);
    }
  };

  return (
    <Modal
      title={product ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
      onClose={onClose}
      onSubmit={onSubmit}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={pending}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nomi" htmlFor="p-name" required error={errors.name} className="sm:col-span-2">
          <Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label="Turkum" htmlFor="p-cat" error={errors.category}>
          <Select id="p-cat" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {Object.entries(CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="O‘lchov birligi" htmlFor="p-unit" error={errors.unit}>
          <Select id="p-unit" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Narxi (so‘m)" htmlFor="p-price" error={errors.price}>
          <Input id="p-price" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.,]/g, ""))} />
        </Field>
        <Field label="Minimal qoldiq" htmlFor="p-min" error={errors.min_stock}>
          <Input id="p-min" inputMode="decimal" value={form.min_stock} onChange={(e) => set("min_stock", e.target.value.replace(/[^\d.,]/g, ""))} />
        </Field>
        {!product && <p className="text-xs text-muted sm:col-span-2">Qoldiq faqat «Kirim» orqali o‘zgaradi.</p>}
        {formError && <Alert className="sm:col-span-2">{formError}</Alert>}
      </div>
    </Modal>
  );
}
