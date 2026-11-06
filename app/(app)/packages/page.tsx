"use client";

import { useState, type FormEvent } from "react";
import { Package as PackageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { Alert, Badge, Button, Card, Empty, Field, IconButton, Input, Loadable, PageHeader, Select, Textarea } from "@/components/ui";
import { api, ApiError, errorMessage, listOf } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { isAdmin } from "@/lib/roles";
import type { Package, PackageItem, Paged, Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function productIdOf(item: PackageItem): number | null {
  if (item.product_id) return item.product_id;
  if (item.product && typeof item.product === "object") return item.product.id;
  return typeof item.product === "number" ? item.product : null;
}

function itemLabel(item: PackageItem): { name: string; unit: string } {
  const obj = item.product && typeof item.product === "object" ? item.product : null;
  return { name: item.product_name ?? obj?.name ?? `#${productIdOf(item)}`, unit: item.unit ?? obj?.unit ?? "" };
}

export default function PackagesPage() {
  const user = useMe();
  const admin = isAdmin(user);
  const packages = useApi<Paged<Package>>("/packages");
  const [editing, setEditing] = useState<Package | null>(null);

  return (
    <>
      <PageHeader title="Paketlar" subtitle="Har bir xonadonga beriladigan jo‘jaxona to‘plami" />
      <Loadable data={packages.data} error={packages.error} reload={packages.reload}>
        {(data) => {
          const rows = listOf(data);
          if (!rows.length) return <Empty title="Paketlar yo‘q" icon={<PackageIcon className="size-8" aria-hidden />} />;
          return (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((pkg) => (
                <Card key={pkg.id} className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">
                        {pkg.name} {pkg.is_demo && <Badge>DEMO</Badge>}
                      </p>
                      <p className="text-xs text-muted">
                        {pkg.area_sotix ? `${fmtNumber(pkg.area_sotix)} sotix` : ""}
                        {pkg.capacity_birds ? ` · ${fmtNumber(pkg.capacity_birds)} bosh parranda` : ""}
                      </p>
                    </div>
                    {admin && (
                      <IconButton label="Tahrirlash" onClick={() => setEditing(pkg)}>
                        <Pencil className="size-4" aria-hidden />
                      </IconButton>
                    )}
                  </div>
                  {pkg.price ? <p className="text-lg font-semibold text-primary">{fmtMoney(pkg.price)}</p> : null}
                  {pkg.description && <p className="whitespace-pre-line text-sm text-muted">{pkg.description}</p>}
                  {pkg.items && pkg.items.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-1 rounded-xl bg-subtle p-3 text-sm">
                      {pkg.items.map((item, index) => {
                        const label = itemLabel(item);
                        return (
                          <li key={item.id ?? index} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">{label.name}</span>
                            <span className="shrink-0 tabular-nums text-muted">
                              {fmtNumber(item.qty)} {label.unit}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          );
        }}
      </Loadable>
      {editing && <PackageModal pkg={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

interface ItemRow {
  key: number;
  product_id: string;
  qty: string;
}

function PackageModal({ pkg, onClose }: { pkg: Package; onClose: () => void }) {
  const toast = useToast();
  const products = useApi<Paged<Product>>("/products");
  const [form, setForm] = useState({
    name: pkg.name,
    area_sotix: pkg.area_sotix !== undefined && pkg.area_sotix !== null ? String(pkg.area_sotix) : "",
    capacity_birds: pkg.capacity_birds !== undefined && pkg.capacity_birds !== null ? String(pkg.capacity_birds) : "",
    price: pkg.price !== undefined && pkg.price !== null ? String(pkg.price) : "",
    description: pkg.description ?? "",
  });
  const [items, setItems] = useState<ItemRow[]>(() =>
    (pkg.items ?? []).map((item, index) => ({ key: index, product_id: String(productIdOf(item) ?? ""), qty: String(item.qty) })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const productList = listOf(products.data);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: "Majburiy maydon" });
      return;
    }
    const cleanItems = items.filter((row) => row.product_id && Number(row.qty) > 0);
    setPending(true);
    setFormError(null);
    try {
      await api.patch(`/packages/${pkg.id}`, {
        name: form.name.trim(),
        ...(form.area_sotix ? { area_sotix: Number(form.area_sotix.replace(",", ".")) } : {}),
        ...(form.capacity_birds ? { capacity_birds: Number(form.capacity_birds) } : {}),
        price: form.price ? Number(form.price) : 0,
        description: form.description.trim(),
        // products without a list (e.g. /products not allowed) keep the old items: send items only when loaded
        ...(products.data ? { items: cleanItems.map((row) => ({ product_id: Number(row.product_id), qty: Number(row.qty.replace(",", ".")) })) } : {}),
      });
      toast.success("Paket saqlandi");
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) setErrors(caught.fields);
      setFormError(errorMessage(caught));
      setPending(false);
    }
  };

  return (
    <Modal
      title="Paketni tahrirlash"
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nomi" htmlFor="pk-name" required error={errors.name} className="sm:col-span-3">
          <Input id="pk-name" value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label="Maydon (sotix)" htmlFor="pk-area" error={errors.area_sotix}>
          <Input id="pk-area" inputMode="decimal" value={form.area_sotix} onChange={(e) => set("area_sotix", e.target.value.replace(/[^\d.,]/g, ""))} />
        </Field>
        <Field label="Sig‘imi (bosh)" htmlFor="pk-cap" error={errors.capacity_birds}>
          <Input id="pk-cap" inputMode="numeric" value={form.capacity_birds} onChange={(e) => set("capacity_birds", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Narxi (so‘m)" htmlFor="pk-price" error={errors.price}>
          <Input id="pk-price" inputMode="numeric" value={form.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Tavsif" htmlFor="pk-desc" error={errors.description} className="sm:col-span-3">
          <Textarea id="pk-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2 sm:col-span-3">
          <p className="text-[13px] font-medium">Tarkibi</p>
          {products.error && !products.data && <Alert tone="warning">{products.error}</Alert>}
          {items.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <Select
                value={row.product_id}
                onChange={(e) => setItems((list) => list.map((r) => (r.key === row.key ? { ...r, product_id: e.target.value } : r)))}
                aria-label="Mahsulot"
                className="min-w-0 flex-1"
              >
                <option value="">— mahsulot —</option>
                {productList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </Select>
              <Input
                value={row.qty}
                inputMode="decimal"
                onChange={(e) => setItems((list) => list.map((r) => (r.key === row.key ? { ...r, qty: e.target.value.replace(/[^\d.,]/g, "") } : r)))}
                aria-label="Miqdori"
                className="w-24"
              />
              <IconButton label="O‘chirish" onClick={() => setItems((list) => list.filter((r) => r.key !== row.key))}>
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={!products.data}
            onClick={() => setItems((list) => [...list, { key: Date.now(), product_id: "", qty: "" }])}
            icon={<Plus className="size-4" aria-hidden />}
          >
            Mahsulot qo‘shish
          </Button>
          {errors.items && <p className="text-[13px] text-danger">{errors.items}</p>}
        </div>
        {formError && <Alert className="sm:col-span-3">{formError}</Alert>}
      </div>
    </Modal>
  );
}
