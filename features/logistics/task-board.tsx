"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { AlarmClock, CalendarDays, CheckCheck, PackageCheck, Plus, Timer, Trash2, Truck, UserRound } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDate, formatHours, formatNumber, formatPercent } from "@/lib/format";
import { TASK_STATUS } from "@/lib/status";
import { useApi, useDebounced, usePagedApi } from "@/lib/use-api";
import type { LogisticsSummary, LogisticsTask, Paginated } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton, StatsSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { BOARD_STATUSES, DONE_STATUSES, itemsSummary, plannedText, TaskStatusBadge, totalKgText, type BoardStatus } from "./shared";
import { TaskCreateModal } from "./task-create-modal";
import { canDeleteTask, useDeleteTask } from "./use-delete-task";

const BOARD_LIMIT = 200;
const ARCHIVE_PAGE = 25;
type View = "board" | "archive";

/** /logistics — KPI row + board by status (A, W, L), archive of finished tasks (V3 §15.3). */
export function TaskBoard() {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);

  const view: View = params.get("view") === "archive" ? "archive" : "board";
  const mine = params.get("mine") === "1";
  const overdue = params.get("overdue") === "1";
  const dateFrom = params.get("date_from") ?? "";
  const dateTo = params.get("date_to") ?? "";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debouncedSearch = useDebounced(search.trim());
  const column = (BOARD_STATUSES as readonly string[]).includes(params.get("col") ?? "")
    ? (params.get("col") as BoardStatus)
    : "NEW";

  const setParam = (updates: Record<string, string>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  const filters = {
    mine: mine ? 1 : undefined,
    overdue: overdue ? 1 : undefined,
    date_from: dateFrom,
    date_to: dateTo,
    search: debouncedSearch,
  };
  const summary = useApi<LogisticsSummary>("/logistics/summary");
  const board = useApi<Paginated<LogisticsTask>>(view === "board" ? "/logistics/tasks" : null, {
    ...filters,
    status: BOARD_STATUSES.join(","),
    page_size: BOARD_LIMIT,
  });
  const filtered = Boolean(mine || overdue || dateFrom || dateTo || debouncedSearch);

  const grouped = useMemo(() => {
    const result = Object.fromEntries(BOARD_STATUSES.map((status) => [status, [] as LogisticsTask[]])) as Record<
      BoardStatus,
      LogisticsTask[]
    >;
    for (const task of board.data?.results ?? []) {
      if (task.status in result) result[task.status as BoardStatus].push(task);
    }
    return result;
  }, [board.data]);

  const canCreate = user.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logistika"
        description="Yetkazib berish topshiriqlari: biriktirish, yo‘lga chiqish, yetkazish va tasdiqlash"
        actions={
          canCreate ? (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
              Yangi topshiriq
            </Button>
          ) : undefined
        }
      />

      <SummaryRow summary={summary.data} error={summary.error} onRetry={summary.reload} showMine={user.role === "LOGISTICS"} />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              label="Ko‘rinish"
              items={[
                { key: "board", label: "Jarayondagilar" },
                { key: "archive", label: "Yakunlanganlar" },
              ]}
              value={view}
              onChange={(key) => setParam({ view: key === "board" ? "" : key })}
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tezkor filtrlar">
              <ToggleChip
                active={mine}
                icon={<UserRound className="size-3.5" aria-hidden />}
                label="Faqat meniki"
                onClick={() => setParam({ mine: mine ? "" : "1" })}
              />
              {view === "board" && (
                <ToggleChip
                  active={overdue}
                  icon={<AlarmClock className="size-3.5" aria-hidden />}
                  label="Muddati o‘tgan"
                  tone="danger"
                  onClick={() => setParam({ overdue: overdue ? "" : "1" })}
                />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_170px_170px]">
            <SearchInput
              className="col-span-2 sm:col-span-1"
              id="task-search"
              label="Qidirish"
              placeholder="LG kodi, xonadon, manzil, haydovchi yoki raqam"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setParam({ search: value.trim() });
              }}
            />
            <Input
              type="date"
              aria-label="Reja sanasidan"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setParam({ date_from: event.target.value })}
            />
            <Input
              type="date"
              aria-label="Reja sanasigacha"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setParam({ date_to: event.target.value })}
            />
          </div>
        </div>

        {view === "board" ? (
          <>
            <StaleDataError error={board.data ? board.error : null} onRetry={board.reload} />
            {!board.data && board.error ? (
              <ErrorState error={board.error} onRetry={board.error.status === 400 ? undefined : board.reload} />
            ) : !board.data ? (
              <BoardSkeleton />
            ) : board.data.count === 0 ? (
              <EmptyState
                icon={Truck}
                title={filtered ? "Hech narsa topilmadi" : "Faol topshiriqlar yo‘q"}
                description={filtered ? "Filtrlarni o‘zgartirib ko‘ring." : "Yangi topshiriqlar shu yerda paydo bo‘ladi."}
              />
            ) : (
              <>
                {/* Phone: one column at a time (segmented tabs). */}
                <div className="flex flex-col gap-3 p-4 sm:hidden">
                  <Tabs
                    label="Holat"
                    items={BOARD_STATUSES.map((status) => ({
                      key: status,
                      label: TASK_STATUS[status].label,
                      count: grouped[status].length,
                    }))}
                    value={column}
                    onChange={(key) => setParam({ col: key === "NEW" ? "" : key })}
                  />
                  <ColumnCards tasks={grouped[column]} stale={board.loading} />
                </div>
                {/* Tablet / desktop: the whole board, scrolls horizontally when narrow. */}
                <div className="hidden overflow-x-auto sm:block">
                  <div className="grid min-w-[1080px] grid-cols-5 gap-3 p-4 sm:px-6">
                    {BOARD_STATUSES.map((status) => (
                      <section key={status} aria-label={TASK_STATUS[status].label} className="flex min-w-0 flex-col gap-2">
                        <header className="flex items-center justify-between gap-2 px-1">
                          <Badge tone={TASK_STATUS[status].tone}>{TASK_STATUS[status].label}</Badge>
                          <span className="text-xs tabular-nums text-muted">{formatNumber(grouped[status].length)}</span>
                        </header>
                        <ColumnCards tasks={grouped[status]} stale={board.loading} />
                      </section>
                    ))}
                  </div>
                </div>
                {board.data.count > BOARD_LIMIT && (
                  <p className="px-4 pb-4 text-xs text-muted sm:px-6">
                    Birinchi {BOARD_LIMIT} ta topshiriq ko‘rsatildi ({formatNumber(board.data.count)} tadan). Filtrdan foydalaning.
                  </p>
                )}
              </>
            )}
          </>
        ) : (
          <Archive filters={filters} filtered={filtered} />
        )}
      </Card>

      {creating && <TaskCreateModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function ToggleChip({
  active,
  label,
  icon,
  tone = "default",
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium ring-1 ring-inset transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active
          ? tone === "danger"
            ? "bg-danger-soft text-danger ring-danger/40"
            : "bg-accent-soft text-accent ring-accent/40"
          : "bg-surface text-muted ring-line hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryRow({
  summary,
  error,
  onRetry,
  showMine,
}: {
  summary: LogisticsSummary | undefined;
  error: { status: number; message: string } | null;
  onRetry: () => void;
  showMine: boolean;
}) {
  if (!summary) {
    if (error) {
      return (
        <p className="text-sm text-danger">
          Ko‘rsatkichlar yuklanmadi.{" "}
          <button type="button" className="font-medium underline" onClick={onRetry}>
            Qayta urinish
          </button>
        </p>
      );
    }
    return <StatsSkeleton count={4} />;
  }
  const active = Object.values(summary.by_status).reduce((sum, value) => sum + value, 0);
  const last = summary.last_30d;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {showMine ? (
        <StatCard
          label="Mening faol topshiriqlarim"
          value={formatNumber(summary.mine.active)}
          hint={`Yo‘lda: ${formatNumber(summary.mine.in_transit)} · biriktirilmagan: ${formatNumber(summary.new_unassigned)}`}
          icon={UserRound}
        />
      ) : (
        <StatCard
          label="Faol topshiriqlar"
          value={formatNumber(active)}
          hint={`Yo‘lda: ${formatNumber(summary.by_status.IN_TRANSIT)} · yangi: ${formatNumber(summary.by_status.NEW)}`}
          icon={Truck}
        />
      )}
      <StatCard
        label="Muddati o‘tgan"
        value={formatNumber(summary.overdue)}
        hint="Reja sanasi o‘tgan, hali yetkazilmagan"
        icon={AlarmClock}
        tone={summary.overdue > 0 ? "danger" : "default"}
      />
      <StatCard
        label="Bugun yetkazildi"
        value={formatNumber(summary.delivered_today)}
        hint={`Tasdiq kutilmoqda: ${formatNumber(summary.awaiting_confirmation)} · bugun tasdiqlandi: ${formatNumber(summary.confirmed_today)}`}
        icon={PackageCheck}
      />
      <StatCard
        label="O‘z vaqtida (30 kun)"
        value={last.on_time_pct === null ? "—" : formatPercent(last.on_time_pct)}
        hint={
          <span className="inline-flex items-center gap-1">
            <Timer className="size-3" aria-hidden />
            O‘rtacha {last.avg_lead_time_h === null ? "—" : formatHours(last.avg_lead_time_h)} · muammoli: {formatNumber(last.with_issue)}
          </span>
        }
        icon={CheckCheck}
      />
    </div>
  );
}

function ColumnCards({ tasks, stale }: { tasks: readonly LogisticsTask[]; stale: boolean }) {
  const user = useCurrentUser();
  const deleteTask = useDeleteTask();
  if (tasks.length === 0) {
    return <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[13px] text-muted">Bo‘sh</p>;
  }
  return (
    <ul className={cn("flex flex-col gap-2 transition-opacity", stale && "opacity-60")}>
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskCard task={task} onDelete={canDeleteTask(task, user.role) ? () => deleteTask(task) : undefined} />
        </li>
      ))}
    </ul>
  );
}

export function TaskCard({ task, href, onDelete }: { task: LogisticsTask; href?: string; onDelete?: () => void }) {
  const kg = totalKgText(task);
  const card = (
    <Link
      href={href ?? `/logistics/${task.id}`}
      className={cn(
        "block rounded-xl border bg-surface p-3 shadow-card transition-colors hover:border-line-strong",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        task.is_overdue ? "border-danger/40" : "border-line",
        onDelete && "pr-11",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold tabular-nums text-ink">{task.code}</span>
        {task.is_overdue ? (
          <Badge tone="danger">Muddati o‘tgan</Badge>
        ) : (
          <TaskStatusBadge task={task} className="sm:hidden" />
        )}
      </div>
      <p className="mt-1.5 truncate text-sm font-medium text-ink">{task.household.name}</p>
      <p className="truncate text-xs text-muted">{task.delivery.address || task.household.code}</p>
      <p className="mt-2 line-clamp-2 text-xs text-ink/80">{itemsSummary(task)}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className={cn("inline-flex items-center gap-1", task.is_overdue && "font-medium text-danger")}>
          <CalendarDays className="size-3.5" aria-hidden />
          {plannedText(task)}
        </span>
        {kg && <span className="tabular-nums">{kg}</span>}
        {task.driver && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <UserRound className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{task.driver.full_name}</span>
          </span>
        )}
      </div>
    </Link>
  );
  if (!onDelete) return card;
  return (
    <div className="relative">
      {card}
      <IconButton
        label={`${task.code}: o‘chirish`}
        tone="quiet-danger"
        onClick={onDelete}
        className="absolute right-1.5 top-1/2 -translate-y-1/2"
      >
        <Trash2 className="size-4" aria-hidden />
      </IconButton>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ))}
    </div>
  );
}

function Archive({ filters, filtered }: { filters: Record<string, string | number | undefined>; filtered: boolean }) {
  const list = usePagedApi<LogisticsTask>(
    "/logistics/tasks",
    { ...filters, overdue: undefined, status: DONE_STATUSES.join(",") },
    ARCHIVE_PAGE,
  );
  const data = list.data;
  const user = useCurrentUser();
  const deleteTask = useDeleteTask();
  const columns: Column<LogisticsTask>[] = [
    {
      key: "code",
      header: "Topshiriq",
      primary: true,
      cell: (task) => (
        <span className="flex flex-col">
          <span className="font-medium tabular-nums">{task.code}</span>
          <span className="text-xs font-normal text-muted">{task.household.name}</span>
        </span>
      ),
    },
    { key: "items", header: "Yuk", hideOnMobile: true, className: "max-w-[260px]", cell: (task) => <span className="block truncate">{itemsSummary(task)}</span> },
    { key: "plan", header: "Reja", cell: (task) => <span className="tabular-nums">{plannedText(task)}</span> },
    {
      key: "done",
      header: "Yakunlangan",
      hideOnMobile: true,
      cell: (task) => <span className="tabular-nums">{formatDate(task.confirmed_at ?? task.cancelled_at)}</span>,
    },
    {
      key: "status",
      header: "Holat",
      cell: (task) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge task={task} />
          {task.received_ok === false && <Badge tone="warning">Muammo bilan</Badge>}
        </span>
      ),
    },
  ];
  return (
    <>
      <StaleDataError error={data ? list.error : null} onRetry={list.reload} />
      {!data && list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !data ? (
        <TableSkeleton />
      ) : data.results.length === 0 ? (
        <EmptyState icon={CheckCheck} title={filtered ? "Hech narsa topilmadi" : "Yakunlangan topshiriqlar hali yo‘q"} />
      ) : (
        <>
          <DataTable
            caption="Yakunlangan topshiriqlar"
            rows={data.results}
            columns={columns}
            rowKey={(task) => task.id}
            rowHref={(task) => `/logistics/${task.id}`}
            stale={list.loading}
            actions={
              user.role === "ADMIN"
                ? (task) =>
                    canDeleteTask(task, user.role) ? (
                      <IconButton label={`${task.code}: o‘chirish`} tone="quiet-danger" onClick={() => deleteTask(task)}>
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    ) : null
                : undefined
            }
          />
          <Pagination page={list.page} count={data.count} pageSize={ARCHIVE_PAGE} onPageChange={list.setPage} disabled={list.loading} />
        </>
      )}
    </>
  );
}

