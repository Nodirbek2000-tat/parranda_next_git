"use client";

import { useState } from "react";
import { KeyRound, Lock, LockOpen, MonitorX, Pencil, Send, ShieldCheck, Trash2, Unlink, UserPlus, Users } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { formatDate, formatNumber, ROLE_LABELS } from "@/lib/format";
import { useDebounced, usePagedApi } from "@/lib/use-api";
import type { User } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { PhoneLink } from "@/components/ui/phone-link";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useAccountActions } from "@/features/users/use-account-actions";
import { STAFF_ROLE_FILTER, STAFF_ROLES, UserCreateModal, UserEditModal } from "@/features/users/user-modals";

const PAGE_SIZE = 50;

const COLUMNS: Column<User>[] = [
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
  {
    key: "role",
    header: "Rol",
    cell: (row) =>
      row.is_super_admin ? (
        <Badge tone="primary">
          <ShieldCheck className="size-3" aria-hidden />
          Super Admin
        </Badge>
      ) : (
        ROLE_LABELS[row.role]
      ),
  },
  { key: "phone", header: "Telefon", cell: (row) => <PhoneLink phone={row.phone} /> },
  {
    key: "telegram",
    header: "Telegram",
    cell: (row) =>
      row.telegram_linked ? (
        <Badge tone="success">
          <Send className="size-3" aria-hidden />
          Ulangan
        </Badge>
      ) : (
        <Badge>Ulanmagan</Badge>
      ),
  },
  {
    key: "status",
    header: "Holati",
    cell: (row) =>
      !row.is_active ? (
        <Badge tone="danger">Bloklangan</Badge>
      ) : row.must_change_password ? (
        <Badge tone="warning">Vaqtinchalik parol</Badge>
      ) : (
        <Badge tone="success">Faol</Badge>
      ),
  },
  {
    key: "joined",
    header: "Qo‘shilgan",
    hideOnMobile: true,
    cell: (row) => <span className="tabular-nums text-muted">{formatDate(row.date_joined)}</span>,
  },
];

export default function UsersPage() {
  const me = useCurrentUser();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const debouncedSearch = useDebounced(search.trim());
  const account = useAccountActions();

  const users = usePagedApi<User>(
    "/users",
    {
      search: debouncedSearch,
      role: role || STAFF_ROLE_FILTER,
      is_active: active,
    },
    PAGE_SIZE,
  );
  const { page, setPage } = users;
  const data = users.data;
  const filtered = Boolean(debouncedSearch || role || active);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Xodimlar"
        description={
          // Owners are managed on their household page; "Jami: 3" without this read as "3 of 8 users".
          `Administrator, omborchi, logistika va veterinariya xodimlari${data ? ` · ${formatNumber(data.count)} ta` : ""} · xonadon egalari xonadon sahifasida boshqariladi`
        }
        actions={
          <Button icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
            Yangi xodim
          </Button>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-[1fr_180px_160px] sm:px-6">
          <SearchInput
            id="users-search"
            label="Qidirish"
            placeholder="Login, ism, familiya yoki telefon"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <div>
            <label htmlFor="users-role" className="sr-only">
              Rol
            </label>
            <Select
              id="users-role"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Barcha xodimlar</option>
              {STAFF_ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="users-status" className="sr-only">
              Holati
            </label>
            <Select
              id="users-status"
              value={active}
              onChange={(event) => {
                setActive(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Barcha holatlar</option>
              <option value="true">Faol</option>
              <option value="false">Bloklangan</option>
            </Select>
          </div>
        </div>

        <StaleDataError error={data ? users.error : null} onRetry={users.reload} />
        {!data && users.error ? (
          <ErrorState error={users.error} onRetry={users.reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.results.length === 0 ? (
          <EmptyState icon={Users} title={filtered ? "Hech narsa topilmadi" : "Xodimlar yo‘q"} />
        ) : (
          <>
            <DataTable
              caption="Foydalanuvchilar"
              rows={data.results}
              columns={COLUMNS}
              rowKey={(row) => row.id}
              stale={users.loading}
              actions={(row) => (
                <>
                  <IconButton label={`${row.full_name}: tahrirlash`} onClick={() => setEditing(row)}>
                    <Pencil className="size-4" aria-hidden />
                  </IconButton>
                  {/* Own account: a reset or Telegram unlink would end this very session;
                      the admin uses "Parolni almashtirish" or the bot instead. */}
                  {row.id !== me.id && (
                    <IconButton label={`${row.full_name}: parolni tiklash`} onClick={() => account.resetPassword(row)}>
                      <KeyRound className="size-4" aria-hidden />
                    </IconButton>
                  )}
                  {row.id !== me.id && (
                    <IconButton
                      label={`${row.full_name}: sessiyalarni yakunlash`}
                      tone="quiet-danger"
                      onClick={() => account.endSessions(row)}
                    >
                      <MonitorX className="size-4" aria-hidden />
                    </IconButton>
                  )}
                  {row.telegram_linked && row.id !== me.id && (
                    <IconButton label={`${row.full_name}: Telegramni uzish`} onClick={() => account.unlinkTelegram(row)}>
                      <Unlink className="size-4" aria-hidden />
                    </IconButton>
                  )}
                  {row.id !== me.id && (
                    <IconButton
                      label={row.is_active ? `${row.full_name}: bloklash` : `${row.full_name}: faollashtirish`}
                      tone={row.is_active ? "quiet-danger" : "default"}
                      onClick={() => account.setActive(row, !row.is_active)}
                    >
                      {row.is_active ? <Lock className="size-4" aria-hidden /> : <LockOpen className="size-4" aria-hidden />}
                    </IconButton>
                  )}
                  {row.id !== me.id && (
                    <IconButton
                      label={`${row.full_name}: o‘chirish`}
                      tone="quiet-danger"
                      onClick={() => account.deleteAccount(row)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </IconButton>
                  )}
                </>
              )}
            />
            <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={users.loading} />
          </>
        )}
      </Card>

      {creating && <UserCreateModal onClose={() => setCreating(false)} />}
      {editing && <UserEditModal user={editing} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />}
      {account.dialogs}
    </div>
  );
}
