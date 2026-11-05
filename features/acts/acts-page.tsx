"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { ChevronDown, Eye, FileDown, FileSignature, Trash2 } from "lucide-react";
import { api, apiDownload, toApiError, type FieldErrors } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { Act, ActKind, ActSnapshot, HouseholdRef } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { diffDays, formatDate, formatDateTime, formatRange, ROLE_LABELS, todayIso } from "@/lib/format";
import { useApi, usePagedApi } from "@/lib/use-api";
import type { Household, Role } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { HouseholdPicker, UserPicker, type UserOption } from "../work/pickers";
import { ACT_KIND_LABELS } from "../work/status";
import { ActSnapshotView } from "./act-snapshot";
import { useActDelete } from "./use-act-delete";

const PAGE_SIZE = 20;
const MAX_PERIOD_DAYS = 366;
const ROLES = Object.keys(ROLE_LABELS) as Role[];

type GenKind = Exclude<ActKind, "task">;

function monthStart(): string {
  return `${todayIso().slice(0, 8)}01`;
}

/** Downloads `/api/acts/{id}/pdf` with the server's file name. */
export function useActPdf() {
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const download = async (act: Pick<Act, "id" | "code">) => {
    setBusy(act.id);
    try {
      const name = await apiDownload(`/acts/${act.id}/pdf`, undefined, `${act.code}.pdf`);
      toast.success(`Yuklab olindi: ${name}`);
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setBusy(null);
    }
  };
  return { busy, download };
}

/** /acts — dalolatnoma generator (preview → create + PDF) and the list of created acts (API_CONTRACT_V4 §6). */
export function ActsPage() {
  const user = useCurrentUser();
  const isAdmin = user.role === "ADMIN";
  const isOwner = user.role === "OWNER";
  const params = useSearchParams();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dalolatnomalar"
        description={
          isAdmin
            ? "Har bir rol bajargan ishlar va umumiy dalolatnoma: ko‘rib chiqing, shakllantiring, PDF yuklab oling"
            : isOwner
              ? "Xonadoningiz bo‘yicha bajarilgan ishlar dalolatnomasi"
              : "Siz bajargan ishlar bo‘yicha dalolatnoma"
        }
      />
      <ActGenerator
        key={params.toString()}
        initialKind={params.get("kind")}
        initialRole={params.get("role")}
        initialHousehold={params.get("household")}
      />
      <ActList />
    </div>
  );
}

function ActGenerator({
  initialKind,
  initialRole,
  initialHousehold,
}: {
  initialKind: string | null;
  initialRole: string | null;
  initialHousehold: string | null;
}) {
  const user = useCurrentUser();
  const toast = useToast();
  const pdf = useActPdf();
  const prefix = useId();
  const isAdmin = user.role === "ADMIN";
  const isOwner = user.role === "OWNER";
  const isStaff = !isAdmin && !isOwner;

  const [kind, setKind] = useState<GenKind>(
    isStaff ? "role" : initialKind === "general" ? "general" : "role",
  );
  const [role, setRole] = useState<Role>(
    isAdmin && ROLES.includes(initialRole as Role) ? (initialRole as Role) : isAdmin ? "VET" : user.role,
  );
  const [employee, setEmployee] = useState<UserOption | null>(null);
  const [household, setHousehold] = useState<HouseholdRef | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(todayIso());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [previewQuery, setPreviewQuery] = useState<Record<string, string | number | undefined> | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // "Qo‘shimcha" (xodim, xonadon, davr) is collapsed by default; a URL prefill opens it.
  const [moreOpen, setMoreOpen] = useState(Boolean(initialHousehold || initialKind));

  // ?household=<id> prefill (household detail → “Umumiy dalolatnoma”): load its code and name once.
  const prefillId = isAdmin || isStaff ? Number(initialHousehold) || null : null;
  const prefill = useApi<Household>(prefillId ? `/households/${prefillId}` : null);
  const [prefillUsed, setPrefillUsed] = useState(false);
  if (!prefillUsed && prefill.data && !household) {
    // Adjusting state while rendering (React re-renders before committing).
    setPrefillUsed(true);
    setHousehold({ id: prefill.data.id, code: prefill.data.code, name: prefill.data.name });
  }

  const effectiveRole: Role = isAdmin ? role : isOwner ? "OWNER" : user.role;
  const query = {
    kind,
    role: kind === "role" ? effectiveRole : undefined,
    user_id: isAdmin && kind === "role" && employee ? employee.id : undefined,
    household_id: isOwner ? (user.household_id ?? undefined) : household?.id,
    date_from: dateFrom,
    date_to: dateTo,
  };

  const preview = useApi<ActSnapshot>(previewQuery ? "/acts/preview" : null, previewQuery ?? undefined);

  const change = (apply: () => void) => {
    apply();
    setPreviewQuery(null);
    setCreateError(null);
    setErrors({});
  };

  const validate = (): boolean => {
    const found: FieldErrors = {};
    if (!dateFrom) found.date_from = "Boshlanish sanasini tanlang.";
    if (!dateTo) found.date_to = "Tugash sanasini tanlang.";
    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) found.date_to = "Tugash sanasi boshlanishdan oldin bo‘lmasin.";
      else if (diffDays(dateFrom, dateTo) + 1 > MAX_PERIOD_DAYS) found.date_to = "Davr 366 kundan oshmasligi kerak.";
    }
    setErrors(found);
    if (found.date_from || found.date_to) setMoreOpen(true);
    return Object.keys(found).length === 0;
  };

  const create = async () => {
    if (!validate()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const act = await api.post<Act>("/acts", {
        kind: query.kind,
        role: query.role ?? null,
        user_id: query.user_id ?? null,
        household_id: query.household_id ?? null,
        date_from: query.date_from,
        date_to: query.date_to,
      });
      toast.success(`Dalolatnoma shakllantirildi: ${act.code}`);
      await pdf.download(act);
    } catch (caught) {
      const failure = toApiError(caught);
      setErrors(failure.fields);
      setCreateError(failure.message);
      // Errors inside the collapsed "Qo‘shimcha" section must be visible.
      if (failure.fields.user_id || failure.fields.household_id || failure.fields.date_from || failure.fields.date_to) {
        setMoreOpen(true);
      }
    } finally {
      setCreating(false);
    }
  };

  const ownerWithoutHousehold = isOwner && !user.household_id;
  const showEmployee = isAdmin && kind === "role" && role !== "OWNER";
  const moreTitle = `Qo‘shimcha (${[showEmployee && "xodim", !isOwner && "xonadon", "davr"].filter(Boolean).join(", ")})`;
  const moreSummary = [
    `Davr: ${formatDate(dateFrom)} — ${formatDate(dateTo)}`,
    showEmployee ? (employee ? employee.full_name : "barcha xodimlar") : null,
    isOwner ? "mening xonadonim" : household ? `${household.code} ${household.name}` : "barcha xonadonlar",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader
        title="Dalolatnoma tuzish"
        description="Odatda bir bosish kifoya: “Shakllantirish va yuklab olish”. Kerak bo‘lsa, avval ko‘rib chiqing"
      />
      <CardBody className="flex flex-col gap-4">
        {ownerWithoutHousehold && <Alert tone="warning">Hisobingizga xonadon biriktirilmagan.</Alert>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!isStaff && (
            <Field label="Turi" htmlFor={`${prefix}-kind`}>
              <Select
                id={`${prefix}-kind`}
                value={kind}
                onChange={(event) => change(() => setKind(event.target.value as GenKind))}
              >
                <option value="role">{isOwner ? "Rol bo‘yicha (xonadon egasi)" : ACT_KIND_LABELS.role}</option>
                <option value="general">Umumiy dalolatnoma</option>
              </Select>
            </Field>
          )}
          {kind === "role" && (
            <Field label="Rol" htmlFor={`${prefix}-role`} error={errors.role}>
              <Select
                id={`${prefix}-role`}
                value={effectiveRole}
                disabled={!isAdmin}
                invalid={Boolean(errors.role)}
                onChange={(event) =>
                  change(() => {
                    setRole(event.target.value as Role);
                    setEmployee(null);
                  })
                }
              >
                {(isAdmin ? ROLES : [effectiveRole]).map((value) => (
                  <option key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="rounded-lg border border-line">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={`${prefix}-more`}
            onClick={() => setMoreOpen((open) => !open)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-ink">{moreTitle}</span>
              <span className="truncate text-[13px] tabular-nums text-muted">{moreSummary}</span>
            </span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted transition-transform", moreOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {moreOpen && (
            <div id={`${prefix}-more`} className="grid gap-4 border-t border-line px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
              {showEmployee && (
                <Field label="Xodim" htmlFor={`${prefix}-user`} error={errors.user_id} hint="Bo‘sh qolsa — rol bo‘yicha barcha xodimlar">
                  <UserPicker
                    key={role}
                    id={`${prefix}-user`}
                    role={role}
                    value={employee}
                    invalid={Boolean(errors.user_id)}
                    onChange={(value) => change(() => setEmployee(value))}
                  />
                </Field>
              )}
              <Field
                label="Xonadon"
                htmlFor={`${prefix}-household`}
                error={errors.household_id}
                hint={isOwner ? undefined : "Ixtiyoriy: bitta xonadon bo‘yicha"}
              >
                {isOwner ? (
                  <p
                    id={`${prefix}-household`}
                    className="flex h-10 items-center rounded-lg border border-line bg-subtle px-3 text-sm text-ink"
                  >
                    Mening xonadonim
                  </p>
                ) : (
                  <HouseholdPicker
                    id={`${prefix}-household`}
                    value={household}
                    invalid={Boolean(errors.household_id)}
                    onChange={(value) => change(() => setHousehold(value))}
                  />
                )}
              </Field>
              <Field label="Davr boshi" htmlFor={`${prefix}-from`} error={errors.date_from}>
                <Input
                  id={`${prefix}-from`}
                  type="date"
                  value={dateFrom}
                  max={dateTo || todayIso()}
                  invalid={Boolean(errors.date_from)}
                  onChange={(event) => change(() => setDateFrom(event.target.value))}
                />
              </Field>
              <Field label="Davr oxiri" htmlFor={`${prefix}-to`} error={errors.date_to}>
                <Input
                  id={`${prefix}-to`}
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  max={todayIso()}
                  invalid={Boolean(errors.date_to)}
                  onChange={(event) => change(() => setDateTo(event.target.value))}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            icon={<Eye className="size-4" aria-hidden />}
            disabled={ownerWithoutHousehold || creating}
            loading={Boolean(previewQuery) && preview.loading}
            onClick={() => {
              if (!validate()) return;
              setCreateError(null);
              if (previewQuery) preview.reload();
              else setPreviewQuery({ ...query });
            }}
          >
            Ko‘rib chiqish
          </Button>
          <Button
            icon={<FileSignature className="size-4" aria-hidden />}
            loading={creating || pdf.busy !== null}
            disabled={ownerWithoutHousehold}
            onClick={() => void create()}
          >
            Shakllantirish va yuklab olish
          </Button>
        </div>
        {createError && <Alert>{createError}</Alert>}

        {previewQuery && (
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-6">
            {preview.error && !preview.data ? (
              <ErrorState error={preview.error} onRetry={preview.error.status === 400 ? undefined : preview.reload} />
            ) : !preview.data ? (
              <div className="flex flex-col gap-3" role="status" aria-label="Yuklanmoqda">
                <Skeleton className="mx-auto h-5 w-64" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                {preview.error && <StaleDataError error={preview.error} onRetry={preview.reload} className="-mx-4 -mt-4 mb-4 sm:-mx-6 sm:-mt-6" />}
                <p className="mb-4 text-xs text-muted">Oldindan ko‘rish — hali saqlanmagan. Raqam shakllantirilganda beriladi.</p>
                <ActSnapshotView snapshot={preview.data} />
              </>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ActList() {
  const user = useCurrentUser();
  const isAdmin = user.role === "ADMIN";
  const pdf = useActPdf();
  const { canDelete, deleteAct } = useActDelete();
  const [kind, setKind] = useState("");
  const [role, setRole] = useState("");
  const list = usePagedApi<Act>("/acts", { kind, role: isAdmin ? role : undefined }, PAGE_SIZE);
  const data = list.data;

  const columns: Column<Act>[] = [
    {
      key: "code",
      header: "Dalolatnoma",
      primary: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium tabular-nums">{row.code}</span>
          <span className="text-xs font-normal text-muted">
            {row.kind_display || ACT_KIND_LABELS[row.kind]}
            {row.role_display ? ` · ${row.role_display}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "scope",
      header: "Kim / qayer",
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.user?.full_name ?? (row.kind === "general" ? "Barcha rollar" : row.kind === "task" ? "Vazifa" : "Barcha xodimlar")}</span>
          {row.household && <span className="text-xs tabular-nums text-muted">{row.household.code} {row.household.name}</span>}
        </span>
      ),
    },
    {
      key: "period",
      header: "Davr",
      cell: (row) => <span className="tabular-nums">{row.date_from || row.date_to ? formatRange(row.date_from, row.date_to) : "—"}</span>,
    },
    {
      key: "created",
      header: "Tuzilgan",
      hideOnMobile: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="tabular-nums">{formatDateTime(row.created_at)}</span>
          {row.created_by_name && <span className="text-xs text-muted">{row.created_by_name}</span>}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader title="Tuzilgan dalolatnomalar" description="PDF har safar bir xil saqlangan nusxadan yaratiladi" />
      <div className="mt-3 grid grid-cols-2 gap-3 border-y border-line px-4 py-3 sm:flex sm:px-6">
        <div className="sm:w-52">
          <label htmlFor="acts-kind" className="sr-only">
            Turi
          </label>
          <Select
            id="acts-kind"
            value={kind}
            onChange={(event) => {
              list.setPage(1);
              setKind(event.target.value);
            }}
          >
            <option value="">Barcha turlar</option>
            {(Object.keys(ACT_KIND_LABELS) as ActKind[]).map((value) => (
              <option key={value} value={value}>
                {ACT_KIND_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        {isAdmin && (
          <div className="sm:w-52">
            <label htmlFor="acts-role" className="sr-only">
              Rol
            </label>
            <Select
              id="acts-role"
              value={role}
              onChange={(event) => {
                list.setPage(1);
                setRole(event.target.value);
              }}
            >
              <option value="">Barcha rollar</option>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
      {!data && list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !data ? (
        <TableSkeleton rows={3} />
      ) : data.results.length === 0 ? (
        <EmptyState icon={FileSignature} title={kind || role ? "Hech narsa topilmadi" : "Dalolatnomalar hali tuzilmagan"} />
      ) : (
        <>
          <DataTable
            caption="Tuzilgan dalolatnomalar"
            rows={data.results}
            columns={columns}
            rowKey={(row) => row.id}
            stale={list.loading}
            actions={(row) => (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={pdf.busy === row.id}
                  icon={<FileDown className="size-4" aria-hidden />}
                  onClick={() => void pdf.download(row)}
                >
                  PDF
                </Button>
                {canDelete && (
                  <IconButton label={`${row.code}: o‘chirish`} tone="quiet-danger" onClick={() => deleteAct(row)}>
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                )}
              </>
            )}
          />
          <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={list.setPage} disabled={list.loading} />
        </>
      )}
    </Card>
  );
}
