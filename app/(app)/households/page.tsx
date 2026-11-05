"use client";

import { useState } from "react";
import { House, Plus, Send } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { useDebounced, usePagedApi } from "@/lib/use-api";
import type { Household } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { PhoneLink } from "@/components/ui/phone-link";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { HouseholdCreateModal } from "@/features/households/household-form-modal";

const PAGE_SIZE = 50;

const COLUMNS: Column<Household>[] = [
  {
    key: "name",
    header: "Xonadon",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium">{row.name}</span>
        <span className="text-xs font-normal tabular-nums text-muted">{row.code}</span>
      </span>
    ),
  },
  {
    key: "owner",
    header: "Egasi",
    cell: (row) => (
      <span className="flex flex-col">
        <span className="flex items-center gap-1.5">
          {row.owner.full_name}
          {row.owner.telegram_linked && <Send className="size-3.5 text-accent" aria-label="Telegram ulangan" />}
        </span>
        <PhoneLink phone={row.phone || row.owner.phone} className="text-xs" />
      </span>
    ),
  },
  {
    key: "area",
    header: "Hudud",
    cell: (row) => (
      <span className="flex flex-col">
        <span>{row.district}</span>
        <span className="text-xs text-muted">{row.mfy}</span>
      </span>
    ),
  },
  { key: "birds", header: "Parranda", align: "right", cell: (row) => formatNumber(row.bird_count) },
  {
    key: "status",
    header: "Holati",
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1.5">
        {row.is_active ? <Badge tone="success">Faol</Badge> : <Badge>Nofaol</Badge>}
        {row.is_demo && <Badge tone="warning">Demo</Badge>}
      </span>
    ),
  },
];

export default function HouseholdsPage() {
  const user = useCurrentUser();
  const isAdmin = user.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [active, setActive] = useState("");
  const [demo, setDemo] = useState("");
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebounced(search.trim());
  const debouncedRegion = useDebounced(region.trim());

  const households = usePagedApi<Household>(
    "/households",
    {
      search: debouncedSearch,
      region: debouncedRegion,
      is_active: active,
      is_demo: demo,
    },
    PAGE_SIZE,
  );
  const { page, setPage } = households;

  const updateFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const filtered = Boolean(debouncedSearch || debouncedRegion || active || demo);
  const data = households.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Xonadonlar"
        description={data ? `Jami: ${formatNumber(data.count)}` : undefined}
        actions={
          // Only an ordinary Administrator registers households (not the Super Admin).
          isAdmin && !user.is_super_admin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
              Yangi xonadon
            </Button>
          )
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-[1fr_200px_160px_170px] sm:px-6">
          <SearchInput
            id="households-search"
            label="Qidirish"
            placeholder="Nomi, kodi, egasi yoki telefon"
            value={search}
            onChange={(value) => updateFilter(() => setSearch(value))}
          />
          <div>
            <label htmlFor="households-region" className="sr-only">
              Viloyat
            </label>
            <Input
              id="households-region"
              placeholder="Viloyat"
              value={region}
              onChange={(event) => updateFilter(() => setRegion(event.target.value))}
            />
          </div>
          <div>
            <label htmlFor="households-status" className="sr-only">
              Holati
            </label>
            <Select
              id="households-status"
              value={active}
              onChange={(event) => updateFilter(() => setActive(event.target.value))}
            >
              <option value="">Barcha holatlar</option>
              <option value="true">Faol</option>
              <option value="false">Nofaol</option>
            </Select>
          </div>
          <div>
            <label htmlFor="households-demo" className="sr-only">
              Demo ma’lumot
            </label>
            <Select id="households-demo" value={demo} onChange={(event) => updateFilter(() => setDemo(event.target.value))}>
              <option value="">Real va demo</option>
              <option value="false">Faqat real</option>
              <option value="true">Faqat demo / sinov</option>
            </Select>
          </div>
        </div>

        <StaleDataError error={data ? households.error : null} onRetry={households.reload} />
        {!data && households.error ? (
          <ErrorState error={households.error} onRetry={households.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={House}
            title={filtered ? "Hech narsa topilmadi" : "Hali xonadonlar yo‘q"}
            description={filtered ? "Qidiruv shartlarini o‘zgartirib ko‘ring." : undefined}
          />
        ) : (
          <>
            <DataTable
              caption="Xonadonlar ro‘yxati"
              rows={data.results}
              columns={COLUMNS}
              rowKey={(row) => row.id}
              rowHref={(row) => `/households/${row.id}`}
              stale={households.loading}
            />
            <Pagination
              page={page}
              count={data.count}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              disabled={households.loading}
            />
          </>
        )}
      </Card>

      {creating && <HouseholdCreateModal onClose={() => setCreating(false)} />}
    </div>
  );
}
