"use client";

import { useState } from "react";
import { Pencil, Plus, UserCog, X } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import type { BuilderMeta, HouseholdRef, UserAccessRow } from "@/lib/builder-types";
import { formatNumber } from "@/lib/format";
import { useApi, useDebounced, usePagedApi } from "@/lib/use-api";
import type { Household, Paginated } from "@/lib/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Field, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useBlueprintOptions, ToggleChip } from "./shared";

const PAGE_SIZE = 50;

function householdsText(row: UserAccessRow): string {
  if (row.households.length === 0) return "—";
  const shown = row.households.slice(0, 3).map((item) => item.code);
  return row.households.length > 3 ? `${shown.join(", ")} +${row.households.length - 3}` : shown.join(", ");
}

const COLUMNS: Column<UserAccessRow>[] = [
  {
    key: "name",
    header: "Xodim",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium">{row.full_name}</span>
        <span className="text-xs font-normal text-muted">{row.username}</span>
      </span>
    ),
  },
  { key: "role", header: "Rol", cell: (row) => row.role_display },
  {
    key: "profile",
    header: "Profil",
    cell: (row) => (row.profile_name ? <Badge tone="info">{row.profile_name}</Badge> : <span className="text-muted">Standart</span>),
  },
  {
    key: "districts",
    header: "Tumanlar",
    cell: (row) => (row.districts.length ? row.districts.join(", ") : <span className="text-muted">Cheklanmagan</span>),
  },
  { key: "households", header: "Xonadonlar", cell: (row) => <span className="text-muted">{householdsText(row)}</span> },
];

/** "Foydalanuvchi vakolatlari" tab (API_CONTRACT_V4 §2): role profile and household scope per user. */
export function UserAccessTab({ meta }: { meta: BuilderMeta | undefined }) {
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState("");
  const [editing, setEditing] = useState<UserAccessRow | null>(null);
  const debouncedSearch = useDebounced(search.trim());
  const profiles = useBlueprintOptions("role");
  const activeProfiles = (profiles.data?.results ?? []).filter((item) => item.status === "active");

  const rows = usePagedApi<UserAccessRow>("/builder/user-access", { search: debouncedSearch, profile }, PAGE_SIZE);
  const { page, setPage } = rows;
  const data = rows.data;
  const filtered = Boolean(debouncedSearch || profile);

  return (
    <Card>
      <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-[1fr_220px] sm:px-6">
        <SearchInput
          id="access-search"
          label="Qidirish"
          placeholder="Ism, login"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <div>
          <label htmlFor="access-profile" className="sr-only">
            Profil
          </label>
          <Select
            id="access-profile"
            value={profile}
            onChange={(event) => {
              setProfile(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Barcha profillar</option>
            {(profiles.data?.results ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <StaleDataError error={data ? rows.error : null} onRetry={rows.reload} />
      {!data && rows.error ? (
        <ErrorState error={rows.error} onRetry={rows.reload} />
      ) : !data ? (
        <TableSkeleton />
      ) : data.results.length === 0 ? (
        <EmptyState icon={UserCog} title={filtered ? "Hech narsa topilmadi" : "Xodimlar yo‘q"} />
      ) : (
        <>
          <DataTable
            caption="Foydalanuvchi vakolatlari"
            rows={data.results}
            columns={COLUMNS}
            rowKey={(row) => row.user_id}
            stale={rows.loading}
            actions={(row) => (
              <IconButton label={`${row.full_name}: vakolatlarni o‘zgartirish`} onClick={() => setEditing(row)}>
                <Pencil className="size-4" aria-hidden />
              </IconButton>
            )}
          />
          <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={rows.loading} />
        </>
      )}
      {editing && (
        <AccessModal
          row={editing}
          meta={meta}
          profiles={activeProfiles}
          profilesLoading={!profiles.data && !profiles.error}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function AccessModal({
  row,
  meta,
  profiles,
  profilesLoading,
  onClose,
}: {
  row: UserAccessRow;
  meta: BuilderMeta | undefined;
  profiles: { id: number; name: string }[];
  profilesLoading: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [profileId, setProfileId] = useState<string>(row.profile_id ? String(row.profile_id) : "");
  const [districts, setDistricts] = useState<string[]>(row.districts);
  const [households, setHouseholds] = useState<HouseholdRef[]>(row.households);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const debounced = useDebounced(search.trim());
  const found = useApi<Paginated<Household>>(debounced ? "/households" : null, { search: debounced, page_size: 10 });
  const profileChanged = profileId !== (row.profile_id ? String(row.profile_id) : "");
  const allDistricts = [...new Set([...(meta?.districts ?? []), ...row.districts])];
  // A profile that is no longer active stays selectable for this user, so the form does not silently drop it.
  const profileOptions =
    row.profile_id && !profiles.some((item) => item.id === row.profile_id)
      ? [...profiles, { id: row.profile_id, name: row.profile_name ?? `#${row.profile_id}` }]
      : profiles;

  const submit = async () => {
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.put<UserAccessRow>(`/builder/user-access/${row.user_id}`, {
        profile_id: profileId ? Number(profileId) : null,
        districts,
        household_ids: households.map((item) => item.id),
      });
      toast.success(profileChanged ? `${row.full_name}: profil o‘zgardi, sessiyalari yakunlandi` : "Vakolatlar saqlandi");
      onClose();
    } catch (caught) {
      const apiError = toApiError(caught);
      setPending(false);
      setFieldErrors(apiError.fields);
      setError(apiError.detail ?? (Object.keys(apiError.fields).length ? null : apiError.message));
    }
  };

  return (
    <Modal
      title="Vakolatlarni o‘zgartirish"
      description={`${row.full_name} · ${row.role_display}`}
      onClose={onClose}
      busy={pending}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button loading={pending} onClick={submit}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label="Rol profili"
          htmlFor="access-modal-profile"
          error={fieldErrors.profile_id}
          hint="Faqat faol rol profillari. Profil asosiy rol ruxsatlarini faqat toraytiradi."
        >
          <Select
            id="access-modal-profile"
            value={profileId}
            invalid={Boolean(fieldErrors.profile_id)}
            onChange={(event) => setProfileId(event.target.value)}
          >
            <option value="">Standart (tizim roli)</option>
            {profileOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        {profilesLoading && <p className="-mt-3 text-xs text-muted">Profillar yuklanmoqda…</p>}
        {profileChanged ? (
          <Alert tone="warning">
            Profil o‘zgarganda foydalanuvchining roli profilning asosiy roliga o‘zgaradi va uning barcha sessiyalari
            yakunlanadi — qayta kirishi kerak bo‘ladi.
          </Alert>
        ) : (
          <p className="-mt-3 text-xs text-muted">Profilni o‘zgartirish foydalanuvchining barcha sessiyalarini yakunlaydi.</p>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Tumanlar</span>
          {allDistricts.length === 0 ? (
            <p className="text-[13px] text-muted">Xonadonlarda tuman ko‘rsatilmagan.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tumanlar">
              {allDistricts.map((district) => {
                const on = districts.includes(district);
                return (
                  <ToggleChip
                    key={district}
                    on={on}
                    onClick={() => setDistricts(on ? districts.filter((item) => item !== district) : [...districts, district])}
                  >
                    {district}
                  </ToggleChip>
                );
              })}
            </div>
          )}
          {fieldErrors.districts ? (
            <p className="text-[13px] text-danger">{fieldErrors.districts}</p>
          ) : (
            <p className="text-xs text-muted">Tanlanmasa — tuman bo‘yicha cheklov yo‘q.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Xonadonlar ({formatNumber(households.length)})</span>
          {households.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {households.map((item) => (
                <span key={item.id} className="inline-flex h-7 items-center gap-1 rounded-md bg-accent-soft pl-2.5 text-xs font-medium text-accent">
                  {item.code} · {item.name}
                  <button
                    type="button"
                    aria-label={`${item.code}: olib tashlash`}
                    onClick={() => setHouseholds(households.filter((other) => other.id !== item.id))}
                    className="flex size-7 items-center justify-center rounded-md hover:bg-accent/10"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}
          <SearchInput id="access-household-search" label="Xonadon qidirish" placeholder="Xonadon ID yoki nomi" value={search} onChange={setSearch} />
          {debounced && (
            <div className="rounded-lg border border-line">
              {found.error ? (
                <p className="px-3 py-2 text-[13px] text-danger">{found.error.message}</p>
              ) : !found.data ? (
                <p className="px-3 py-2 text-[13px] text-muted">Qidirilmoqda…</p>
              ) : found.data.results.length === 0 ? (
                <p className="px-3 py-2 text-[13px] text-muted">Topilmadi</p>
              ) : (
                <ul className="divide-y divide-line">
                  {found.data.results.map((item) => {
                    const added = households.some((other) => other.id === item.id);
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{item.code}</span> · {item.name}
                          {item.district && <span className="text-muted"> · {item.district}</span>}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={added}
                          icon={<Plus className="size-3.5" aria-hidden />}
                          onClick={() => setHouseholds([...households, { id: item.id, code: item.code, name: item.name }])}
                        >
                          {added ? "Qo‘shilgan" : "Qo‘shish"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          {fieldErrors.household_ids ? (
            <p className="text-[13px] text-danger">{fieldErrors.household_ids}</p>
          ) : (
            <p className="text-xs text-muted">
              Tuman yoki xonadon tanlansa, foydalanuvchi faqat shu xonadonlarni (va ularning vazifa, jarayon,
              dalolatnomalarini) ko‘radi.
            </p>
          )}
        </div>
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}
