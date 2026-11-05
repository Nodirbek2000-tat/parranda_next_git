"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bird,
  ClipboardList,
  FileSignature,
  KeyRound,
  Lock,
  LockOpen,
  Package,
  Pencil,
  Power,
  Unlink,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Household, HouseholdBatch, Movement, DailyReport, StockTransaction } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, StaleDataError } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PhoneLink } from "@/components/ui/phone-link";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { useUrlParams } from "@/components/stats/period-picker";
import { Summary } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { ALL_MOVEMENT_TYPES, MovementModal } from "../movements/movement-modal";
import { movementColumns } from "../movements/movement-columns";
import { PagedTableCard } from "../paged-table-card";
import { DailyReportModal } from "../reports/daily-report-modal";
import { reportColumns } from "../reports/report-columns";
import { transactionColumns } from "../stock/transaction-columns";
import { useAccountActions } from "../users/use-account-actions";
import { HouseholdStatsSection } from "../stats/household-stats";
import { HouseholdEditModal } from "./household-form-modal";
import { HouseholdLocation } from "./household-location";
import { HouseholdVetSection } from "../vet/household-vet-section";
import { HouseholdDeliveries, HouseholdOrders, HouseholdTimeline } from "./household-activity";

const BATCH_COLUMNS: Column<HouseholdBatch>[] = [
  {
    key: "code",
    header: "Partiya",
    primary: true,
    cell: (row) => <span className="font-medium tabular-nums">{row.batch_code}</span>,
  },
  { key: "type", header: "Turi", cell: (row) => row.poultry_type_display },
  { key: "breed", header: "Zoti", cell: (row) => row.breed },
  {
    key: "received",
    header: "Qabul qilingan",
    hideOnMobile: true,
    cell: (row) => <span className="tabular-nums">{row.first_received_date ? formatDate(row.first_received_date) : "—"}</span>,
  },
  { key: "count", header: "Soni", align: "right", cell: (row) => formatNumber(row.count) },
];

type Dialog = "edit" | "movement" | "report" | null;

/**
 * Below lg the page is split into tabs (the active one in `?tab=`, so links and the back button keep it):
 * on a phone the stacked sections were ~8 400 px long and "Berilgan mahsulotlar" took 10 screens to reach.
 * From lg up every section is shown, as before.
 */
const TABS = [
  { key: "overview", label: "Umumiy" },
  { key: "stats", label: "Statistika" },
  { key: "movements", label: "Harakatlar" },
  { key: "reports", label: "Hisobotlar" },
  { key: "vet", label: "Veterinariya" },
  { key: "products", label: "Mahsulotlar" },
  { key: "orders", label: "Buyurtmalar" },
  { key: "deliveries", label: "Yetkazishlar" },
  { key: "activity", label: "Faoliyat" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function useDetailTab(): [TabKey, (tab: TabKey) => void] {
  const params = useSearchParams();
  const setParams = useUrlParams();
  const raw = params.get("tab");
  const tab = (TABS.find((item) => item.key === raw)?.key ?? "overview") as TabKey;
  return [tab, (next) => setParams({ tab: next === "overview" ? null : next })];
}

function DetailTabs({ tab, onChange, hidden = [] }: { tab: TabKey; onChange: (tab: TabKey) => void; hidden?: readonly TabKey[] }) {
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden">
      <div role="tablist" aria-label="Xonadon bo‘limlari" className="flex w-max gap-1 rounded-lg border border-line bg-surface p-0.5">
        {TABS.filter((item) => !hidden.includes(item.key)).map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-md px-3 text-[13px] transition-colors",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              tab === item.key ? "bg-primary font-medium text-white" : "text-muted hover:bg-subtle hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TabPanel({ show, children }: { show: boolean; children: ReactNode }) {
  return <div className={cn("flex min-w-0 flex-col gap-6", !show && "max-lg:hidden")}>{children}</div>;
}

export function HouseholdDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const isAdmin = user.role === "ADMIN";
  // V3 §1.2: a VET reads the household and records deaths only; issued products are A/W data.
  const isVet = user.role === "VET";
  // V3 §1.2: WAREHOUSE has no `/api/vet/*` access (except a batch's vaccination history) → no vet section.
  const showVet = isAdmin || isVet;
  const confirm = useConfirm();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);

  const [tab, setTab] = useDetailTab();
  const household = useApi<Household>(`/households/${id}`);
  const batches = useApi<HouseholdBatch[]>(`/households/${id}/batches`);
  const account = useAccountActions();

  const data = household.data;

  if (!data) {
    if (household.error) {
      return household.error.status === 404 ? (
        <Card>
          <EmptyState
            title="Xonadon topilmadi"
            description="Xonadon o‘chirilgan yoki sizda uni ko‘rish huquqi yo‘q."
            action={<LinkButton href="/households">Xonadonlar ro‘yxati</LinkButton>}
          />
        </Card>
      ) : (
        <Card>
          <ErrorState error={household.error} onRetry={household.reload} />
        </Card>
      );
    }
    return <PageSkeleton />;
  }

  const toggleActive = () => {
    const activate = !data.is_active;
    void confirm({
      title: activate ? "Xonadonni faollashtirish" : "Xonadonni nofaol qilish",
      confirmLabel: activate ? "Faollashtirish" : "Nofaol qilish",
      tone: activate ? "primary" : "danger",
      message: activate ? (
        <p>
          <strong>{data.name}</strong> yana faol bo‘ladi va unga parranda tarqatish mumkin bo‘ladi.
        </p>
      ) : (
        <p>
          <strong>{data.name}</strong> nofaol bo‘ladi: unga parranda tarqatib bo‘lmaydi va kunlik hisobot nazoratidan
          chiqadi. Tarix saqlanib qoladi.
        </p>
      ),
      onConfirm: async () => {
        await api.patch<Household>(`/households/${data.id}`, { is_active: activate });
        toast.success(activate ? "Xonadon faollashtirildi" : "Xonadon nofaol qilindi");
      },
    });
  };

  const owner = data.owner;

  return (
    <div className="flex flex-col gap-6">
      {household.error && (
        <Card className="overflow-hidden">
          <StaleDataError error={household.error} onRetry={household.reload} className="border-b-0" />
        </Card>
      )}
      <PageHeader
        breadcrumbs={[{ label: "Xonadonlar", href: "/households" }, { label: data.code }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {data.name}
            {data.is_active ? <Badge tone="success">Faol</Badge> : <Badge>Nofaol</Badge>}
            {data.is_demo && <Badge tone="warning">Demo</Badge>}
          </span>
        }
        description={`${data.code} · ${[data.region, data.district, data.mfy].filter(Boolean).join(", ")}`}
        actions={
          <>
            <Button icon={<Bird className="size-4" aria-hidden />} onClick={() => setDialog("movement")}>
              Parranda harakati
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="secondary"
                  icon={<ClipboardList className="size-4" aria-hidden />}
                  onClick={() => setDialog("report")}
                  disabled={!batches.data}
                >
                  Hisobot kiritish
                </Button>
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setDialog("edit")}>
                  Tahrirlash
                </Button>
                <Button variant="secondary" icon={<Power className="size-4" aria-hidden />} onClick={toggleActive}>
                  {data.is_active ? "Nofaol qilish" : "Faollashtirish"}
                </Button>
                <LinkButton
                  href={`/acts?household=${data.id}&kind=general`}
                  icon={<FileSignature className="size-4" aria-hidden />}
                >
                  Umumiy dalolatnoma
                </LinkButton>
              </>
            )}
          </>
        }
      />

      <DetailTabs
        tab={tab}
        onChange={setTab}
        hidden={
          isVet
            ? ["products", "orders", "deliveries", "activity"]
            : isAdmin
              ? []
              : ["vet", "activity"]
        }
      />

      <TabPanel show={tab === "overview"}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Parranda soni" />
            <CardBody className="pt-2 sm:pt-2">
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-ink">{formatNumber(data.bird_count)}</p>
              <p className="mt-1 text-[13px] text-muted">Barcha partiyalar bo‘yicha xonadondagi parranda</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ma’lumotlar" />
            <CardBody>
              <Summary
                items={[
                  ["Egasi", owner.full_name],
                  ["Login", owner.username],
                  ["Telefon", <PhoneLink key="phone" phone={data.phone || owner.phone} />],
                  ["Manzil", data.address || "—"],
                  [
                    "Telegram",
                    owner.telegram_linked ? (
                      <span key="telegram" className="inline-flex items-center gap-2">
                        {owner.telegram_id_masked && (
                          <span className="tabular-nums text-muted" title="Telegram ID (oxirgi 4 raqam)">
                            {owner.telegram_id_masked}
                          </span>
                        )}
                        <Badge tone="success">Ulangan</Badge>
                      </span>
                    ) : (
                      <Badge>Ulanmagan</Badge>
                    ),
                  ],
                  ["Egasi hisobi", owner.is_active ? <Badge tone="success">Faol</Badge> : <Badge tone="danger">Bloklangan</Badge>],
                  ["Shartnoma", data.contract_info || "—"],
                  ["Ro‘yxatga olingan", formatDateTime(data.created_at)],
                ]}
              />
              {isAdmin && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<KeyRound className="size-3.5" aria-hidden />}
                    onClick={() => account.resetPassword(owner)}
                  >
                    Parolni tiklash
                  </Button>
                  {owner.telegram_linked && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Unlink className="size-3.5" aria-hidden />}
                      onClick={() => account.unlinkTelegram(owner)}
                    >
                      Telegramni uzish
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={
                      owner.is_active ? <Lock className="size-3.5" aria-hidden /> : <LockOpen className="size-3.5" aria-hidden />
                    }
                    onClick={() => account.setActive(owner, !owner.is_active)}
                  >
                    {owner.is_active ? "Egasini bloklash" : "Egasini faollashtirish"}
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <HouseholdLocation household={data} editable={isAdmin} />
      </div>

      <Card>
        <CardHeader title="Xonadondagi partiyalar" />
        <div className="mt-3 border-t border-line">
          {!batches.data && batches.error ? (
            <ErrorState error={batches.error} onRetry={batches.reload} />
          ) : !batches.data ? (
            <TableSkeleton rows={2} />
          ) : batches.data.length === 0 ? (
            <EmptyState icon={Bird} title="Xonadonda hozircha parranda yo‘q" />
          ) : (
            <DataTable
              caption="Xonadondagi partiyalar"
              rows={batches.data}
              columns={BATCH_COLUMNS}
              rowKey={(row) => row.batch_id}
              rowHref={isVet ? undefined : (row) => `/batches/${row.batch_id}`}
              stale={batches.loading}
            />
          )}
        </div>
      </Card>

      </TabPanel>

      <TabPanel show={tab === "stats"}>
        <HouseholdStatsSection path={`/households/${data.id}/stats`} />
      </TabPanel>

      <TabPanel show={tab === "movements"}>
      <PagedTableCard<Movement>
        title="Parranda harakatlari"
        path="/movements"
        query={{ household: data.id }}
        columns={movementColumns({ household: false, linkBatches: !isVet })}
        rowKey={(row) => row.id}
        emptyTitle="Harakatlar yo‘q"
        emptyIcon={Bird}
      />
      </TabPanel>

      <TabPanel show={tab === "reports"}>
      <PagedTableCard<DailyReport>
        title="Kunlik hisobotlar"
        path="/daily-reports"
        query={{ household: data.id }}
        columns={reportColumns()}
        rowKey={(row) => row.id}
        emptyTitle="Hisobotlar yo‘q"
        emptyIcon={ClipboardList}
      />
      </TabPanel>

      {showVet && (
        <TabPanel show={tab === "vet"}>
          <HouseholdVetSection household={data} />
        </TabPanel>
      )}

      {!isVet && (
      <TabPanel show={tab === "products"}>
      <PagedTableCard<StockTransaction>
        title="Berilgan mahsulotlar"
        path="/stock-transactions"
        query={{ household: data.id, type: "OUT" }}
        columns={transactionColumns({ household: false, balance: false, links: true })}
        rowKey={(row) => row.id}
        emptyTitle="Ombordan mahsulot berilmagan"
        emptyIcon={Package}
      />
      </TabPanel>
      )}

      {!isVet && (
        <>
          <TabPanel show={tab === "orders"}>
            <HouseholdOrders householdId={data.id} />
          </TabPanel>
          <TabPanel show={tab === "deliveries"}>
            <HouseholdDeliveries householdId={data.id} />
          </TabPanel>
        </>
      )}
      {isAdmin && (
        <TabPanel show={tab === "activity"}>
          <HouseholdTimeline householdId={data.id} />
        </TabPanel>
      )}

      {dialog === "movement" && (
        <MovementModal
          household={data}
          // Birds cannot be distributed to an inactive household (contract validation).
          types={
            isVet ? ["DEATH"] : data.is_active ? ALL_MOVEMENT_TYPES : ALL_MOVEMENT_TYPES.filter((type) => type !== "DISTRIBUTE")
          }
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {dialog === "report" && batches.data && (
        <DailyReportModal
          household={data}
          batches={batches.data}
          sendHousehold
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
      {dialog === "edit" && (
        <HouseholdEditModal household={data} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      )}
      {account.dialogs}
    </div>
  );
}
