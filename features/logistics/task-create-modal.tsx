"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, toApiError, type FieldErrors } from "@/lib/api";
import { formatQuantity, todayIso } from "@/lib/format";
import { toNumber } from "@/lib/form";
import { useAllPages } from "@/lib/use-api";
import type { Driver, Household, LogisticsTask, Product, TaskCreateBody, Vehicle } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const MAX_ITEMS = 20;
const WHOLE_UNITS = new Set(["dona", "qop"]);

type StockProduct = Product & { available?: number; reserved?: number };

interface ItemRow {
  key: number;
  product: string;
  quantity: string;
}

/** “Yangi topshiriq” (ADMIN, V3 §7.5): household, items with available stock, plan date, optional staff. */
export function TaskCreateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const prefix = useId();
  const households = useAllPages<Household>("/households", { is_active: true });
  const products = useAllPages<StockProduct>("/products", { is_active: true });
  const vehicles = useAllPages<Vehicle>("/logistics/vehicles", { is_active: true });
  const drivers = useAllPages<Driver>("/logistics/drivers", { is_active: true });

  const [household, setHousehold] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([{ key: 1, product: "", quantity: "" }]);
  const [plannedDate, setPlannedDate] = useState("");
  const [note, setNote] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const productById = new Map((products.data?.results ?? []).map((product) => [String(product.id), product]));
  const available = (product: StockProduct) => product.available ?? product.balance - (product.reserved ?? 0);

  const updateRow = (key: number, patch: Partial<ItemRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setErrors((current) => {
      const next = { ...current };
      delete next.items;
      return next;
    });
  };

  const validate = (): FieldErrors => {
    const result: FieldErrors = {};
    if (!household) result.household = "Xonadonni tanlang";
    const chosen = rows.filter((row) => row.product || row.quantity);
    if (chosen.length === 0) result.items = "Kamida bitta mahsulot tanlang.";
    const seen = new Set<string>();
    for (const row of chosen) {
      const product = productById.get(row.product);
      const quantity = toNumber(row.quantity);
      if (!product) result.items = "Har bir qatorda mahsulotni tanlang.";
      else if (seen.has(row.product)) result.items = "Mahsulot takrorlanmasin.";
      else if (quantity === undefined || quantity <= 0) result.items = `“${product.name}”: miqdor 0 dan katta bo‘lsin.`;
      else if (WHOLE_UNITS.has(product.unit) && !Number.isInteger(quantity))
        result.items = `“${product.name}”: “${product.unit}” uchun butun son kiriting`;
      else if (quantity > available(product))
        result.items = `“${product.name}”: omborda yetarli emas. Bo‘sh qoldiq: ${formatQuantity(available(product), product.unit)}`;
      seen.add(row.product);
    }
    if (Boolean(vehicle) !== Boolean(driver)) result[vehicle ? "driver" : "vehicle"] = "Transport va haydovchini birga tanlang.";
    if (plannedDate && plannedDate < todayIso()) result.planned_date = "Sana o‘tgan kun bo‘lishi mumkin emas.";
    return result;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const clientErrors = validate();
    setFormError(null);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;
    const body: TaskCreateBody = {
      household: Number(household),
      items: rows
        .filter((row) => row.product)
        .map((row) => ({ product: Number(row.product), quantity: toNumber(row.quantity) ?? 0 })),
      planned_date: plannedDate || null,
      note: note.trim(),
      vehicle: vehicle ? Number(vehicle) : null,
      driver: driver ? Number(driver) : null,
    };
    setPending(true);
    api
      .post<LogisticsTask>("/logistics/tasks", body)
      .then((task) => {
        toast.success(`${task.code} topshirig‘i yaratildi`);
        onClose();
        router.push(`/logistics/${task.id}`);
      })
      .catch((caught: unknown) => {
        const error = toApiError(caught);
        setPending(false);
        const known = ["household", "items", "planned_date", "vehicle", "driver", "note"];
        setErrors(Object.fromEntries(Object.entries(error.fields).filter(([key]) => known.includes(key))));
        const shown = Object.keys(error.fields).some((key) => known.includes(key));
        if (!shown || error.detail) setFormError(error.detail ?? error.message);
      });
  };

  const loadError = households.error ?? products.error;
  const id = (name: string) => `${prefix}-${name}`;

  return (
    <Modal
      title="Yangi logistika topshirig‘i"
      description="Mahsulotlar topshiriq yaratilganda omborda zaxiralanadi."
      onClose={onClose}
      onSubmit={submit}
      busy={pending}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={pending}>
            Yaratish
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {loadError && <Alert>{loadError.message}</Alert>}
        <Field label="Xonadon" htmlFor={id("household")} error={errors.household} required>
          <Select id={id("household")} value={household} invalid={Boolean(errors.household)} onChange={(e) => setHousehold(e.target.value)}>
            <option value="">{households.data ? "Tanlang" : "Yuklanmoqda…"}</option>
            {(households.data?.results ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code}) — {item.district}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] font-medium text-ink">
            Mahsulotlar <span className="text-danger" aria-hidden>*</span>
          </legend>
          {rows.map((row, index) => {
            const product = productById.get(row.product);
            return (
              <div key={row.key} className="grid grid-cols-[1fr_110px_auto] items-start gap-2">
                <div>
                  <label htmlFor={id(`p${row.key}`)} className="sr-only">
                    {index + 1}-mahsulot
                  </label>
                  <Select id={id(`p${row.key}`)} value={row.product} invalid={Boolean(errors.items)} onChange={(e) => updateRow(row.key, { product: e.target.value })}>
                    <option value="">{products.data ? "Mahsulotni tanlang" : "Yuklanmoqda…"}</option>
                    {(products.data?.results ?? []).map((item) => (
                      <option key={item.id} value={item.id} disabled={available(item) <= 0}>
                        {item.name} — bo‘sh {formatQuantity(available(item), item.unit)}
                      </option>
                    ))}
                  </Select>
                  {product && (
                    <p className="mt-1 text-xs text-muted">
                      Bo‘sh qoldiq: {formatQuantity(available(product), product.unit)}
                      {(product.reserved ?? 0) > 0 && ` · zaxirada ${formatQuantity(product.reserved ?? 0, product.unit)}`}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor={id(`q${row.key}`)} className="sr-only">
                    {index + 1}-mahsulot miqdori
                  </label>
                  <Input
                    id={id(`q${row.key}`)}
                    inputMode="decimal"
                    placeholder={product ? product.unit : "Miqdor"}
                    value={row.quantity}
                    invalid={Boolean(errors.items)}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  />
                </div>
                <IconButton
                  label="Qatorni o‘chirish"
                  tone="quiet-danger"
                  className="mt-1"
                  disabled={rows.length === 1}
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </div>
            );
          })}
          {errors.items && <p className="text-[13px] text-danger">{errors.items}</p>}
          <div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus className="size-4" aria-hidden />}
              disabled={rows.length >= MAX_ITEMS}
              onClick={() => setRows((current) => [...current, { key: Math.max(...current.map((r) => r.key)) + 1, product: "", quantity: "" }])}
            >
              Mahsulot qo‘shish
            </Button>
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reja sanasi" htmlFor={id("planned_date")} error={errors.planned_date}>
            <Input id={id("planned_date")} type="date" min={todayIso()} value={plannedDate} invalid={Boolean(errors.planned_date)} onChange={(e) => setPlannedDate(e.target.value)} />
          </Field>
          <div className="hidden sm:block" />
          <Field label="Transport" htmlFor={id("vehicle")} error={errors.vehicle} hint="Ixtiyoriy: hozir biriktirish">
            <Select id={id("vehicle")} value={vehicle} invalid={Boolean(errors.vehicle)} onChange={(e) => setVehicle(e.target.value)}>
              <option value="">Keyinroq</option>
              {(vehicles.data?.results ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.plate_number}
                  {item.model ? `, ${item.model}` : ""} · faol: {item.active_tasks}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Haydovchi" htmlFor={id("driver")} error={errors.driver}>
            <Select id={id("driver")} value={driver} invalid={Boolean(errors.driver)} onChange={(e) => setDriver(e.target.value)}>
              <option value="">Keyinroq</option>
              {(drivers.data?.results ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.full_name} · faol: {item.active_tasks}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Izoh" htmlFor={id("note")} error={errors.note}>
          <Textarea id={id("note")} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {formError && <Alert>{formError}</Alert>}
      </div>
    </Modal>
  );
}
