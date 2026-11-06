"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { AlarmClock, Bird, CircleCheck, Hourglass, House, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtMoney, fmtNumber } from "@/lib/format";
import type { Dashboard, GeoReport, LatestRow, MahallaRow, Toifa } from "@/lib/reports";
import { districtColor } from "./map/tones";
import { Card, Select } from "./ui";

/** Leaflet needs `window`: the region map is client-only. */
const RegionMap = dynamic(() => import("./map/region-map"), {
  ssr: false,
  loading: () => <div className="flex size-full items-center justify-center text-sm text-muted">Xarita yuklanmoqda…</div>,
});

/* Status colours (fixed, validated reference palette) — always shown with a label, never alone. */
export const TOIFA_COLOR: Record<Toifa, string> = { green: "#0ca30c", yellow: "#fab219", red: "#d03b3b" };
const TOIFA_LABEL: Record<Toifa, string> = { green: "Yashil", yellow: "Sariq", red: "Qizil" };
const TOIFA_HINT: Record<Toifa, string> = {
  green: "o‘z vaqtida / yakunlangan",
  yellow: "e’tibor kerak",
  red: "muddati o‘tgan / rad etilgan",
};

/* Monthly series: categorical slots 1-4 in fixed order (validated: adjacent CVD ΔE ≥ 9.1). */
const SERIES = [
  { key: "created", label: "Yangi xonadon", color: "#2a78d6" },
  { key: "delivered", label: "Jo‘ja yetkazildi", color: "#eb6834" },
  { key: "growingDone", label: "Parvarish tugadi", color: "#1baf7a" },
  { key: "done", label: "Yakunlandi", color: "#eda100" },
] as const;

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
const monthLabel = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
const pct = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toFixed(1).replace(".", ",")}%` : "0%");

function millions(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${fmtNumber(Math.round(value / 100_000) / 10)} mln`;
  return fmtNumber(Math.round(value));
}

/* ------------------------------------------------------------------ KPI */

function Kpi({ icon, tint, label, value, sub }: { icon: ReactNode; tint: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", tint)} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="mt-0.5 whitespace-nowrap text-2xl font-semibold tabular-nums leading-tight text-ink">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

export function KpiCards({ d }: { d: Dashboard }) {
  const k = d.kpi;
  return (
    <section aria-label="Umumiy svod">
      <h2 className="mb-3 text-lg font-semibold">Umumiy svod</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <Kpi
          icon={<House className="size-5" />}
          tint="bg-[#e6f0fa] text-[#1f6fb5]"
          label="Jami xonadon"
          value={fmtNumber(k.total)}
          sub={k.newThisMonth > 0 ? <span className="font-medium text-[#0a7a0a]">↑ {k.newThisMonth} ta bu oy</span> : "bu oy yangi yo‘q"}
        />
        <Kpi icon={<Hourglass className="size-5" />} tint="bg-[#e3f5ee] text-[#137a55]" label="Jarayonda" value={fmtNumber(k.inProgress)} sub={pct(k.inProgress, k.total)} />
        <Kpi
          icon={<Bird className="size-5" />}
          tint="bg-[#fff3dd] text-[#a86b00]"
          label="Parvarishda"
          value={fmtNumber(k.growing)}
          sub={`${fmtNumber(k.birdsNow)} bosh parranda`}
        />
        <Kpi icon={<CircleCheck className="size-5" />} tint="bg-[#e7f6e7] text-[#0a7a0a]" label="Yakunlangan" value={fmtNumber(k.done)} sub={pct(k.done, k.total)} />
        <Kpi
          icon={<AlarmClock className="size-5" />}
          tint="bg-[#fdeceb] text-[#b02a2a]"
          label="Muddati o‘tgan"
          value={<span className={k.overdue > 0 ? "text-danger" : undefined}>{fmtNumber(k.overdue)}</span>}
          sub={k.overdue > 0 ? "e’tibor talab qiladi" : "hammasi vaqtida"}
        />
        <Kpi icon={<Wallet className="size-5" />} tint="bg-[#eeebfb] text-[#4b3cc0]" label="Jami xarajat" value={millions(k.totalCost)} sub="so‘m" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ districts: map + share table */

export function DistrictCard({ geo, district, onDistrict }: { geo: GeoReport; district: string; onDistrict: (name: string) => void }) {
  const selected = district || null;
  const placed = geo.districts.filter((d) => d.latitude !== null);
  const other = geo.districts.find((d) => d.latitude === null && d.total > 0);
  const total = geo.districts.reduce((sum, d) => sum + d.total, 0);
  const max = Math.max(0, ...placed.map((d) => d.total));
  const rows = [...placed].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Tumanlar kesimida xonadonlar soni</h2>
          <p className="text-xs text-muted">Tumanni bossangiz, butun hisobot shu tumanga filtrlanadi.</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              Kam
              <span className="flex overflow-hidden rounded-sm" aria-hidden>
                {["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"].map((c) => (
                  <span key={c} className="h-2.5 w-5" style={{ background: c }} />
                ))}
              </span>
              Ko‘p xonadon
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-sm bg-[#E4EAF1]" aria-hidden />
              Xonadon yo‘q
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-white bg-[#d03b3b]" aria-hidden />
              Muddati o‘tgan bor
            </span>
          </div>
        </div>
        {selected && (
          <button type="button" onClick={() => onDistrict("")} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:bg-subtle">
            Barcha tumanlar
          </button>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="h-[380px] overflow-hidden rounded-xl border border-line lg:h-[460px]">
          <RegionMap districts={geo.districts} points={geo.points} selected={selected} onSelect={(name) => onDistrict(name ?? "")} className="size-full" />
        </div>
        <div className="max-h-[460px] overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-subtle text-xs text-muted">
              <tr>
                <th className="px-2.5 py-2 text-left font-medium">Tuman</th>
                <th className="px-2 py-2 text-right font-medium">Xonadon</th>
                <th className="px-2.5 py-2 text-right font-medium">Ulushi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.name}
                  onClick={() => onDistrict(d.name === selected ? "" : d.name)}
                  className={cn("cursor-pointer border-t border-line hover:bg-subtle", d.name === selected && "bg-accent-soft font-semibold", d.total === 0 && "text-muted")}
                >
                  <td className="px-2.5 py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: districtColor(d.total, max).fill }} aria-hidden />
                      {d.name}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{d.total}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{pct(d.total, total)}</td>
                </tr>
              ))}
              {other && (
                <tr className="border-t border-line text-muted">
                  <td className="px-2.5 py-1.5">{other.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{other.total}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{pct(other.total, total)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ mahallalar: toifa table */

function ToifaHead({ toifa }: { toifa: Toifa }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: TOIFA_COLOR[toifa] }} aria-hidden />
      {TOIFA_LABEL[toifa]}
    </span>
  );
}

export function MahallaCard({ rows, district }: { rows: MahallaRow[]; district: string }) {
  const districts = useMemo(() => {
    const totals = new Map<string, number>();
    rows.forEach((r) => totals.set(r.district, (totals.get(r.district) ?? 0) + r.total));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [rows]);
  const [picked, setPicked] = useState("");
  const current = (picked && districts.includes(picked) ? picked : "") || (district && districts.includes(district) ? district : districts[0] ?? "");
  const shown = rows.filter((r) => r.district === current);
  const sum = shown.reduce((acc, r) => ({ red: acc.red + r.red, yellow: acc.yellow + r.yellow, green: acc.green + r.green, total: acc.total + r.total }), {
    red: 0,
    yellow: 0,
    green: 0,
    total: 0,
  });
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Mahallalar kesimida toifa</h2>
        {districts.length > 0 && (
          <Select aria-label="Tuman" value={current} onChange={(e) => setPicked(e.target.value)} className="h-9 w-auto min-w-44 text-sm">
            {districts.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Ma’lumot yo‘q</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-[13px]">
            <thead className="bg-subtle text-xs text-muted">
              <tr>
                <th className="px-2.5 py-2 text-left font-medium">Mahalla</th>
                <th className="px-2 py-2 text-right font-medium">
                  <ToifaHead toifa="red" />
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  <ToifaHead toifa="yellow" />
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  <ToifaHead toifa="green" />
                </th>
                <th className="px-2.5 py-2 text-right font-medium">Jami</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.district}-${r.mfy}`} className="border-t border-line">
                  <td className="px-2.5 py-1.5">{r.mfy}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.red}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.yellow}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.green}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{r.total}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-line bg-subtle font-semibold">
                <td className="px-2.5 py-2">Jami</td>
                <td className="px-2 py-2 text-right tabular-nums">{sum.red}</td>
                <td className="px-2 py-2 text-right tabular-nums">{sum.yellow}</td>
                <td className="px-2 py-2 text-right tabular-nums">{sum.green}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">{sum.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        Qizil — muddati o‘tgan yoki rad etilgan; sariq — qaytarilgan, muddati yaqin yoki tasdiq kutyapti; yashil — o‘z vaqtida yoki yakunlangan.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ toifa donut */

export function ToifaDonut({ d }: { d: Dashboard }) {
  const [hover, setHover] = useState<Toifa | null>(null);
  const total = d.toifa.reduce((sum, t) => sum + t.count, 0);
  const R = 70;
  const W = 22;
  const C = 2 * Math.PI * R;
  const gap = total > 0 && d.toifa.filter((t) => t.count > 0).length > 1 ? 3 : 0;
  const lengths = d.toifa.map((t) => (total > 0 ? (t.count / total) * C : 0));
  const arcs = d.toifa.map((t, i) => ({
    ...t,
    dash: Math.max(0, lengths[i] - gap),
    offset: lengths.slice(0, i).reduce((sum, len) => sum + len, 0),
  }));
  const focus = hover ? d.toifa.find((t) => t.key === hover) : null;
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-semibold">
        Xonadonlar toifasi <span className="text-sm font-normal text-muted">(umumiy)</span>
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-5">
        <svg viewBox="0 0 180 180" className="size-44 shrink-0" role="img" aria-label={`Toifalar: ${d.toifa.map((t) => `${t.label} ${t.count}`).join(", ")}`}>
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--color-line)" strokeWidth={W} />
          {arcs.map((a) =>
            a.count > 0 ? (
              <circle
                key={a.key}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={TOIFA_COLOR[a.key]}
                strokeWidth={hover === a.key ? W + 4 : W}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={-a.offset}
                transform="rotate(-90 90 90)"
                onMouseEnter={() => setHover(a.key)}
                onMouseLeave={() => setHover(null)}
                className="cursor-default transition-[stroke-width]"
              >
                <title>{`${a.label}: ${a.count} (${pct(a.count, total)})`}</title>
              </circle>
            ) : null,
          )}
          <text x="90" y="88" textAnchor="middle" className="fill-ink" style={{ font: "700 26px system-ui, sans-serif" }}>
            {fmtNumber(focus ? focus.count : total)}
          </text>
          <text x="90" y="108" textAnchor="middle" className="fill-muted" style={{ font: "500 12px system-ui, sans-serif" }}>
            {focus ? focus.label : "xonadon"}
          </text>
        </svg>
        <ul className="flex min-w-44 flex-col gap-2.5 text-sm">
          {d.toifa.map((t) => (
            <li key={t.key} className="flex items-center gap-2" onMouseEnter={() => setHover(t.key)} onMouseLeave={() => setHover(null)}>
              <span className="size-3 shrink-0 rounded-full" style={{ background: TOIFA_COLOR[t.key] }} aria-hidden />
              <span className="flex-1">
                <span className="font-medium">{t.label} toifa</span>
                <span className="block text-xs text-muted">{TOIFA_HINT[t.key]}</span>
              </span>
              <span className="font-semibold tabular-nums">{fmtNumber(t.count)}</span>
              <span className="w-12 text-right text-xs text-muted tabular-nums">{pct(t.count, total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ monthly grouped bars */

export function MonthlyBars({ d }: { d: Dashboard }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 260;
  const pad = { l: 34, r: 8, t: 10, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const values = d.monthly.flatMap((m) => SERIES.map((s) => m[s.key]));
  const rawMax = Math.max(1, ...values);
  const step = rawMax <= 5 ? 1 : rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : rawMax <= 50 ? 10 : Math.ceil(rawMax / 5 / 10) * 10;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const groupW = plotW / Math.max(1, d.monthly.length);
  const barW = Math.min(16, (groupW - 18) / SERIES.length - 2);
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const focus = hover !== null ? d.monthly[hover] : null;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-semibold">
        Holat <span className="text-sm font-normal text-muted">(oylar kesimida)</span>
      </h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Belgilar">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Oylar kesimida xonadonlar holati">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={t === 0 ? 1.2 : 0.8} />
              <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" className="fill-muted" style={{ font: "13px system-ui, sans-serif" }}>
                {t}
              </text>
            </g>
          ))}
          {d.monthly.map((m, i) => {
            const x0 = pad.l + i * groupW + (groupW - SERIES.length * (barW + 2)) / 2;
            return (
              <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.l + i * groupW} y={pad.t} width={groupW} height={plotH} fill={hover === i ? "var(--color-subtle)" : "transparent"} />
                {SERIES.map((s, j) => {
                  const v = m[s.key];
                  const h = (v / max) * plotH;
                  const x = x0 + j * (barW + 2);
                  if (v <= 0) return null;
                  const r = Math.min(4, h, barW / 2);
                  const top = pad.t + plotH - h;
                  return (
                    <path
                      key={s.key}
                      d={`M${x},${pad.t + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.t + plotH} Z`}
                      fill={s.color}
                    />
                  );
                })}
                <text x={pad.l + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" className="fill-muted" style={{ font: "14px system-ui, sans-serif" }}>
                  {monthLabel(m.month)}
                </text>
              </g>
            );
          })}
        </svg>
        {focus && hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop"
            style={{ left: `${Math.min(70, ((pad.l + (hover + 0.5) * groupW) / W) * 100)}%` }}
          >
            <p className="mb-1 font-semibold text-ink">
              {monthLabel(focus.month)} {focus.month.slice(0, 4)}
            </p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                <span className="flex-1">{s.label}</span>
                <b className="text-ink tabular-nums">{focus[s.key]}</b>
              </p>
            ))}
          </div>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-accent">Jadval ko‘rinishi</summary>
        <table className="mt-2 w-full">
          <thead className="text-muted">
            <tr>
              <th className="py-1 text-left font-medium">Oy</th>
              {SERIES.map((s) => (
                <th key={s.key} className="py-1 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.monthly.map((m) => (
              <tr key={m.month} className="border-t border-line">
                <td className="py-1">
                  {monthLabel(m.month)} {m.month.slice(0, 4)}
                </td>
                {SERIES.map((s) => (
                  <td key={s.key} className="py-1 text-right tabular-nums">
                    {m[s.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}

/* ------------------------------------------------------------------ finance */

export function MoneyCard({ d, fin }: { d: Dashboard; fin: { done: { cost: number; revenue: number; profit: number } | null; inProgress: { cost: number } | null } }) {
  const doneCost = fin.done?.cost ?? 0;
  const progressCost = fin.inProgress?.cost ?? 0;
  const profit = fin.done?.profit ?? 0;
  const rows: { label: string; value: ReactNode; strong?: boolean }[] = [
    { label: "Jami xarajat", value: fmtMoney(doneCost + progressCost), strong: true },
    { label: "Yakunlanganlar daromadi", value: fmtMoney(fin.done?.revenue ?? 0) },
    {
      label: profit < 0 ? "Zarar (yakunlangan)" : "Foyda (yakunlangan)",
      value: <span className={profit < 0 ? "text-danger" : "text-[#0a7a0a]"}>{fmtMoney(profit)}</span>,
      strong: true,
    },
    { label: "Jarayondagilar xarajati", value: fmtMoney(progressCost) },
    { label: "Kutilayotgan daromad (taxminiy)", value: fmtMoney(d.estimatedRevenue) },
    { label: "O‘rtacha parvarish muddati", value: d.avgGrowingDays !== null ? `${fmtNumber(d.avgGrowingDays, 1)} kun` : "—" },
  ];
  return (
    <Card className="flex flex-col gap-1">
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <Wallet className="size-5 text-accent" aria-hidden />
        Moliyaviy holat
      </h2>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
          <span className="text-sm text-muted">{r.label}</span>
          <span className={cn("text-right tabular-nums", r.strong ? "font-semibold text-ink" : "text-ink")}>{r.value}</span>
        </div>
      ))}
    </Card>
  );
}

/* ------------------------------------------------------------------ latest households */

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1.5">
      <span className="mt-[5px] size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      {children}
    </span>
  );
}

const GREY = "#9aa5b4";

function stageCell(r: LatestRow) {
  if (r.status === "DONE") return <Dot color={TOIFA_COLOR.green}>Yakunlangan</Dot>;
  if (r.status === "REJECTED") return <Dot color={TOIFA_COLOR.red}>Rad etilgan</Dot>;
  const color = r.stageOverdue ? TOIFA_COLOR.red : r.stageStatus === "RETURNED" ? TOIFA_COLOR.yellow : "#2a78d6";
  return (
    <Dot color={color}>
      {r.currentStage}. {r.stageTitle}
      {r.stageOverdue ? " (kechikkan)" : r.stageStatus === "RETURNED" ? " (qaytarilgan)" : r.stageStatus === "SUBMITTED" ? " (tasdiqda)" : ""}
    </Dot>
  );
}

function feedCell(r: LatestRow) {
  if (r.feed.length > 0) return <Dot color={TOIFA_COLOR.green}>{r.feed.map((f) => `${fmtNumber(f.qty)} ${f.unit}`).join(", ")}</Dot>;
  if (r.currentStage >= 10 || r.status === "DONE") return <Dot color={TOIFA_COLOR.yellow}>Olinmagan</Dot>;
  return <Dot color={GREY}>Hali emas</Dot>;
}

function moneyCell(r: LatestRow) {
  if (r.profit === null) return <Dot color={GREY}>{r.totalCost > 0 ? `Xarajat ${millions(r.totalCost)}` : "—"}</Dot>;
  const good = r.profit >= 0;
  return (
    <Dot color={good ? TOIFA_COLOR.green : TOIFA_COLOR.red}>
      {good ? "Foyda" : "Zarar"} {millions(Math.abs(r.profit))}
      {r.revenueIsEstimate ? <span className="text-muted"> (taxm.)</span> : null}
    </Dot>
  );
}

export function LatestTable({ d }: { d: Dashboard }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-semibold">
        Xonadonlar holati <span className="text-sm font-normal text-muted">(so‘nggi ma’lumotlar)</span>
      </h2>
      {d.latest.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Xonadon yo‘q</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="bg-subtle text-xs text-muted">
              <tr>
                {["№", "Egasi F.I.SH", "Hudud", "Bosqich", "Jo‘jalar", "Yem", "Veterinar", "Moliyaviy holat", "Toifa"].map((h) => (
                  <th key={h} className={cn("px-2.5 py-2 text-left font-medium", h === "Toifa" && "text-center")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.latest.map((r, i) => (
                <tr key={r.id} className="border-t border-line hover:bg-subtle">
                  <td className="px-2.5 py-2 text-muted tabular-nums">{i + 1}</td>
                  <td className="px-2.5 py-2">
                    <Link href={`/cases/${r.id}`} className="whitespace-nowrap font-medium hover:text-accent">
                      {(r.owner || "—").replace(" (DEMO)", "")}
                    </Link>
                    <span className="block text-xs text-muted">{r.code}</span>
                  </td>
                  <td className="px-2.5 py-2 whitespace-nowrap">
                    {r.district || "—"}
                    <span className="block text-xs text-muted">{r.mfy || "—"}</span>
                  </td>
                  <td className="px-2.5 py-2">{stageCell(r)}</td>
                  <td className="px-2.5 py-2">
                    {r.birds !== null ? (
                      <Dot color={TOIFA_COLOR.green}>
                        {fmtNumber(r.birds)} bosh{r.days !== null && r.status === "IN_PROGRESS" ? ` · ${r.days}-kun` : ""}
                      </Dot>
                    ) : (
                      <Dot color={GREY}>Kutilmoqda</Dot>
                    )}
                  </td>
                  <td className="px-2.5 py-2">{feedCell(r)}</td>
                  <td className="px-2.5 py-2">
                    <Dot color={r.vetVisits > 0 ? TOIFA_COLOR.green : GREY}>{r.vetVisits > 0 ? `${r.vetVisits} ta ko‘rik` : "Ko‘rik yo‘q"}</Dot>
                  </td>
                  <td className="px-2.5 py-2">{moneyCell(r)}</td>
                  <td className="px-2.5 py-2 text-center">
                    <span
                      className={cn("inline-block min-w-16 rounded-full px-2.5 py-0.5 text-xs font-semibold", r.toifa === "yellow" ? "text-[#0b0b0b]" : "text-white")}
                      style={{ background: TOIFA_COLOR[r.toifa] }}
                    >
                      {TOIFA_LABEL[r.toifa]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
