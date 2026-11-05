"use client";

import { useState } from "react";
import { IdCard, PencilLine, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { api, type FieldErrors } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { formatNumber, formatPhone } from "@/lib/format";
import { required, useForm } from "@/lib/form";
import { useAllPages, usePagedApi } from "@/lib/use-api";
import type { Driver, User } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { PhoneLink } from "@/components/ui/phone-link";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useFleetDelete } from "./use-fleet-delete";
import { ACTIVE_TABS, activeQuery, useFleetFilters } from "./vehicles-page";

const PAGE_SIZE = 50;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,19}$/;

function userName(user: Pick<User, "first_name" | "last_name" | "username">): string {
  return `${user.first_name} ${user.last_name}`.trim() || user.username;
}

/** /logistics/drivers — drivers, optional link to a LOGISTICS user (Telegram), activate/deactivate (V3 §7.2). */
export function DriversPage() {
  const user = useCurrentUser();
  const canWrite = user.role === "ADMIN" || user.role === "LOGISTICS";
  const confirm = useConfirm();
  const toast = useToast();
  const filters = useFleetFilters();
  const { deleteDriver } = useFleetDelete();
  const [editing, setEditing] = useState<Driver | "new" | null>(null);
  const list = usePagedApi<Driver>("/logistics/drivers", { search: filters.debounced, is_active: activeQuery(filters.active) }, PAGE_SIZE);
  const data = list.data;

  const toggle = (driver: Driver) =>
    void confirm({
      title: driver.is_active ? "Haydovchini nofaol qilish" : "Haydovchini faollashtirish",
      confirmLabel: driver.is_active ? "Nofaol qilish" : "Faollashtirish",
      tone: driver.is_active ? "danger" : "primary",
      message: (
        <p>
          <strong>{driver.full_name}</strong>{" "}
          {driver.is_active ? "yangi topshiriqlarga biriktirilmaydi." : "yana topshiriqlarga biriktirilishi mumkin bo‘ladi."}
        </p>
      ),
      onConfirm: async () => {
        await api.patch(`/logistics/drivers/${driver.id}`, { is_active: !driver.is_active });
        toast.success(driver.is_active ? "Haydovchi nofaol qilindi" : "Haydovchi faollashtirildi");
      },
    });

  const columns: Column<Driver>[] = [
    {
      key: "name",
      header: "Haydovchi",
      primary: true,
      cell: (driver) => (
        <span className="flex flex-col">
          <span className="font-medium">{driver.full_name}</span>
          <span className="text-xs font-normal text-muted">{formatPhone(driver.phone)}</span>
        </span>
      ),
    },
    { key: "license", header: "Guvohnoma", hideOnMobile: true, cell: (driver) => driver.license_no || "—" },
    {
      key: "user",
      header: "Foydalanuvchi",
      cell: (driver) =>
        driver.user ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span>{driver.user.full_name}</span>
            {driver.user.telegram_linked ? <Badge tone="info">Telegram</Badge> : <Badge>Telegram yo‘q</Badge>}
          </span>
        ) : (
          <span className="text-muted">Bog‘lanmagan</span>
        ),
    },
    { key: "tasks", header: "Faol topshiriq", align: "right", cell: (driver) => formatNumber(driver.active_tasks) },
    {
      key: "status",
      header: "Holat",
      cell: (driver) => <Badge tone={driver.is_active ? "success" : "neutral"}>{driver.is_active ? "Faol" : "Nofaol"}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Haydovchilar"
        description="Haydovchi Telegram xabarlarini bog‘langan logistika xodimi hisobi orqali oladi"
        breadcrumbs={[{ label: "Logistika", href: "/logistics" }, { label: "Haydovchilar" }]}
        actions={
          canWrite ? (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing("new")}>
              Haydovchi qo‘shish
            </Button>
          ) : undefined
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Tabs label="Holat" items={ACTIVE_TABS} value={filters.active} onChange={filters.setActive} />
          <SearchInput
            id="driver-search"
            label="Qidirish"
            placeholder="Ism, telefon yoki guvohnoma"
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
            icon={IdCard}
            title={filters.debounced ? "Hech narsa topilmadi" : "Haydovchilar hali qo‘shilmagan"}
            action={
              canWrite && !filters.debounced ? (
                <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing("new")}>
                  Haydovchi qo‘shish
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable
              caption="Haydovchilar"
              rows={data.results}
              columns={columns}
              rowKey={(driver) => driver.id}
              stale={list.loading}
              actions={(driver) => (
                <>
                  <PhoneLink phone={driver.phone} className="sm:hidden" />
                  {canWrite && (
                    <>
                      <IconButton label={`${driver.full_name}: tahrirlash`} onClick={() => setEditing(driver)}>
                        <PencilLine className="size-4" aria-hidden />
                      </IconButton>
                      <IconButton
                        label={driver.is_active ? `${driver.full_name}: nofaol qilish` : `${driver.full_name}: faollashtirish`}
                        tone={driver.is_active ? "quiet-danger" : "default"}
                        onClick={() => toggle(driver)}
                      >
                        {driver.is_active ? <PowerOff className="size-4" aria-hidden /> : <Power className="size-4" aria-hidden />}
                      </IconButton>
                      <IconButton label={`${driver.full_name}: o‘chirish`} tone="quiet-danger" onClick={() => deleteDriver(driver)}>
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    </>
                  )}
                </>
              )}
            />
            <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={list.setPage} disabled={list.loading} />
          </>
        )}
      </Card>
      {editing !== null && <DriverModal driver={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DriverModal({ driver, onClose }: { driver: Driver | null; onClose: () => void }) {
  const me = useCurrentUser();
  const toast = useToast();
  const isAdmin = me.role === "ADMIN";
  // Only ADMIN may list users; a logistics worker can link himself (or keep the current link).
  const workers = useAllPages<User>(isAdmin ? "/users" : null, { role: "LOGISTICS", is_active: true });
  const options: { id: number; label: string }[] = isAdmin
    ? (workers.data?.results ?? []).map((user) => ({ id: user.id, label: `${userName(user)} (${user.username})` }))
    : [
        { id: me.id, label: `Men — ${userName(me)}` },
        ...(driver?.user && driver.user.id !== me.id ? [{ id: driver.user.id, label: driver.user.full_name }] : []),
      ];
  if (driver?.user && !options.some((option) => option.id === driver.user?.id)) {
    options.push({ id: driver.user.id, label: driver.user.full_name });
  }

  const form = useForm({
    full_name: driver?.full_name ?? "",
    phone: driver?.phone ?? "+998 ",
    license_no: driver?.license_no ?? "",
    user: driver?.user ? String(driver.user.id) : "",
    note: driver?.note ?? "",
  });

  const validate = (values: typeof form.values): FieldErrors => {
    const errors: FieldErrors = {};
    const name = values.full_name.trim();
    if (required(name)) errors.full_name = required(name) as string;
    else if (name.length < 3) errors.full_name = "Kamida 3 ta belgi kiriting.";
    if (!PHONE_RE.test(values.phone.trim())) errors.phone = "Telefon raqami noto‘g‘ri";
    return errors;
  };

  const submit = form.handleSubmit(
    validate,
    (values) => {
      const body = {
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        license_no: values.license_no.trim(),
        user: values.user ? Number(values.user) : null,
        note: values.note.trim(),
      };
      return driver ? api.patch<Driver>(`/logistics/drivers/${driver.id}`, body) : api.post<Driver>("/logistics/drivers", body);
    },
    (saved) => {
      toast.success(driver ? "Saqlandi" : `${saved.full_name} qo‘shildi`);
      onClose();
    },
  );

  return (
    <Modal
      title={driver ? "Haydovchini tahrirlash" : "Yangi haydovchi"}
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
        <Field label="F.I.Sh." {...form.field("full_name")} required>
          <Input {...form.control("full_name")} maxLength={200} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefon" {...form.field("phone")} required>
            <Input {...form.control("phone")} type="tel" inputMode="tel" maxLength={32} />
          </Field>
          <Field label="Guvohnoma raqami" {...form.field("license_no")}>
            <Input {...form.control("license_no")} maxLength={32} autoCapitalize="characters" />
          </Field>
        </div>
        <Field
          label="Logistika xodimi hisobi"
          {...form.field("user")}
          hint="Bog‘langan xodim topshiriqlarni Telegram orqali oladi va bajaradi"
        >
          <Select {...form.control("user")}>
            <option value="">Bog‘lanmagan</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Izoh" {...form.field("note")}>
          <Textarea {...form.control("note")} maxLength={500} />
        </Field>
        {form.formError && <Alert>{form.formError}</Alert>}
      </div>
    </Modal>
  );
}
