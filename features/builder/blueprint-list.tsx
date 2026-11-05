"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Blocks,
  CircleCheckBig,
  Copy,
  FlaskConical,
  History,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import type { BlueprintKind, BlueprintListItem, BuilderMeta } from "@/lib/builder-types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useDebounced, usePagedApi } from "@/lib/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useBlueprintActions } from "./blueprint-actions";
import { KIND_LABELS, STATUS_LABELS, STATUS_TONES, usageText } from "./shared";

const PAGE_SIZE = 50;

const COLUMNS: Column<BlueprintListItem>[] = [
  {
    key: "name",
    header: "Nomi",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {row.name}
          {row.has_pending && <Badge tone="warning">Tasdiq kutmoqda</Badge>}
        </span>
        {row.description && <span className="max-w-xs truncate text-xs font-normal text-muted">{row.description}</span>}
      </span>
    ),
  },
  {
    key: "status",
    header: "Holati",
    cell: (row) => <Badge tone={STATUS_TONES[row.status]}>{row.status_display || STATUS_LABELS[row.status]}</Badge>,
  },
  {
    key: "version",
    header: "Versiya",
    align: "right",
    cell: (row) => <span className="tabular-nums">v{formatNumber(row.version)}</span>,
  },
  { key: "usage", header: "Ishlatilishi", cell: (row) => <span className="text-muted">{usageText(row.usage)}</span> },
  {
    key: "updated",
    header: "Yangilangan",
    hideOnMobile: true,
    cell: (row) => <span className="tabular-nums text-muted">{formatDateTime(row.updated_at)}</span>,
  },
];

/** One Konstruktor tab: blueprints of one kind with their lifecycle actions (API_CONTRACT_V4 §1). */
export function BlueprintList({
  kind,
  meta,
  onEdit,
  onCreate,
}: {
  kind: BlueprintKind;
  meta: BuilderMeta | undefined;
  onEdit: (id: number) => void;
  onCreate: () => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const debouncedSearch = useDebounced(search.trim());
  const actions = useBlueprintActions(meta, onEdit);
  const labels = KIND_LABELS[kind];

  const list = usePagedApi<BlueprintListItem>("/builder/blueprints", { kind, status, search: debouncedSearch }, PAGE_SIZE);
  const { page, setPage } = list;
  const data = list.data;
  const filtered = Boolean(debouncedSearch || status);

  return (
    <Card>
      <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-[1fr_180px_auto] sm:px-6">
        <SearchInput
          id={`builder-${kind}-search`}
          label="Qidirish"
          placeholder="Nomi bo‘yicha qidirish"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <div>
          <label htmlFor={`builder-${kind}-status`} className="sr-only">
            Holati
          </label>
          <Select
            id={`builder-${kind}-status`}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Barcha holatlar</option>
            {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <Button icon={<Plus className="size-4" aria-hidden />} onClick={onCreate}>
          Yangi {labels.one.toLowerCase()}
        </Button>
      </div>

      <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
      {!data && list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !data ? (
        <TableSkeleton />
      ) : data.results.length === 0 ? (
        <EmptyState
          icon={Blocks}
          title={filtered ? "Hech narsa topilmadi" : labels.empty}
          description={filtered ? undefined : "Yangi yarating: «Saqlash» bosilgach u darhol ishlay boshlaydi."}
        />
      ) : (
        <>
          <DataTable
            caption={labels.many}
            rows={data.results}
            columns={COLUMNS}
            rowKey={(row) => row.id}
            stale={list.loading}
            actions={(row) => (
              <>
                {row.status === "active" && row.has_pending && (
                  <Button size="sm" icon={<CircleCheckBig className="size-3.5" aria-hidden />} onClick={() => actions.activate(row)}>
                    O‘zgarishni tasdiqlash
                  </Button>
                )}
                {(row.status === "draft" || row.status === "test") && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<CircleCheckBig className="size-3.5" aria-hidden />}
                    onClick={() => actions.activate(row)}
                  >
                    Faollashtirish
                  </Button>
                )}
                {row.status === "active" && row.has_pending && (
                  <IconButton label={`${row.name}: o‘zgarishni bekor qilish`} tone="quiet-danger" onClick={() => actions.discard(row)}>
                    <Undo2 className="size-4" aria-hidden />
                  </IconButton>
                )}
                {row.status !== "archived" && (
                  <IconButton label={`${row.name}: tahrirlash`} onClick={() => onEdit(row.id)}>
                    <Pencil className="size-4" aria-hidden />
                  </IconButton>
                )}
                {row.status === "draft" && (
                  <IconButton label={`${row.name}: sinovga o‘tkazish`} onClick={() => actions.test(row)}>
                    <FlaskConical className="size-4" aria-hidden />
                  </IconButton>
                )}
                <IconButton label={`${row.name}: versiyalar`} onClick={() => actions.versions(row)}>
                  <History className="size-4" aria-hidden />
                </IconButton>
                <IconButton label={`${row.name}: nusxa olish`} onClick={() => actions.duplicate(row)}>
                  <Copy className="size-4" aria-hidden />
                </IconButton>
                {row.status === "active" && (
                  <IconButton label={`${row.name}: arxivlash`} tone="quiet-danger" onClick={() => actions.archive(row)}>
                    <Archive className="size-4" aria-hidden />
                  </IconButton>
                )}
                {row.status === "archived" && (
                  <IconButton label={`${row.name}: tiklash`} onClick={() => actions.restore(row)}>
                    <ArchiveRestore className="size-4" aria-hidden />
                  </IconButton>
                )}
                {row.status === "draft" && (
                  <IconButton label={`${row.name}: o‘chirish`} tone="quiet-danger" onClick={() => actions.remove(row)}>
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                )}
              </>
            )}
          />
          <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={list.loading} />
        </>
      )}
      {actions.dialogs}
    </Card>
  );
}
