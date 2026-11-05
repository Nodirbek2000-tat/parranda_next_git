"use client";

import { api } from "@/lib/api";
import { collect, nonNegativeNumber, required, toNumber, useForm } from "@/lib/form";
import { CATEGORY_LABELS, entries, UNITS } from "@/lib/format";
import type { Product, ProductCategory, ProductCreatePayload, ProductUnit, ProductUpdatePayload } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

interface ProductModalProps {
  /** Edit this product; create a new one when omitted. */
  product?: Product;
  onClose: () => void;
  onDone: (product: Product) => void;
}

export function ProductModal({ product, onClose, onDone }: ProductModalProps) {
  const toast = useToast();
  const form = useForm({
    name: product?.name ?? "",
    category: product?.category ?? "FEED",
    unit: product?.unit ?? "kg",
    min_stock: product ? String(product.min_stock) : "0",
    price: product?.price === null || product?.price === undefined ? "" : String(product.price),
    consumption_norm:
      product?.consumption_norm === null || product?.consumption_norm === undefined ? "" : String(product.consumption_norm),
    dosage: product?.dosage ?? "",
    description: product?.description ?? "",
  });

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["name", required(values.name)],
        ["min_stock", nonNegativeNumber(values.min_stock)],
        ["price", nonNegativeNumber(values.price, true)],
        ["consumption_norm", nonNegativeNumber(values.consumption_norm, true)],
      ]),
    (values) => {
      const payload: ProductCreatePayload = {
        name: values.name.trim(),
        category: values.category as ProductCategory,
        unit: values.unit as ProductUnit,
        min_stock: toNumber(values.min_stock) ?? 0,
        price: toNumber(values.price) ?? null,
        consumption_norm: toNumber(values.consumption_norm) ?? null,
        dosage: values.dosage.trim(),
        description: values.description.trim(),
      };
      return product
        ? api.patch<Product>(`/products/${product.id}`, payload satisfies ProductUpdatePayload)
        : api.post<Product>("/products", payload);
    },
    (saved) => {
      toast.success(product ? "Mahsulot yangilandi" : `“${saved.name}” qo‘shildi`);
      onDone(saved);
    },
  );

  return (
    <Modal
      title={product ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
      description={product ? undefined : "Qoldiq 0 dan boshlanadi va faqat kirim/chiqim orqali o‘zgaradi."}
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
          <Input {...form.control("name")} autoComplete="off" placeholder="Masalan: Yem PK-1" />
        </Field>
        <Field label="Toifa" required {...form.field("category")}>
          <Select {...form.control("category")}>
            {entries(CATEGORY_LABELS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="O‘lchov birligi" required {...form.field("unit")}>
          <Select {...form.control("unit")}>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Minimal zaxira"
          required
          className="sm:col-span-2"
          hint="Qoldiq shu miqdorga yetganda ogohlantirish beriladi"
          {...form.field("min_stock")}
        >
          <Input {...form.control("min_stock")} type="number" inputMode="decimal" min={0} step="any" />
        </Field>
        <Field label="Narx (so‘m)" {...form.field("price")}>
          <Input {...form.control("price")} type="number" inputMode="decimal" min={0} step="any" placeholder="Ixtiyoriy" />
        </Field>
        <Field label="Sarf me’yori (1 parrandaga)" {...form.field("consumption_norm")}>
          <Input {...form.control("consumption_norm")} type="number" inputMode="decimal" min={0} step="any" placeholder="Ixtiyoriy" />
        </Field>
        {(form.values.category === "VET_DRUG" || form.values.category === "VACCINE" || form.values.dosage) && (
          <Field label="Doza / qo‘llash" className="sm:col-span-2" {...form.field("dosage")}>
            <Input {...form.control("dosage")} autoComplete="off" maxLength={200} placeholder="Masalan: 1 ml / 1 l suvga, 3 kun" />
          </Field>
        )}
        <Field label="Tavsif" className="sm:col-span-2" {...form.field("description")}>
          <Textarea {...form.control("description")} rows={2} maxLength={1000} />
        </Field>
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
