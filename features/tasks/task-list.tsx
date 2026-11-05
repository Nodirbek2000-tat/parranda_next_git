"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ListTodo, Plus } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import type { Task, TaskCounts, TaskStatus } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { useApi, useDebounced, usePagedApi } from "@/lib/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useUrlParams } from "@/components/stats/period-picker";
import { WORK_TASK_STATUS } from "../work/status";
import { TaskCreateModal } from "./task-create-modal";

const PAGE_SIZE = 30;

type View = "mine" | "approve" | "all";

const STATUSES = Object.keys(WORK_TASK_STATUS) as TaskStatus[];

export const TASK_COLUMNS: Column<Task>[] = [
  {
    key: "code",
    header: "Vazifa",
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span className="flex items-center gap-2">
          <span className="font-medium">{row.title}</span>
          {row.is_test && <Badge tone="warning">Test</Badge>}
        </span>
        <span className="text-xs font-normal tabular-nums text-muted">{row.code}</span>
      </span>
    ),
  },
  {
    key: "household",
    header: "Xonadon",
    cell: (row) =>
      row.household ? (
        <span className="flex flex-col">
          <span>{row.household.name}</span>
          <span className="text-xs tabular-nums text-muted">{row.household.code}</span>
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: "executor",
    header: "Ijrochi",
    hideOnMobile: true,
    cell: (row) => row.assigned_to?.full_name ?? row.executor_display,
  },
  {
    key: "due",
    header: "Muddat",
    cell: (row) => (
      <span className={cn("tabular-nums", row.overdue && "font-medium text-danger")}>
        {formatDate(row.due_on)}
        {row.overdue && <span className="sr-only"> (muddati o‘tgan)</span>}
      </span>
    ),
  },
  {
    key: "status",
    header: "Holat",
    align: "right",
    cell: (row) => <StatusBadge map={WORK_TASK_STATUS} status={row.status} label={row.status_display} overdue={row.overdue} />,
  },
];

/** /tasks — builder tasks (API_CONTRACT_V4 §3.2): mine, to approve, all (ADMIN). Filters live in the URL. */
export function TaskList() {
  const user = useCurrentUser();
  const isAdmin = user.role === "ADMIN";
  const params = useSearchParams();
  const setParams = useUrlParams();
  const [creating, setCreating] = useState(false);

  const counts = useApi<TaskCounts>("/tasks/counts");
  const toApprove = counts.data?.to_approve ?? 0;
  const requested = params.get("view");
  const showApprove = isAdmin || toApprove > 0 || requested === "approve";
  const view: View =
    requested === "approve" && showApprove ? "approve" : requested === "all" && isAdmin ? "all" : "mine";

  const statusParam = params.get("status") ?? "";
  const status = STATUSES.includes(statusParam as TaskStatus) && view !== "approve" ? statusParam : "";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debounced = useDebounced(search.trim());

  const list = usePagedApi<Task>("/tasks", { view, status, search: debounced }, PAGE_SIZE);
  const { setPage } = list;
  const data = list.data;
  const filtered = Boolean(status || debounced);

  const tabs: TabItem<View>[] = [
    { key: "mine", label: "Mening vazifalarim", count: counts.data?.mine_open },
    ...(showApprove ? [{ key: "approve" as const, label: "Tasdiqlash", count: counts.data?.to_approve }] : []),
    ...(isAdmin ? [{ key: "all" as const, label: "Barchasi" }] : []),
  ];

  const update = (changes: Record<string, string | null>) => {
    setPage(1);
    setParams(changes);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vazifalar"
        description="Sizga biriktirilgan va tasdiqlashingiz kerak bo‘lgan ishlar"
        actions={
          isAdmin ? (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
              Yangi vazifa
            </Button>
          ) : undefined
        }
      />

      <Tabs label="Vazifalar ko‘rinishi" items={tabs} value={view} onChange={(key) => update({ view: key === "mine" ? null : key, status: null })} />

      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-[1fr_220px] sm:px-6">
          <SearchInput
            id="tasks-search"
            label="Qidirish"
            placeholder="Vazifa kodi, nomi yoki xonadon"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          {view !== "approve" && (
            <div>
              <label htmlFor="tasks-status" className="sr-only">
                Holat
              </label>
              <Select id="tasks-status" value={status} onChange={(event) => update({ status: event.target.value || null })}>
                <option value="">Barcha holatlar</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {WORK_TASK_STATUS[value].label}
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
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title={
              filtered
                ? "Hech narsa topilmadi"
                : view === "approve"
                  ? "Tasdiqlash kutayotgan vazifa yo‘q"
                  : view === "all"
                    ? "Vazifalar hali yo‘q"
                    : "Sizda vazifa yo‘q"
            }
            description={filtered ? "Qidiruv yoki filtrni o‘zgartirib ko‘ring." : undefined}
          />
        ) : (
          <>
            <DataTable
              caption="Vazifalar"
              rows={data.results}
              columns={TASK_COLUMNS}
              rowKey={(row) => row.id}
              rowHref={(row) => `/tasks/${row.id}`}
              stale={list.loading}
            />
            <Pagination page={list.page} count={data.count} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={list.loading} />
          </>
        )}
      </Card>

      {creating && <TaskCreateModal onClose={() => setCreating(false)} />}
    </div>
  );
}
