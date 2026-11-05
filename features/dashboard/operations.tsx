"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, HeartPulse, ShieldAlert, ShoppingCart, Stethoscope, Truck } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { canAccess } from "@/lib/nav";
import { useCurrentUser } from "@/lib/auth";
import { LOT_STATUS } from "@/lib/status";
import type { AdminDashboardV3, ProblemHousehold, ProblemReasonCode } from "@/lib/types";
import type { BadgeTone } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { expiryText } from "@/features/stock/lots";

const REASON_TONE: Record<ProblemReasonCode, BadgeTone> = {
  NO_REPORT: "warning",
  HIGH_MORTALITY: "danger",
  OVERDUE_VACCINATION: "info",
  OPEN_DISEASE: "danger",
};

function LinkedCard({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  if (!href) return <div>{children}</div>;
  return (
    <Link
      href={href}
      aria-label={label}
      className="block rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&>div]:h-full [&>div]:transition-colors [&>div]:hover:border-line-strong"
    >
      {children}
    </Link>
  );
}

/** Row “Operatsiyalar” of /dashboard (V3 §15.3): orders, deliveries, vet inspections, problem households. */
export function OperationsRow({ data }: { data: AdminDashboardV3 }) {
  const user = useCurrentUser();
  const href = (path: string) => (canAccess(user, path) ? path : null);
  const { orders, logistics, vet, problem_households: problems } = data;
  const cards: ReactNode[] = [];
  if (orders) {
    cards.push(
      <LinkedCard key="orders" href={href("/orders")} label="Kutilayotgan buyurtmalar">
        <StatCard
          label="Kutilayotgan buyurtmalar"
          icon={ShoppingCart}
          tone={orders.new > 0 ? "warning" : "default"}
          value={formatNumber(orders.new)}
          hint={`tasdiqlangan, topshiriqsiz: ${formatNumber(orders.approved_without_task)} · qabul kutilmoqda: ${formatNumber(orders.awaiting_confirmation)}`}
        />
      </LinkedCard>,
    );
  }
  if (logistics) {
    const active = logistics.assigned + logistics.accepted + logistics.in_transit;
    cards.push(
      <LinkedCard key="logistics" href={href("/logistics")} label="Yetkazib berish jarayonlari">
        <StatCard
          label="Yetkazib berish jarayonlari"
          icon={Truck}
          tone={logistics.overdue > 0 ? "danger" : "default"}
          value={formatNumber(active + logistics.new)}
          hint={`yo‘lda ${formatNumber(logistics.in_transit)} · muddati o‘tgan ${formatNumber(logistics.overdue)} · bugun yetkazildi ${formatNumber(logistics.delivered_today)}`}
        />
      </LinkedCard>,
    );
  }
  if (vet) {
    cards.push(
      <LinkedCard key="vet" href={href("/vet")} label="Veterinariya tekshiruvlari">
        <StatCard
          label="Veterinariya tekshiruvlari"
          icon={Stethoscope}
          tone={vet.visits_overdue + vet.vaccinations_overdue > 0 ? "warning" : "default"}
          value={formatNumber(vet.visits_today)}
          hint={`bugun · 7 kunda ${formatNumber(vet.visits_planned_7d)} · muddati o‘tgan ${formatNumber(vet.visits_overdue)} · emlash ${formatNumber(vet.vaccinations_overdue)} · faol kasallik ${formatNumber(vet.open_diseases)}`}
        />
      </LinkedCard>,
    );
  }
  if (problems) {
    cards.push(
      <LinkedCard key="problems" href="#problem-households" label="Muammoli xonadonlar">
        <StatCard
          label="Muammoli xonadonlar"
          icon={ShieldAlert}
          tone={problems.count > 0 ? "danger" : "default"}
          value={formatNumber(problems.count)}
          hint="hisobotsiz, yuqori o‘lim, emlash yoki kasallik"
        />
      </LinkedCard>,
    );
  }
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="operations" className="flex flex-col gap-3">
      <SectionTitle id="operations" title="Operatsiyalar" description="Bugungi ish holati" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{cards}</div>
    </section>
  );
}

function ProblemRow({ item }: { item: ProblemHousehold }) {
  return (
    <li>
      <Link
        href={`/households/${item.household.id}`}
        className="flex flex-col gap-1.5 px-4 py-3 text-sm hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{item.household.name}</span>
          <span className="text-xs text-muted tabular-nums">
            {item.household.code}
            {item.district ? ` · ${item.district}` : ""}
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5 sm:justify-end">
          {item.reasons.map((reason) => (
            <Badge key={reason.code} tone={REASON_TONE[reason.code]}>
              {reason.label}
            </Badge>
          ))}
        </span>
      </Link>
    </li>
  );
}

/** “Muammoli xonadonlar” list with reason chips (V3 §10.1 rules; ≤ 10 shown). */
export function ProblemHouseholdsCard({ data }: { data: AdminDashboardV3 }) {
  const problems = data.problem_households;
  if (!problems) return null;
  const more = Math.max(problems.count - problems.items.length, 0);
  return (
    <Card id="problem-households" className="scroll-mt-24">
      <CardHeader
        title="Muammoli xonadonlar"
        description="Hisobot bermagan, o‘limi yuqori, emlashi kechikkan yoki kasalligi ochiq"
        actions={problems.count > 0 ? <Badge tone="danger">{formatNumber(problems.count)}</Badge> : undefined}
      />
      {problems.items.length === 0 ? (
        <EmptyState icon={HeartPulse} title="Muammoli xonadon yo‘q" />
      ) : (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {problems.items.map((item) => (
            <ProblemRow key={item.household.id} item={item} />
          ))}
          {more > 0 && <li className="px-4 py-3 text-sm text-muted sm:px-6">va yana {formatNumber(more)} ta xonadon</li>}
        </ul>
      )}
    </Card>
  );
}

/** “Muddati yaqin partiyalar” on /dashboard (≤ 5, link to the warehouse). */
export function DashboardExpiringLots({ data }: { data: AdminDashboardV3 }) {
  const lots = data.expiring_lots;
  if (!lots) return null;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CalendarClock className="size-4 text-warning-ink" aria-hidden />
            Muddati yaqin partiyalar
          </span>
        }
        description="Qoldig‘i bor, muddati o‘tgan yoki yaqinlashgan"
        actions={
          <LinkButton href="/warehouse" size="sm">
            Ombor
          </LinkButton>
        }
      />
      {lots.items.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Muddati yaqin partiya yo‘q" />
      ) : (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {lots.items.map((lot) => (
            <li key={lot.id}>
              <Link
                href={`/warehouse/${lot.product.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-subtle sm:px-6"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{lot.product.name}</span>
                  <span className="text-xs text-muted">
                    {lot.lot_no || `#${lot.id}`} · {lot.expiry_date ? formatDate(lot.expiry_date) : "—"} ·{" "}
                    {expiryText(lot.days_to_expiry)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge map={LOT_STATUS} status={lot.status} label={lot.status_display} />
                  <span className="text-xs tabular-nums text-muted">
                    {formatNumber(lot.remaining_qty)} {lot.product.unit}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {lots.count > lots.items.length && (
            <li className="px-4 py-3 text-sm text-muted sm:px-6">
              va yana {formatNumber(lots.count - lots.items.length)} ta partiya
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
