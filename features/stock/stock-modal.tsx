"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { collect, positiveNumber, REQUIRED, toNumber, useForm } from "@/lib/form";
import { formatDate, formatNumber, STOCK_TYPE_LABELS, todayIso } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type {
  Attachment,
  Paginated,
  Product,
  ProductUnit,
  StockLot,
  StockTransaction,
  StockTransactionCreatePayload,
  StockType,
} from "@/lib/types";
import { FileUpload } from "@/components/files/file-upload";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirmedAction } from "@/components/ui/confirm";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Summary } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { householdLabel, useHouseholdOptions, useProductOptions } from "../options";

/** Units counted in whole pieces (server rejects fractions for these). */
const WHOLE_UNITS: ReadonlySet<ProductUnit> = new Set(["dona", "qop"]);

interface StockModalProps {
  type: StockType;
  /** Preselected product (row action); otherwise chosen from active products. */
  product?: Product;
  onClose: () => void;
  onDone: (transaction: StockTransaction) => void;
}

/** Same text as the server (V3 §5.1): the reserved part is named only when something is reserved. */
function shortMessage(product: Product): string {
  if (product.reserved > 0) {
    return `Omborda yetarli emas. Bo‘sh qoldiq: ${formatNumber(Math.max(product.available, 0))} ${product.unit} (${formatNumber(product.reserved)} ${product.unit} yetkazib berish uchun zaxiralangan)`;
  }
  return `Omborda yetarli emas. Qoldiq: ${formatNumber(product.balance)} ${product.unit}`;
}

export function lotLabel(lot: Pick<StockLot, "id" | "lot_no" | "expiry_date">): string {
  const name = lot.lot_no || `#${lot.id}`;
  return lot.expiry_date ? `${name} · ${formatDate(lot.expiry_date)} gacha` : `${name} · muddatsiz`;
}

export function StockModal({ type, product, onClose, onDone }: StockModalProps) {
  const toast = useToast();
  const confirmAction = useConfirmedAction();
  const products = useProductOptions({ enabled: !product });
  const households = useHouseholdOptions(type === "OUT");
  const [documents, setDocuments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const form = useForm({
    product: product ? String(product.id) : "",
    quantity: "",
    household: "",
    document_no: "",
    note: "",
    lot_no: "",
    expiry_date: "",
    lot: "",
  });

  const selected = product ?? products.data?.results.find((item) => String(item.id) === form.values.product);
  const household = households.data?.results.find((item) => String(item.id) === form.values.household);
  const lots = useApi<Paginated<StockLot>>(
    type === "OUT" && selected ? `/products/${selected.id}/lots` : null,
    { has_remaining: 1, page_size: 200 },
  );
  const lotOptions = lots.data?.results ?? [];
  const chosenLot = lotOptions.find((item) => String(item.id) === form.values.lot);
  const today = todayIso();

  const onSubmit = form.handleSubmit(
    (values) => {
      const quantity = toNumber(values.quantity) ?? 0;
      return collect([
        ["product", values.product ? undefined : REQUIRED],
        [
          "quantity",
          positiveNumber(values.quantity) ??
            (selected && WHOLE_UNITS.has(selected.unit) && !Number.isInteger(quantity)
              ? `“${selected.unit}” uchun butun son kiriting`
              : undefined) ??
            (type === "OUT" && selected && quantity > selected.available ? shortMessage(selected) : undefined),
        ],
        ["document_no", values.document_no.trim() ? undefined : REQUIRED],
        [
          "expiry_date",
          type === "IN" && values.expiry_date && values.expiry_date < today
            ? "Yaroqlilik muddati o‘tgan mahsulotni kirim qilib bo‘lmaydi."
            : undefined,
        ],
        [
          "lot",
          type === "OUT" && chosenLot && quantity > chosenLot.remaining_qty
            ? "Tanlangan partiyada yetarli qoldiq yo‘q."
            : undefined,
        ],
      ]);
    },
    (values) => {
      const payload: StockTransactionCreatePayload = {
        product: Number(values.product),
        type,
        quantity: toNumber(values.quantity) ?? 0,
        document_no: values.document_no.trim(),
      };
      if (type === "OUT" && values.household) payload.household = Number(values.household);
      if (values.note.trim()) payload.note = values.note.trim();
      if (type === "IN" && values.lot_no.trim()) payload.lot_no = values.lot_no.trim();
      if (type === "IN" && values.expiry_date) payload.expiry_date = values.expiry_date;
      if (type === "OUT" && values.lot) payload.lot = Number(values.lot);
      if (documents.length > 0) payload.file_ids = documents.map((file) => file.id);
      const unit = selected?.unit ?? "";
      return confirmAction(
        {
          title: `${STOCK_TYPE_LABELS[type]}ni tasdiqlang`,
          confirmLabel: "Tasdiqlash",
          message: (
            <div className="flex flex-col gap-3">
              <p className="text-muted">Ombor operatsiyasi saqlangandan so‘ng o‘zgartirib bo‘lmaydi.</p>
              <Summary
                items={[
                  ["Amal", STOCK_TYPE_LABELS[type]],
                  ["Mahsulot", selected?.name ?? "—"],
                  ["Miqdori", `${formatNumber(payload.quantity)} ${unit}`],
                  ...(type === "OUT"
                    ? ([
                        ["Xonadon", household ? householdLabel(household) : "—"],
                        ["Partiya", chosenLot ? lotLabel(chosenLot) : "Avtomatik (eng yaqin muddat)"],
                      ] as const)
                    : ([
                        ["Partiya raqami", payload.lot_no ?? "—"],
                        ["Yaroqlilik muddati", payload.expiry_date ? formatDate(payload.expiry_date) : "—"],
                      ] as const)),
                  ["Hujjat raqami", payload.document_no],
                  ["Hujjat fayli", documents.length > 0 ? `${documents.length} ta` : "—"],
                ]}
              />
            </div>
          ),
        },
        () => api.post<StockTransaction>("/stock-transactions", payload),
      );
    },
    (transaction) => {
      if (!transaction) return;
      toast.success(
        `${transaction.type_display}: ${transaction.product.name}, ${formatNumber(transaction.quantity)} ${transaction.product.unit} · ${transaction.op_id}`,
      );
      onDone(transaction);
    },
  );

  const quantityHint = selected
    ? type === "OUT" && selected.reserved > 0
      ? `Bo‘sh: ${formatNumber(selected.available)} ${selected.unit} · zaxirada ${formatNumber(selected.reserved)} ${selected.unit}`
      : `Qoldiq: ${formatNumber(selected.balance)} ${selected.unit}`
    : undefined;

  return (
    <Modal
      title={type === "IN" ? "Omborga kirim" : "Ombordan chiqim"}
      description={product ? product.name : undefined}
      onClose={onClose}
      busy={form.pending}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={form.pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={form.pending} disabled={uploading}>
            Davom etish
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!product && (
          <Field label="Mahsulot" required className="sm:col-span-2" {...form.field("product")}>
            <Select
              {...form.control("product")}
              onChange={(event) => {
                form.set("product", event.target.value);
                form.set("lot", "");
              }}
              disabled={products.loading && !products.data}
            >
              <option value="">Tanlang</option>
              {(products.data?.results ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {formatNumber(type === "OUT" ? item.available : item.balance)} {item.unit}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label={`Miqdori${selected ? ` (${selected.unit})` : ""}`}
          required
          hint={quantityHint}
          {...form.field("quantity")}
        >
          <Input {...form.control("quantity")} type="number" inputMode="decimal" min={0} step="any" />
        </Field>
        <Field label="Hujjat raqami" required {...form.field("document_no")}>
          <Input {...form.control("document_no")} autoComplete="off" placeholder="Masalan: YX-15" />
        </Field>
        {type === "IN" && (
          <>
            <Field label="Partiya raqami" hint="Ixtiyoriy, masalan: L-11" {...form.field("lot_no")}>
              <Input {...form.control("lot_no")} autoComplete="off" maxLength={64} />
            </Field>
            <Field label="Yaroqlilik muddati" hint="Vaksina va dorilar uchun" {...form.field("expiry_date")}>
              <Input {...form.control("expiry_date")} type="date" min={today} />
            </Field>
          </>
        )}
        {type === "OUT" && (
          <>
            <Field
              label="Xonadon (oluvchi)"
              hint="Xonadonga berilmasa bo‘sh qoldiring"
              {...form.field("household")}
            >
              <Select {...form.control("household")} disabled={households.loading && !households.data}>
                <option value="">Xonadonsiz</option>
                {(households.data?.results ?? [])
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {householdLabel(item)}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field
              label="Partiya"
              hint={chosenLot ? `Partiyada: ${formatNumber(chosenLot.remaining_qty)} ${selected?.unit ?? ""}` : "Avval eng yaqin muddatli partiya sarflanadi"}
              {...form.field("lot")}
            >
              <Select {...form.control("lot")} disabled={!selected || (lots.loading && !lots.data)}>
                <option value="">Avtomatik</option>
                {lotOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {lotLabel(item)} · {formatNumber(item.remaining_qty)} {item.product.unit}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <Field label="Izoh" className="sm:col-span-2" {...form.field("note")}>
          <Textarea {...form.control("note")} rows={2} />
        </Field>
        <div className="sm:col-span-2">
          <FileUpload
            purpose="STOCK_DOCUMENT"
            value={documents}
            onChange={setDocuments}
            onBusyChange={setUploading}
            max={5}
            label="Hujjat (yuk xati, faktura)"
            hint="Ixtiyoriy · JPG, PNG, WEBP yoki PDF · 10 MB gacha"
            error={form.errors.file_ids}
          />
        </div>
      </div>
      {(products.error || households.error) && (
        <Alert className="mt-4">{(products.error ?? households.error)?.message}</Alert>
      )}
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
