"use client";

import { api } from "@/lib/api";
import { collect, nonNegativeNumber, required, toNumber, useForm } from "@/lib/form";
import { CATEGORY_LABELS, entries, UNITS } from "@/lib/format";
import type { Product, ProductCategory, ProductCreatePayload, ProductUnit, ProductUpdatePayload } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
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
  });

  const onSubmit = form.handleSubmit(
    (values) =>
      collect([
        ["name", required(values.name)],
        ["min_stock", nonNegativeNumber(values.min_stock)],
      ]),
    (values) => {
      const payload: ProductCreatePayload = {
        name: values.name.trim(),
        category: values.category as ProductCategory,
        unit: values.unit as ProductUnit,
        min_stock: toNumber(values.min_stock) ?? 0,
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
      </div>
      {form.formError && <Alert className="mt-4">{form.formError}</Alert>}
    </Modal>
  );
}
