"use client";

import { useState } from "react";
import { Hammer, Pencil, Plus, Trash2, Wheat } from "lucide-react";
import { api } from "@/lib/api";
import type { ConstructionOption, ConstructionOptionPayload, FeedNorm, FeedNormPayload } from "@/lib/builder-types";
import { collect, nonNegativeNumber, positiveInt, required, toNumber, useForm } from "@/lib/form";
import { entries, formatNumber, POULTRY_TYPE_LABELS } from "@/lib/format";
import { MAX_PAGE_SIZE, useApi } from "@/lib/use-api";
import type { Paginated, PoultryType } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useProductOptions } from "@/features/options";

/** The norm endpoints may answer with a page or a plain list; both are accepted. */
function asList<T>(data: Paginated<T> | T[] | undefined): T[] | undefined {
  if (!data) return undefined;
  return Array.isArray(data) ? data : data.results;
}

function productName(norm: FeedNorm): string {
  if (norm.product_name) return norm.product_name;
  if (norm.product && typeof norm.product === "object") return norm.product.name;
  if (typeof norm.product === "number") return `#${norm.product}`;
  return "—";
}

function productId(norm: FeedNorm): number | null {
  if (norm.product && typeof norm.product === "object") return norm.product.id;
  return typeof norm.product === "number" ? norm.product : null;
}

function money(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${formatNumber(Number(value))} so‘m`;
}

/** "Me’yorlar" tab (API_CONTRACT_V4 §5): feed norms and construction options. */
export function NormsTab() {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <FeedNormsCard />
      <ConstructionOptionsCard />
    </div>
  );
}

function FeedNormsCard() {
  const confirm = useConfirm();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ norm?: FeedNorm } | null>(null);
  const resource = useApi<Paginated<FeedNorm> | FeedNorm[]>("/feed-norms", { page_size: MAX_PAGE_SIZE });
  const rows = asList(resource.data);
  const sorted = rows
    ? [...rows].sort((a, b) => a.poultry_type.localeCompare(b.poultry_type) || a.day_from - b.day_from)
    : undefined;

  const columns: Column<FeedNorm>[] = [
    {
      key: "type",
      header: "Parranda turi",
      primary: true,
      cell: (row) => <span className="font-medium">{row.poultry_type_display || POULTRY_TYPE_LABELS[row.poultry_type]}</span>,
    },
    { key: "days", header: "Yoshi (kun)", align: "right", cell: (row) => `${row.day_from}–${row.day_to}` },
    {
      key: "grams",
      header: "1 parrandaga (g/kun)",
      align: "right",
      cell: (row) => <span className="font-medium">{formatNumber(Number(row.grams_per_bird_day))}</span>,
    },
    { key: "product", header: "Yem", cell: (row) => productName(row) },
    { key: "note", header: "Izoh", hideOnMobile: true, cell: (row) => <span className="text-muted">{row.note || "—"}</span> },
  ];

  const remove = (norm: FeedNorm) =>
    void confirm({
      title: "Me’yorni o‘chirish",
      confirmLabel: "O‘chirish",
      tone: "danger",
      message: (
        <p>
          {POULTRY_TYPE_LABELS[norm.poultry_type]}, {norm.day_from}–{norm.day_to}-kunlar me’yori o‘chiriladi.
        </p>
      ),
      onConfirm: async () => {
        await api.delete(`/feed-norms/${norm.id}`);
        toast.success("Me’yor o‘chirildi");
      },
    });

  return (
    <Card>
      <CardHeader
        title="Yem me’yorlari"
        description="Parranda yoshiga qarab 1 boshga kunlik yem (gramm). Bir tur uchun kunlar oralig‘i ustma-ust tushmasin."
        actions={
          <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setDialog({})}>
            Me’yor qo‘shish
          </Button>
        }
      />
      <div className="mt-4 border-t border-line">
        <StaleDataError error={rows ? resource.error : null} onRetry={resource.reload} />
        {!rows && resource.error ? (
          <ErrorState error={resource.error} onRetry={resource.reload} />
        ) : !sorted ? (
          <TableSkeleton rows={3} />
        ) : sorted.length === 0 ? (
          <EmptyState icon={Wheat} title="Yem me’yorlari kiritilmagan" />
        ) : (
          <DataTable
            caption="Yem me’yorlari"
            rows={sorted}
            columns={columns}
            rowKey={(row) => row.id}
            stale={resource.loading}
            actions={(row) => (
              <>
                <IconButton label="Tahrirlash" onClick={() => setDialog({ norm: row })}>
                  <Pencil className="size-4" aria-hidden />
                </IconButton>
                <IconButton label="O‘chirish" tone="quiet-danger" onClick={() => remove(row)}>
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </>
            )}
          />
        )}
      </div>
      {dialog && <FeedNormModal norm={dialog.norm} onClose={() => setDialog(null)} />}
    </Card>
  );
}

function FeedNormModal({ norm, onClose }: { norm?: FeedNorm; onClose: () => void }) {
  const toast = useToast();
  const products = useProductOptions({ activeOnly: false });
  const feeds = (products.data?.results ?? []).filter((item) => item.category === "FEED");
  const form = useForm({
    poultry_type: norm?.poultry_type ?? "BROILER",
    day_from: norm ? String(norm.day_from) : "",
    day_to: norm ? String(norm.day_to) : "",
    grams_per_bird_day: norm ? String(norm.grams_per_bird_day) : "",
    product: norm ? String(productId(norm) ?? "") : "",
    note: norm?.note ?? "",
  });

  const dayError = (value: string) => {
    const base = positiveInt(value);
    if (base) return base;
    return Number(value) > 400 ? "1 dan 400 gacha" : undefined;
  };

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["day_from", dayError(values.day_from)],
        [
          "day_to",
          dayError(values.day_to) ??
            (Number(values.day_to) < Number(values.day_from) ? "Boshlanish kunidan kichik bo‘lmasin" : undefined),
        ],
        ["grams_per_bird_day", nonNegativeNumber(values.grams_per_bird_day)],
      ]),
    (values) => {
      const payload: FeedNormPayload = {
        poultry_type: values.poultry_type as PoultryType,
        day_from: Number(values.day_from),
        day_to: Number(values.day_to),
        grams_per_bird_day: toNumber(values.grams_per_bird_day) ?? 0,
        product: values.product ? Number(values.product) : null,
        note: values.note.trim(),
      };
      return norm ? api.patch<FeedNorm>(`/feed-norms/${norm.id}`, payload) : api.post<FeedNorm>("/feed-norms", payload);
    },
    () => {
      toast.success(norm ? "Me’yor yangilandi" : "Me’yor qo‘shildi");
      onClose();
    },
  );

  return (
    <Modal
      title={norm ? "Yem me’yorini tahrirlash" : "Yangi yem me’yori"}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parranda turi" required className="sm:col-span-2" {...form.field("poultry_type")}>
          <Select {...form.control("poultry_type")}>
            {entries(POULTRY_TYPE_LABELS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Yoshi: dan (kun)" required {...form.field("day_from")}>
          <Input {...form.control("day_from")} type="number" inputMode="numeric" min={1} max={400} step={1} />
        </Field>
        <Field label="Yoshi: gacha (kun)" required {...form.field("day_to")}>
          <Input {...form.control("day_to")} type="number" inputMode="numeric" min={1} max={400} step={1} />
        </Field>
        <Field label="1 parrandaga kuniga (gramm)" required {...form.field("grams_per_bird_day")}>
          <Input {...form.control("grams_per_bird_day")} type="number" inputMode="decimal" min={0} step="any" />
        </Field>
        <Field label="Yem (ixtiyoriy)" {...form.field("product")}>
          <Select {...form.control("product")}>
            <option value="">Tanlanmagan</option>
            {feeds.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.is_active ? "" : " (nofaol)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Izoh" className="sm:col-span-2" {...form.field("note")}>
          <Textarea {...form.control("note")} rows={2} />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}

function ConstructionOptionsCard() {
  const confirm = useConfirm();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ option?: ConstructionOption } | null>(null);
  const resource = useApi<Paginated<ConstructionOption> | ConstructionOption[]>("/construction-options", { page_size: MAX_PAGE_SIZE });
  const rows = asList(resource.data);

  const columns: Column<ConstructionOption>[] = [
    {
      key: "name",
      header: "Nomi",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {row.name}
            {!row.is_active && <Badge>Nofaol</Badge>}
          </span>
          {row.description && <span className="max-w-sm truncate text-xs font-normal text-muted">{row.description}</span>}
        </span>
      ),
    },
    { key: "unit", header: "Birlik", cell: (row) => row.unit || "—" },
    { key: "price", header: "Narx", align: "right", cell: (row) => money(row.price) },
  ];

  const remove = (option: ConstructionOption) =>
    void confirm({
      title: "Variantni o‘chirish",
      confirmLabel: "O‘chirish",
      tone: "danger",
      message: (
        <p>
          <strong>{option.name}</strong> o‘chiriladi. Vaqtincha yashirish uchun “Faol” belgisini o‘chirish kifoya.
        </p>
      ),
      onConfirm: async () => {
        await api.delete(`/construction-options/${option.id}`);
        toast.success("O‘chirildi");
      },
    });

  return (
    <Card>
      <CardHeader
        title="Qurilish variantlari"
        description="Xonadonda quriladigan inshoot va jihozlar ro‘yxati (narx bilan)."
        actions={
          <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setDialog({})}>
            Variant qo‘shish
          </Button>
        }
      />
      <div className="mt-4 border-t border-line">
        <StaleDataError error={rows ? resource.error : null} onRetry={resource.reload} />
        {!rows && resource.error ? (
          <ErrorState error={resource.error} onRetry={resource.reload} />
        ) : !rows ? (
          <TableSkeleton rows={3} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Hammer} title="Qurilish variantlari kiritilmagan" />
        ) : (
          <DataTable
            caption="Qurilish variantlari"
            rows={rows}
            columns={columns}
            rowKey={(row) => row.id}
            stale={resource.loading}
            actions={(row) => (
              <>
                <IconButton label="Tahrirlash" onClick={() => setDialog({ option: row })}>
                  <Pencil className="size-4" aria-hidden />
                </IconButton>
                <IconButton label="O‘chirish" tone="quiet-danger" onClick={() => remove(row)}>
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </>
            )}
          />
        )}
      </div>
      {dialog && <ConstructionOptionModal option={dialog.option} onClose={() => setDialog(null)} />}
    </Card>
  );
}

function ConstructionOptionModal({ option, onClose }: { option?: ConstructionOption; onClose: () => void }) {
  const toast = useToast();
  const [active, setActive] = useState(option?.is_active ?? true);
  const form = useForm({
    name: option?.name ?? "",
    description: option?.description ?? "",
    unit: option?.unit ?? "",
    price: option?.price === null || option?.price === undefined ? "" : String(option.price),
  });

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["name", required(values.name)],
        ["price", nonNegativeNumber(values.price, true)],
      ]),
    (values) => {
      const payload: ConstructionOptionPayload = {
        name: values.name.trim(),
        description: values.description.trim(),
        unit: values.unit.trim(),
        price: toNumber(values.price) ?? null,
        is_active: active,
      };
      return option
        ? api.patch<ConstructionOption>(`/construction-options/${option.id}`, payload)
        : api.post<ConstructionOption>("/construction-options", payload);
    },
    () => {
      toast.success(option ? "Variant yangilandi" : "Variant qo‘shildi");
      onClose();
    },
  );

  return (
    <Modal
      title={option ? "Qurilish variantini tahrirlash" : "Yangi qurilish varianti"}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nomi" required className="sm:col-span-2" {...form.field("name")}>
          <Input {...form.control("name")} autoComplete="off" placeholder="Masalan: Parranda uyi (20 m²)" />
        </Field>
        <Field label="Tavsif" className="sm:col-span-2" {...form.field("description")}>
          <Textarea {...form.control("description")} rows={2} />
        </Field>
        <Field label="O‘lchov birligi" {...form.field("unit")}>
          <Input {...form.control("unit")} autoComplete="off" placeholder="dona, m², komplekt" />
        </Field>
        <Field label="Narx (so‘m)" {...form.field("price")}>
          <Input {...form.control("price")} type="number" inputMode="decimal" min={0} step="any" />
        </Field>
        <label className="flex items-center gap-3 text-sm text-ink sm:col-span-2">
          <Switch checked={active} onChange={setActive} label="Faol" />
          Faol (yangi ishlarda tanlash mumkin)
        </label>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
