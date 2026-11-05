"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bug, CalendarClock, CalendarDays, MessageSquareHeart, Pill, Stethoscope, Syringe, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { VetSummary } from "@/lib/types";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StaleDataError } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useUrlParams } from "@/components/stats/period-picker";
import { DiseaseFormModal, TreatmentFormModal, VaccinationFormModal, VisitFormModal } from "./forms";
import { DiseaseList, TreatmentList, VaccinationList, VisitList } from "./lists";
import { useVetRole } from "./shared";
import { VetCalendar } from "./vet-calendar";

const TABS = [
  { key: "calendar", label: "Kalendar" },
  { key: "visits", label: "Tekshiruvlar" },
  { key: "vaccinations", label: "Emlashlar" },
  { key: "diseases", label: "Kasalliklar" },
  { key: "treatments", label: "Davolash" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Filters of one tab are dropped when another tab is opened (their values differ per list). */
const LIST_PARAMS = { status: null, overdue: null, mine: null, active: null, day: null } as const;

type Dialog = "visit" | "vaccination" | "disease" | "treatment" | null;

/** /vet — VET home and ADMIN overview (API_CONTRACT_V3 §8.7, §8.8, §15.3). */
export function VetHome() {
  const params = useSearchParams();
  const setParams = useUrlParams();
  const { isVet } = useVetRole();
  const [dialog, setDialog] = useState<Dialog>(null);
  const summary = useApi<VetSummary>("/vet/summary");
  const raw = params.get("tab");
  const tab = (TABS.find((item) => item.key === raw)?.key ?? "calendar") as TabKey;
  const mine = params.get("mine") === "1";
  const data = summary.data;

  const openTab = (next: TabKey, extra: Record<string, string | null> = {}) =>
    setParams({ ...LIST_PARAMS, tab: next === "calendar" ? null : next, ...extra });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Veterinariya"
        description={data ? `Bugun: ${formatDate(data.date)} · tekshiruvlar, emlash kalendari, kasalliklar va davolash` : "Tekshiruvlar, emlash kalendari, kasalliklar va davolash"}
        actions={
          <>
            <Button icon={<Stethoscope className="size-4" aria-hidden />} onClick={() => setDialog("visit")}>
              Tekshiruv
            </Button>
            <Button variant="secondary" icon={<Syringe className="size-4" aria-hidden />} onClick={() => setDialog("vaccination")}>
              Emlash
            </Button>
            <Button variant="secondary" icon={<Bug className="size-4" aria-hidden />} onClick={() => setDialog("disease")}>
              Kasallik
            </Button>
            {isVet && (
              <Button variant="secondary" icon={<Pill className="size-4" aria-hidden />} onClick={() => setDialog("treatment")}>
                Davolash
              </Button>
            )}
          </>
        }
      />

      <StaleDataError error={summary.error} onRetry={summary.reload} className="rounded-xl border" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Bugungi tekshiruvlar" icon={CalendarDays} value={data?.visits.today} onClick={() => openTab("calendar")} />
        <Kpi
          label="Muddati o‘tgan tekshiruv"
          icon={CalendarClock}
          value={data?.visits.overdue}
          danger
          onClick={() => openTab("visits", { overdue: "1" })}
        />
        <Kpi label="7 kunda emlash" icon={Syringe} value={data?.vaccinations.due_7d} onClick={() => openTab("vaccinations", { status: "PLANNED" })} />
        <Kpi
          label="Muddati o‘tgan emlash"
          icon={TriangleAlert}
          value={data?.vaccinations.overdue}
          danger
          onClick={() => openTab("vaccinations", { overdue: "1" })}
        />
        <Kpi
          label="Faol kasalliklar"
          icon={Bug}
          value={data ? data.diseases.open + data.diseases.treatment : undefined}
          hint={data ? `ochiq ${data.diseases.open} · davolanmoqda ${data.diseases.treatment}` : undefined}
          onClick={() => openTab("diseases", { active: "1" })}
        />
        <Kpi label="Yangi murojaatlar" icon={MessageSquareHeart} value={data?.requests.new} href="/vet/requests" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={TABS} value={tab} onChange={(next) => openTab(next)} label="Veterinariya bo‘limlari" />
        {tab === "calendar" && isVet && (
          <label className="inline-flex items-center gap-2 text-[13px] text-muted">
            <input
              type="checkbox"
              checked={mine}
              onChange={() => setParams({ mine: mine ? null : "1" })}
              className="size-4 accent-[var(--color-primary)]"
            />
            Faqat meniki
          </label>
        )}
      </div>

      {tab === "calendar" && (
        <>
          <VetCalendar mine={mine} />
          {data && (data.overdue_visits.length > 0 || data.overdue_vaccinations.length > 0) && <OverduePanel summary={data} onOpen={openTab} />}
        </>
      )}
      {tab === "visits" && <VisitList />}
      {tab === "vaccinations" && <VaccinationList />}
      {tab === "diseases" && <DiseaseList />}
      {tab === "treatments" && <TreatmentList />}

      {dialog === "visit" && <VisitFormModal onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog === "vaccination" && <VaccinationFormModal onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog === "disease" && <DiseaseFormModal onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
      {dialog === "treatment" && <TreatmentFormModal onClose={() => setDialog(null)} onDone={() => setDialog(null)} />}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  hint,
  danger = false,
  onClick,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: typeof Stethoscope;
  hint?: string;
  danger?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const alert = danger && (value ?? 0) > 0;
  const body: ReactNode = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-[13px] leading-snug text-muted">{label}</span>
        <Icon className={cn("mt-0.5 size-4 shrink-0", alert ? "text-danger" : "text-muted")} aria-hidden />
      </span>
      {value === undefined ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <span className={cn("mt-1.5 block text-[24px] font-semibold leading-tight tabular-nums", alert ? "text-danger" : "text-ink")}>
          {formatNumber(value)}
        </span>
      )}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </>
  );
  const className = cn(
    "flex min-w-0 flex-col rounded-xl border bg-surface p-4 text-left shadow-card transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    alert ? "border-danger/40 hover:border-danger" : "border-line hover:border-line-strong",
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function OverduePanel({ summary, onOpen }: { summary: VetSummary; onOpen: (tab: TabKey, extra?: Record<string, string | null>) => void }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <TriangleAlert className="size-4 text-danger" aria-hidden />
            Muddati o‘tgan ishlar
          </span>
        }
        description="Rejalashtirilgan, lekin o‘z vaqtida o‘tkazilmagan tekshiruv va emlashlar"
      />
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {summary.overdue_visits.map((visit) => (
          <li key={`v-${visit.id}`}>
            <Link href={`/vet/visits/${visit.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-subtle sm:px-6">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {visit.household.name} <span className="font-normal text-muted">· tekshiruv</span>
                </span>
                <span className="block text-xs tabular-nums text-muted">
                  {visit.code} · {visit.purpose}
                </span>
              </span>
              <span className="text-xs font-medium tabular-nums text-danger">{formatDate(visit.planned_date)}</span>
            </Link>
          </li>
        ))}
        {summary.overdue_vaccinations.map((item) => (
          <li key={`e-${item.id}`}>
            <button
              type="button"
              onClick={() => onOpen("vaccinations", { overdue: "1" })}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-subtle sm:px-6"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {item.household.name} <span className="font-normal text-muted">· {item.vaccine_name}</span>
                </span>
                <span className="block text-xs tabular-nums text-muted">{item.code}</span>
              </span>
              <span className="text-xs font-medium tabular-nums text-danger">{formatDate(item.planned_date)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2 border-t border-line px-4 py-3 sm:px-6">
        <LinkButton href="/vet?tab=visits&overdue=1" size="sm">
          Barcha tekshiruvlar
        </LinkButton>
        <LinkButton href="/vet?tab=vaccinations&overdue=1" size="sm">
          Barcha emlashlar
        </LinkButton>
      </div>
    </Card>
  );
}
