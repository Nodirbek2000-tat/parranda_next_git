"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Car, PencilLine, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { api, type FieldErrors } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { required, toNumber, useForm } from "@/lib/form";
import { useDebounced, usePagedApi } from "@/lib/use-api";
import type { Vehicle } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useFleetDelete } from "./use-fleet-delete";

const PAGE_SIZE = 50;
const PLATE_RE = /^[0-9A-Z ]{5,15}$/;
export type ActiveFilter = "active" | "inactive" | "all";

export function activeQuery(filter: ActiveFilter): boolean | undefined {
  return filter === "all" ? undefined : filter === "active";
}

export function useFleetFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("active");
  const active: ActiveFilter = raw === "0" ? "inactive" : raw === "all" ? "all" : "active";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debounced = useDebounced(search.trim());
  const setParam = (key: string, value: string) => {
    const query = new URLSearchParams(params.toString());
    if (value) query.set(key, value);
    else query.delete(key);
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };
  return {
    active,
    setActive: (value: ActiveFilter) => setParam("active", value === "active" ? "" : value === "inactive" ? "0" : "all"),
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setParam("search", value.trim());
    },
    debounced,
  };
}

export const ACTIVE_TABS = [
  { key: "active", label: "Faol" },
  { key: "inactive", label: "Nofaol" },
  { key: "all", label: "Barchasi" },
] as const;

/** /logistics/vehicles — fleet list, create/edit, activate/deactivate (V3 §7.1). */
export function VehiclesPage() {
  const user = useCurrentUser();
  const canWrite = user.role === "ADMIN" || user.role === "LOGISTICS";
  const confirm = useConfirm();
  const toast = useToast();
  const filters = useFleetFilters();
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const list = usePagedApi<Vehicle>("/logistics/vehicles", { search: filters.debounced, is_active: activeQuery(filters.active) }, PAGE_SIZE);
  const data = list.data;

  const { deleteVehicle } = useFleetDelete();

  const toggle = (vehicle: Vehicle) =>
    void confirm({
      title: vehicle.is_active ? "Transportni nofaol qilish" : "Transportni faollashtirish",
      confirmLabel: vehicle.is_active ? "Nofaol qilish" : "Faollashtirish",
      tone: vehicle.is_active ? "danger" : "primary",
      message: vehicle.is_active ? (
        <p>
          <strong>{vehicle.plate_number}</strong> yangi topshiriqlarga biriktirilmaydi.
          {vehicle.active_tasks > 0 && ` Hozirgi ${vehicle.active_tasks} ta faol topshiriq o‘zgarmaydi.`}
        </p>
      ) : (
        <p>
          <strong>{vehicle.plate_number}</strong> yana topshiriqlarga biriktirilishi mumkin bo‘ladi.
        </p>
      ),
      onConfirm: async () => {
        await api.patch(`/logistics/vehicles/${vehicle.id}`, { is_active: !vehicle.is_active });
        toast.success(vehicle.is_active ? "Transport nofaol qilindi" : "Transport faollashtirildi");
      },
    });

  const columns: Column<Vehicle>[] = [
    {
      key: "plate",
      header: "Davlat raqami",
      primary: true,
      cell: (vehicle) => (
        <span className="flex flex-col">
          <span className="font-semibold tracking-wide tabular-nums">{vehicle.plate_number}</span>
          <span className="text-xs font-normal text-muted">{vehicle.model || "Modeli ko‘rsatilmagan"}</span>
        </span>
      ),
    },
    {
      key: "capacity",
      header: "Sig‘imi",
      align: "right",
      cell: (vehicle) => (vehicle.capacity_kg === null ? "—" : `${formatNumber(vehicle.capacity_kg)} kg`),
    },
    { key: "tasks", header: "Faol topshiriq", align: "right", cell: (vehicle) => formatNumber(vehicle.active_tasks) },
    {
      key: "status",
      header: "Holat",
      cell: (vehicle) => <Badge tone={vehicle.is_active ? "success" : "neutral"}>{vehicle.is_active ? "Faol" : "Nofaol"}</Badge>,
    },
    { key: "note", header: "Izoh", hideOnMobile: true, className: "max-w-[240px]", cell: (vehicle) => <span className="block truncate text-muted">{vehicle.note || "—"}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transport"
        description="Yetkazib berish uchun transport vositalari va ularning bandligi"
        breadcrumbs={[{ label: "Logistika", href: "/logistics" }, { label: "Transport" }]}
        actions={
          canWrite ? (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing("new")}>
              Transport qo‘shish
            </Button>
          ) : undefined
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Tabs label="Holat" items={ACTIVE_TABS} value={filters.active} onChange={filters.setActive} />
          <SearchInput
            id="vehicle-search"
            label="Qidirish"
            placeholder="Raqam yoki model"
            value={filters.search}
            onChange={filters.setSearch}
            className="sm:w-72"
          />
        </div>
        <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
        {!data && list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={Car}
            title={filters.debounced ? "Hech narsa topilmadi" : "Transport hali qo‘shilmagan"}
            action={
              canWrite && !filters.debounced ? (
                <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing("new")}>
                  Transport qo‘shish
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable
              caption="Transport vositalari"
              rows={data.results}
              columns={columns}
              rowKey={(vehicle) => vehicle.id}
              stale={list.loading}
              actions={
                canWrite
                  ? (vehicle) => (
                      <>
                        <IconButton label={`${vehicle.plate_number}: tahrirlash`} onClick={() => setEditing(vehicle)}>
                          <PencilLine className="size-4" aria-hidden />
                        </IconButton>
                        <IconButton
                          label={vehicle.is_active ? `${vehicle.plate_number}: nofaol qilish` : `${vehicle.plate_number}: faollashtirish`}
                          tone={vehicle.is_active ? "quiet-danger" : "default"}
                          onClick={() => toggle(vehicle)}
                        >
                          {vehicle.is_active ? <PowerOff className="size-4" aria-hidden /> : <Power className="size-4" aria-hidden />}
                        </IconButton>
                        <IconButton
                          label={`${vehicle.plate_number}: o‘chirish`}
                          tone="quiet-danger"
                          onClick={() => deleteVehicle(vehicle)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </IconButton>
                      </>
                    )
                  : undefined
              }
            />
            <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={list.setPage} disabled={list.loading} />
          </>
        )}
      </Card>
      {editing !== null && <VehicleModal vehicle={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function VehicleModal({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({
    plate_number: vehicle?.plate_number ?? "",
    model: vehicle?.model ?? "",
    capacity_kg: vehicle?.capacity_kg != null ? String(vehicle.capacity_kg) : "",
    note: vehicle?.note ?? "",
  });

  const validate = (values: typeof form.values): FieldErrors => {
    const errors: FieldErrors = {};
    const plate = values.plate_number.toUpperCase().replace(/\s+/g, " ").trim();
    const missing = required(plate);
    if (missing) errors.plate_number = missing;
    else if (!PLATE_RE.test(plate)) errors.plate_number = "Davlat raqami 5–15 ta lotin harfi yoki raqamdan iborat bo‘lsin (masalan, 01 A 123 BC).";
    if (values.capacity_kg.trim()) {
      const capacity = toNumber(values.capacity_kg);
      if (capacity === undefined || capacity <= 0) errors.capacity_kg = "0 dan katta son kiriting";
    }
    return errors;
  };

  const submit = form.handleSubmit(
    validate,
    (values) => {
      const body = {
        plate_number: values.plate_number,
        model: values.model.trim(),
        capacity_kg: values.capacity_kg.trim() ? toNumber(values.capacity_kg) : null,
        note: values.note.trim(),
      };
      return vehicle ? api.patch<Vehicle>(`/logistics/vehicles/${vehicle.id}`, body) : api.post<Vehicle>("/logistics/vehicles", body);
    },
    (saved) => {
      toast.success(vehicle ? "Saqlandi" : `${saved.plate_number} qo‘shildi`);
      onClose();
    },
  );

  return (
    <Modal
      title={vehicle ? "Transportni tahrirlash" : "Yangi transport"}
      onClose={onClose}
      onSubmit={submit}
      busy={form.pending}
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
      <div className="flex flex-col gap-4">
        <Field label="Davlat raqami" {...form.field("plate_number")} required hint="Masalan: 01 A 123 BC">
          <Input {...form.control("plate_number")} autoCapitalize="characters" maxLength={20} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Modeli" {...form.field("model")}>
            <Input {...form.control("model")} maxLength={120} placeholder="Isuzu NPR" />
          </Field>
          <Field label="Sig‘imi (kg)" {...form.field("capacity_kg")} hint="Bo‘sh qolsa, tekshirilmaydi">
            <Input {...form.control("capacity_kg")} inputMode="decimal" />
          </Field>
        </div>
        <Field label="Izoh" {...form.field("note")}>
          <Textarea {...form.control("note")} maxLength={500} />
        </Field>
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}
