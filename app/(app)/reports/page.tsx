"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { BarList, SplitBar } from "@/components/bars";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, Empty, Field, Input, Loadable, PageHeader, Select, Stat } from "@/components/ui";
import { SAMARQAND_DISTRICTS } from "@/lib/districts";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { COST_ITEMS } from "@/lib/finance";
import { fmtMoney, fmtNumber } from "@/lib/format";
import {
  downloadReport,
  fmtHours,
  REPORT_TABS,
  reportPath,
  toCaseRows,
  toFinanceReport,
  toOverview,
  toStaffRows,
  type Money,
  type ReportKey,
} from "@/lib/reports";
import { REQUEST_STATUS_LABELS, type RequestStatus } from "@/lib/requests";
import { roleLabel } from "@/lib/roles";
import { stageDef } from "@/lib/stages";
import { useApi } from "@/lib/use-api";

type Filters = { date_from?: string; date_to?: string; district?: string };

/** Reports for ADMIN / SUPERADMIN: Umumiy, Xonadonlar, Xodimlar, Moliya; each tab has its Excel download. */
export default function ReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<ReportKey>("overview");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [district, setDistrict] = useState("");
  const [busy, setBusy] = useState(false);
  const filters: Filters = { date_from: from || undefined, date_to: to || undefined, district: district || undefined };
  const resource = useApi<unknown>(reportPath(tab), filters);

  const excel = async () => {
    setBusy(true);
    try {
      await downloadReport(tab, filters);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Hisobotlar"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={resource.reload} loading={resource.loading} icon={<RefreshCw className="size-4" aria-hidden />}>
              Yangilash
            </Button>
            <Button size="sm" onClick={excel} loading={busy} icon={<FileSpreadsheet className="size-4" aria-hidden />}>
              Excel
            </Button>
          </>
        }
      />
      <div className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
          {REPORT_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn("h-9 whitespace-nowrap rounded-lg px-4 text-sm font-medium", tab === t.key ? "bg-primary text-white" : "text-muted hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-[1fr_1fr_1.3fr]">
        <Field label="Sanadan" htmlFor="r-from">
          <Input id="r-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Sanagacha" htmlFor="r-to">
          <Input id="r-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Tuman / shahar" htmlFor="r-district" className="col-span-2 sm:col-span-1">
          <Select id="r-district" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">Barcha tumanlar</option>
            {SAMARQAND_DISTRICTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Loadable data={resource.data} error={resource.error} reload={resource.reload}>
        {(data) =>
          tab === "overview" ? <OverviewTab data={data} /> : tab === "cases" ? <CasesTab data={data} /> : tab === "staff" ? <StaffTab data={data} /> : <FinanceTab data={data} />
        }
      </Loadable>
    </>
  );
}

function profitClass(value: number | null): string {
  if (value === null) return "";
  return value >= 0 ? "text-accent" : "text-danger";
}

function MoneyRows({ title, money }: { title: string; money: Money | null }) {
  if (!money) return null;
  return (
    <div className="rounded-xl bg-subtle p-3">
      <p className="mb-1.5 text-[13px] font-medium">{title}</p>
      <dl className="grid gap-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Xarajat</dt>
          <dd className="tabular-nums">{fmtMoney(money.cost)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Daromad</dt>
          <dd className="tabular-nums">{fmtMoney(money.revenue)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium">{money.profit >= 0 ? "Foyda" : "Zarar"}</dt>
          <dd className={cn("tabular-nums font-semibold", profitClass(money.profit))}>{fmtMoney(money.profit)}</dd>
        </div>
      </dl>
    </div>
  );
}

function OverviewTab({ data }: { data: unknown }) {
  const o = toOverview(data);
  const reqRows = Object.entries(o.requests);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Jami xonadon" value={fmtNumber(o.cases.total ?? (o.cases.inProgress ?? 0) + (o.cases.done ?? 0) + (o.cases.rejected ?? 0))} />
        <Stat label="Jarayonda" value={fmtNumber(o.cases.inProgress)} />
        <Stat label="Yakunlangan" value={fmtNumber(o.cases.done)} tone="green" />
        <Stat label="Rad etilgan" value={fmtNumber(o.cases.rejected)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Bosqichlar muddati</h2>
          <SplitBar left={{ label: "O‘z vaqtida", value: o.onTime }} right={{ label: "Kechikkan", value: o.late }} />
          {o.lateOpen !== null && o.lateOpen > 0 && <p className="mt-2 text-sm font-semibold text-danger">Hozir muddati o‘tib turgan: {o.lateOpen} ta</p>}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Veterinar tashriflari</h2>
          <SplitBar left={{ label: "Bajarilgan", value: o.visits.done }} right={{ label: "Muddati o‘tgan", value: o.visits.overdue }} />
          {o.visits.planned !== null && <p className="mt-2 text-sm text-muted">Rejalashtirilgan: {o.visits.planned} ta</p>}
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Bosqichlar bo‘yicha (hozirgi)</h2>
        <BarList
          data={o.perStage.map((s) => ({
            key: String(s.number),
            label: (
              <Link href={`/cases?stage=${s.number}`} className="hover:text-accent">
                {s.number}. {s.title || stageDef(s.number)?.title}
              </Link>
            ),
            value: s.total,
            display: (
              <>
                {s.total}
                {s.overdue > 0 && <span className="ml-1.5 text-danger">({s.overdue} kechikkan)</span>}
              </>
            ),
            title: `${s.total} ta xonadon, ${s.overdue} ta kechikkan`,
            tone: s.overdue ? "danger" : "accent",
          }))}
        />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">So‘rovlar holati</h2>
          <BarList
            data={reqRows.map(([status, count]) => ({
              key: status,
              label: REQUEST_STATUS_LABELS[status as RequestStatus] ?? status,
              value: count,
              tone: status === "REJECTED" ? "muted" : status === "DONE" ? "accent" : "primary",
            }))}
            empty="So‘rovlar yo‘q."
          />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Moliya</h2>
          {o.finance.done || o.finance.inProgress || o.finance.total ? (
            <div className="flex flex-col gap-2">
              <MoneyRows title="Yakunlangan xonadonlar" money={o.finance.done} />
              <MoneyRows title="Jarayondagi xonadonlar" money={o.finance.inProgress} />
              <MoneyRows title="Jami" money={o.finance.total} />
            </div>
          ) : (
            <p className="text-sm text-muted">Ma’lumot yo‘q.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function LateTag({ count }: { count: number }) {
  return count > 0 ? <Badge tone="red">{count} ta kechikish</Badge> : <Badge tone="green">O‘z vaqtida</Badge>;
}

function CasesTab({ data }: { data: unknown }) {
  const rows = toCaseRows(data);
  if (!rows.length) return <Empty title="Xonadonlar yo‘q" />;
  const late = rows.filter((r) => r.lateStages > 0).sort((a, b) => b.lateStages - a.lateStages).slice(0, 8);
  return (
    <div className="flex flex-col gap-4">
      {late.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Eng ko‘p kechikkan xonadonlar</h2>
          <BarList data={late.map((r) => ({ key: r.code || String(r.id), label: `${r.code} · ${r.name}`, value: r.lateStages, display: `${r.lateStages} ta`, tone: "danger" }))} />
        </Card>
      )}
      <div className="flex flex-col gap-2.5">
        {rows.map((r, index) => (
          <Card key={r.id ?? index} className="p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {r.id ? (
                <Link href={`/cases/${r.id}`} className="text-sm font-semibold text-accent">
                  {r.code}
                </Link>
              ) : (
                <span className="text-sm font-semibold">{r.code}</span>
              )}
              <span className="min-w-0 truncate font-medium">{r.name}</span>
              <LateTag count={r.lateStages} />
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {r.stage ? `${r.stage}. ${r.stageTitle || stageDef(r.stage)?.title || ""}` : r.status}
              {r.days !== null ? ` · zanjirda ${fmtNumber(r.days, 1)} kun` : ""}
            </p>
            {r.worst && <p className="mt-1 text-[13px] text-danger">Eng katta kechikish: {r.worst}</p>}
            {(r.cost !== null || r.revenue !== null) && (
              <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px]">
                <span>
                  <span className="text-muted">Xarajat:</span> <b className="tabular-nums">{fmtMoney(r.cost)}</b>
                </span>
                {r.revenue !== null && (
                  <span>
                    <span className="text-muted">Daromad:</span> <b className="tabular-nums">{fmtMoney(r.revenue)}</b>
                  </span>
                )}
                {r.profit !== null && (
                  <span>
                    <span className="text-muted">Foyda:</span> <b className={cn("tabular-nums", profitClass(r.profit))}>{fmtMoney(r.profit)}</b>
                  </span>
                )}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, children, tone }: { label: string; children: ReactNode; tone?: "red" }) {
  return (
    <div className="rounded-lg bg-subtle px-2.5 py-1.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums", tone === "red" && "text-danger")}>{children}</p>
    </div>
  );
}

function StaffTab({ data }: { data: unknown }) {
  const rows = toStaffRows(data);
  if (!rows.length) return <Empty title="Xodimlar faoliyati yo‘q" />;
  const late = rows.filter((r) => r.late > 0).sort((a, b) => b.late - a.late).slice(0, 8);
  return (
    <div className="flex flex-col gap-4">
      {late.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Kechikishlar (xodimlar)</h2>
          <BarList data={late.map((r) => ({ key: String(r.id ?? r.name), label: `${r.name} · ${roleLabel(r.role)}`, value: r.late, display: `${r.late} ta`, tone: "danger" }))} />
        </Card>
      )}
      <div className="grid gap-2.5 lg:grid-cols-2">
        {rows.map((r, index) => (
          <Card key={r.id ?? index} className="p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.name || "—"}</span>
              <span className="text-xs text-muted">{roleLabel(r.role)}</span>
              <LateTag count={r.late} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <Metric label="Topshirgan bosqich">{r.submitted}</Metric>
              <Metric label="O‘rtacha bajarish">{fmtHours(r.avgSubmitHours)}</Metric>
              <Metric label="Tasdiqlagan">{r.approvals}</Metric>
              <Metric label="O‘rtacha qaror">{fmtHours(r.avgDecideHours)}</Metric>
              <Metric label="So‘rovlar">{r.requests}</Metric>
              <Metric label="Tashriflar (o‘tgan)" tone={r.visitsOverdue ? "red" : undefined}>
                {r.visitsDone}
                {r.visitsOverdue ? ` (${r.visitsOverdue})` : ""}
              </Metric>
            </div>
            {r.lateList.length > 0 && (
              <details className="mt-2 text-[13px]">
                <summary className="cursor-pointer text-danger">Kechikkanlar ({r.lateList.length})</summary>
                <ul className="mt-1 flex flex-col gap-0.5 border-l-2 border-danger/30 pl-2.5">
                  {r.lateList.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function FinanceTab({ data }: { data: unknown }) {
  const report = toFinanceReport(data);
  const { totals, rows } = report;
  if (!rows.length) return <Empty title="Moliyaviy ma’lumot yo‘q" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Jami xarajat" value={fmtMoney(totals.totalCost)} />
        <Stat label="Daromad" value={fmtMoney(totals.revenue)} />
        <Stat label={totals.profit >= 0 ? "Foyda" : "Zarar"} value={fmtMoney(totals.profit)} tone={totals.profit >= 0 ? "green" : "red"} />
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Xarajatlar tarkibi</h2>
        <BarList data={COST_ITEMS.map((item) => ({ key: item.key, label: item.label, value: totals.items[item.key] ?? 0, display: fmtMoney(totals.items[item.key] ?? 0) }))} />
      </Card>
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line bg-subtle text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Xonadon</th>
                {COST_ITEMS.map((item) => (
                  <th key={item.key} className="px-3 py-2 text-right font-medium">
                    {item.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Jami xarajat</th>
                <th className="px-3 py-2 text-right font-medium">Daromad</th>
                <th className="px-3 py-2 text-right font-medium">Foyda</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, index) => (
                <tr key={r.id ?? index} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    {r.id ? (
                      <Link href={`/cases/${r.id}`} className="font-medium text-accent">
                        {r.code}
                      </Link>
                    ) : (
                      r.code
                    )}
                    <span className="block max-w-40 truncate text-muted">{r.name}</span>
                  </td>
                  {COST_ITEMS.map((item) => (
                    <td key={item.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {fmtNumber(r.items[item.key])}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{fmtNumber(r.totalCost)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.revenue !== null ? fmtNumber(r.revenue) : "—"}</td>
                  <td className={cn("whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums", profitClass(r.profit))}>{r.profit !== null ? fmtNumber(r.profit) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line bg-subtle font-semibold">
              <tr>
                <td className="px-3 py-2">Jami</td>
                {COST_ITEMS.map((item) => (
                  <td key={item.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {fmtNumber(totals.items[item.key])}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNumber(totals.totalCost)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtNumber(totals.revenue)}</td>
                <td className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums", profitClass(totals.profit))}>{fmtNumber(totals.profit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="px-3 py-2 text-xs text-muted">Summalar so‘mda.</p>
      </Card>
    </div>
  );
}
