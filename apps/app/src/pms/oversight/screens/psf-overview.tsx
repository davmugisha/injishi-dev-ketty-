"use client";

/**
 * The PSF console's Overview: the report for the officer's place over a
 * period (2026-10-19).
 *
 * A district officer reads their district. A province officer reads the
 * province and, below, every district in it side by side: who is falling
 * behind, where there is no district officer, where the members are. Every
 * figure compares with the same length of time just before, so a number on
 * its own still says whether things are getting better.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  Clock3,
  Download,
  FileText,
  Hourglass,
  Printer,
  UserX,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { PsfDistrictRow, PsfKpi, PsfReport, PsfReportMonth, PsfReportSlice } from "@injishi/contracts";

import { LoadFailed } from "../../components/ui";
import { fetchPsfReport } from "../data/psf-console";
import { PSF_CONSOLE, PsfConsoleShell, usePsfConsole } from "../components/psf-console-shell";

type PeriodKey = "month" | "quarter" | "year" | "twelve";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "Last 90 days" },
  { key: "year", label: "This year" },
  { key: "twelve", label: "12 months" },
];

function kigaliToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
}
function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function periodOf(key: PeriodKey): { from: string; to: string; label: string } {
  const to = kigaliToday();
  if (key === "month") return { from: `${to.slice(0, 7)}-01`, to, label: "this month" };
  if (key === "quarter") return { from: shift(to, -89), to, label: "the last 90 days" };
  if (key === "year") return { from: `${to.slice(0, 4)}-01-01`, to, label: "this year" };
  return { from: shift(to, -364), to, label: "the last 12 months" };
}

const num = (n: number) => n.toLocaleString("en-US");
const rwfShort = (n: number) =>
  n >= 1_000_000 ? `RWF ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : n >= 10_000 ? `RWF ${Math.round(n / 1000)}k` : `RWF ${num(n)}`;
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

export function PsfOverview() {
  return (
    <PsfConsoleShell title="Overview" lede="Registrations, decisions and members">
      <OverviewBody />
    </PsfConsoleShell>
  );
}

function OverviewBody() {
  const { area, areaLabel, setArea, scope } = usePsfConsole();
  const [period, setPeriod] = useState<PeriodKey>("year");
  const [report, setReport] = useState<PsfReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const range = useMemo(() => periodOf(period), [period]);

  useEffect(() => {
    let live = true;
    setReport(null);
    setFailed(false);
    void fetchPsfReport(range.from, range.to, area).then((r) => {
      if (!live) return;
      if (r.outcome === "ok") setReport(r.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [range, area, attempt]);

  const exportCsv = () => {
    if (!report) return;
    const head = ["District", "Code", "Province", "Registered", "Waiting", "Overdue", "Approved", "Declined", "Members", "Membership fees (RWF)", "Median days to decide", "District officer"];
    const rows = report.districts.map((d) => [d.name, d.letters, d.provinceName, d.registered, d.waiting, d.overdue, d.approved, d.declined, d.members, d.membershipFeesRwf, d.medianDecisionDays ?? "", d.officers.join("; ")]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `psf-report-${areaLabel.replace(/\s+/g, "-").toLowerCase()}-${range.from}-to-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <style>{`@media print { aside, header nav, .no-print { display: none !important; } main { padding: 0 !important; } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full overflow-x-auto rounded-full bg-hover p-1" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={[
                "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                period === p.key ? "bg-card text-foreground shadow-sm ring-1 ring-line" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportCsv} disabled={!report} className="inline-flex h-9 items-center gap-1.5 rounded border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-hover disabled:opacity-50">
            <Download size={15} aria-hidden /> Export CSV
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-hover">
            <Printer size={15} aria-hidden /> Print
          </button>
        </div>
      </div>

      {failed ? (
        <LoadFailed onRetry={() => setAttempt((a) => a + 1)}>We couldn&apos;t load the report.</LoadFailed>
      ) : !report ? (
        <OverviewSkeleton />
      ) : (
        <>
          <NowStrip report={report} />

          <section aria-label="Over the period" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={FileText} label="Registered" kpi={report.kpis.registered} />
            <Kpi icon={Hourglass} label="Applied" kpi={report.kpis.applied} />
            <Kpi icon={BadgeCheck} label="Approved" kpi={report.kpis.approved} />
            <Kpi icon={Users} label="New members" kpi={report.kpis.newMembers} />
            <Kpi icon={Wallet} label="Membership fees" kpi={report.kpis.membershipFeesRwf} money />
            <Kpi
              icon={Clock3}
              label="Median days to decide"
              kpi={{ value: report.kpis.medianDecisionDays.value ?? 0, previous: report.kpis.medianDecisionDays.previous ?? 0 }}
              empty={report.kpis.medianDecisionDays.value === null}
              lowerIsBetter
              decimals
            />
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Panel title="Month by month" sub="Applications, approvals and new members" className="xl:col-span-2">
              <MonthsChart months={report.months} />
            </Panel>
            <Panel title="From application to member" sub={`What was applied for in ${range.label}`}>
              <Funnel f={report.funnel} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
            <Panel title="By sector" sub="Businesses registered, and membership fees in the period">
              <Bars slices={report.bySector} money />
            </Panel>
            <Panel title="Members by level" sub="Current memberships, and what they pay a year">
              <Bars slices={report.byFamily} money />
            </Panel>
            <Panel title="Specialized cluster" sub="Businesses by who owns them">
              {report.byGroup.length ? <Bars slices={report.byGroup} /> : <p className="py-6 text-center text-sm text-muted-foreground">No business marked yet.</p>}
            </Panel>
          </div>

          {report.districts.length > 1 ? (
            <Panel title="Districts side by side" sub="Pick a district to narrow the whole console to it" flush>
              <DistrictTable rows={report.districts} onPick={(id) => setArea({ district: id })} />
            </Panel>
          ) : null}

          {scope && scope.level !== "district" && area.district ? (
            <p className="no-print text-sm text-muted-foreground">
              Showing one district.{" "}
              <button type="button" onClick={() => setArea({})} className="font-semibold text-accent-text underline-offset-4 hover:underline">
                Back to all of {scope.label}
              </button>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function NowStrip({ report }: { report: PsfReport }) {
  const n = report.now;
  const items: { icon: LucideIcon; label: string; value: number; tone: "bad" | "warn" | "ok" | "info"; href?: string }[] = [
    { icon: Hourglass, label: "Waiting on PSF", value: n.waiting, tone: "info", href: PSF_CONSOLE.queue },
    { icon: AlertTriangle, label: `Over ${7} days`, value: n.overdue, tone: n.overdue ? "bad" : "ok", href: PSF_CONSOLE.queue },
    { icon: Wallet, label: "Approved, to pay", value: n.awaitingPayment, tone: "warn" },
    { icon: BadgeCheck, label: "Members now", value: n.members, tone: "ok", href: PSF_CONSOLE.businesses },
    { icon: CalendarClock, label: "Ending in 30 days", value: n.expiringIn30Days, tone: n.expiringIn30Days ? "warn" : "ok" },
  ];
  const toneClass = { bad: "bg-bad-bg text-bad", warn: "bg-warn-bg text-warn", ok: "bg-ok-bg text-ok", info: "bg-info-bg text-info" };
  return (
    <section aria-label="Right now" className="rounded border border-line bg-card p-1.5 shadow-sm">
      <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-3 xl:grid-cols-5">
        {items.map((i) => {
          const body = (
            <div className="flex items-center gap-3 rounded px-3 py-3 transition-colors hover:bg-hover">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${toneClass[i.tone]}`}>
                <i.icon size={17} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="pms-num text-xl font-bold leading-none">{num(i.value)}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{i.label}</p>
              </div>
            </div>
          );
          return i.href ? (
            <Link key={i.label} href={i.href} className="block">
              {body}
            </Link>
          ) : (
            <div key={i.label}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  kpi,
  money = false,
  lowerIsBetter = false,
  decimals = false,
  empty = false,
}: {
  icon: LucideIcon;
  label: string;
  kpi: PsfKpi;
  money?: boolean;
  lowerIsBetter?: boolean;
  decimals?: boolean;
  empty?: boolean;
}) {
  // Nothing before to compare with is not growth: say so plainly, in neither colour.
  const noEarlier = kpi.previous === 0;
  const delta = noEarlier ? null : ((kpi.value - kpi.previous) / kpi.previous) * 100;
  const up = kpi.value > kpi.previous;
  const good = kpi.value === kpi.previous || noEarlier ? null : lowerIsBetter ? !up : up;
  const show = empty ? "—" : money ? rwfShort(kpi.value) : decimals ? kpi.value.toFixed(1) : num(kpi.value);
  return (
    <div className="flex flex-col gap-3 rounded border border-line bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon size={16} aria-hidden className="text-faint" />
      </div>
      <p className="pms-num pms-display text-2xl font-bold tracking-tight">{show}</p>
      <p className="flex items-center gap-1.5 text-xs">
        {empty ? (
          <span className="text-muted-foreground">Nothing decided yet</span>
        ) : noEarlier ? (
          <span className="text-muted-foreground">Nothing in the period before</span>
        ) : good === null ? (
          <span className="text-muted-foreground">Same as the period before</span>
        ) : (
          <span className={["inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold", good ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"].join(" ")}>
            {up ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
            {`${Math.abs(delta ?? 0).toFixed(0)}%`}
          </span>
        )}
        {!empty && good !== null ? <span className="text-muted-foreground">vs {money ? rwfShort(kpi.previous) : decimals ? kpi.previous.toFixed(1) : num(kpi.previous)} before</span> : null}
      </p>
    </div>
  );
}

function Panel({ title, sub, className = "", flush = false, children }: { title: string; sub?: string; className?: string; flush?: boolean; children: React.ReactNode }) {
  return (
    <section className={`flex flex-col rounded border border-line bg-card shadow-sm ${className}`}>
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-bold">{title}</h2>
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      <div className={flush ? "" : "flex-1 p-5"}>{children}</div>
    </section>
  );
}

const SERIES: { key: keyof Pick<PsfReportMonth, "applied" | "approved" | "members">; label: string; color: string }[] = [
  { key: "applied", label: "Applied", color: "var(--info)" },
  { key: "approved", label: "Approved", color: "var(--accent)" },
  { key: "members", label: "New members", color: "var(--accent-text)" },
];

/** Grouped bars, one group a month, drawn in SVG so the console needs no chart library. */
function MonthsChart({ months }: { months: PsfReportMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...months.flatMap((m) => SERIES.map((s) => m[s.key])));
  const nice = Math.max(4, Math.ceil(max / 4) * 4);
  const W = 720;
  const H = 230;
  const pad = { l: 30, r: 8, t: 10, b: 26 };
  const gw = (W - pad.l - pad.r) / Math.max(1, months.length);
  const bw = Math.min(14, (gw - 8) / SERIES.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice);
  const h = hover === null ? null : months[hover];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <span className="ml-auto text-muted-foreground">
          {h ? (
            <>
              <b className="text-foreground">{monthLabel(h.month)} {h.month.slice(0, 4)}</b> · {h.applied} applied · {h.approved} approved · {h.members} members · {rwfShort(h.feesRwf)}
            </>
          ) : (
            "Point at a month for its numbers"
          )}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Applications, approvals and new members by month">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(nice * f)} y2={y(nice * f)} stroke="var(--line)" strokeDasharray={f === 0 ? undefined : "3 4"} />
            <text x={pad.l - 6} y={y(nice * f) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
              {Math.round(nice * f)}
            </text>
          </g>
        ))}
        {months.map((m, i) => {
          const x0 = pad.l + i * gw + (gw - bw * SERIES.length - 2 * (SERIES.length - 1)) / 2;
          return (
            <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * gw} y={pad.t} width={gw} height={H - pad.t - pad.b} fill={hover === i ? "var(--hover)" : "transparent"} rx="4" />
              {SERIES.map((s, j) => {
                const v = m[s.key];
                const top = y(v);
                return <rect key={s.key} x={x0 + j * (bw + 2)} y={top} width={bw} height={Math.max(0, H - pad.b - top)} rx="2" fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />;
              })}
              <text x={pad.l + i * gw + gw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {monthLabel(m.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Funnel({ f }: { f: PsfReport["funnel"] }) {
  const steps = [
    { label: "Applied", value: f.registered, color: "var(--info)" },
    { label: "Approved", value: f.approved, color: "var(--accent)" },
    { label: "Paid, members", value: f.paid, color: "var(--accent-text)" },
  ];
  const top = Math.max(1, f.registered);
  return (
    <div className="flex flex-col gap-4">
      {steps.map((s, i) => {
        const pct = (s.value / top) * 100;
        const conv = i === 0 ? null : steps[i - 1]!.value ? Math.round((s.value / steps[i - 1]!.value) * 100) : 0;
        return (
          <div key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="pms-num">
                <b>{num(s.value)}</b>
                {conv !== null ? <span className="ml-1.5 text-xs text-muted-foreground">{conv}% of the step before</span> : null}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-hover">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, s.value ? 3 : 0)}%`, background: s.color }} />
            </div>
          </div>
        );
      })}
      <p className="flex items-center gap-2 rounded bg-hover px-3 py-2 text-xs text-muted-foreground">
        <UserX size={14} aria-hidden /> {num(f.declined)} declined in the same set.
      </p>
    </div>
  );
}

function Bars({ slices, money = false }: { slices: PsfReportSlice[]; money?: boolean }) {
  const max = Math.max(1, ...slices.map((s) => s.count));
  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      {slices.map((s) => (
        <li key={s.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{s.label}</span>
            <span className="pms-num shrink-0 text-muted-foreground">
              <b className="text-foreground">{num(s.count)}</b>
              {money && s.amountRwf ? ` · ${rwfShort(s.amountRwf)}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-hover">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DistrictTable({ rows, onPick }: { rows: PsfDistrictRow[]; onPick: (id: number) => void }) {
  const maxMembers = Math.max(1, ...rows.map((r) => r.members));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3">District</th>
            <th className="px-3 py-3 text-right">Registered</th>
            <th className="px-3 py-3 text-right">Waiting</th>
            <th className="px-3 py-3 text-right">Approved</th>
            <th className="px-3 py-3 text-right">Declined</th>
            <th className="px-3 py-3">Members</th>
            <th className="px-3 py-3 text-right">Fees</th>
            <th className="px-3 py-3 text-right">Days to decide</th>
            <th className="px-5 py-3">District officer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.districtId} onClick={() => onPick(r.districtId)} className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-hover">
              <td className="px-5 py-3">
                <span className="flex items-center gap-2.5">
                  <span className="rounded bg-hover px-1.5 py-0.5 font-mono text-2xs font-bold">{r.letters}</span>
                  <span className="font-semibold">{r.name}</span>
                </span>
              </td>
              <td className="pms-num px-3 py-3 text-right">{num(r.registered)}</td>
              <td className="pms-num whitespace-nowrap px-3 py-3 text-right">
                {num(r.waiting)}
                {r.overdue ? <span className="ml-1.5 whitespace-nowrap rounded-full bg-bad-bg px-1.5 py-0.5 text-2xs font-bold text-bad">{r.overdue} late</span> : null}
              </td>
              <td className="pms-num px-3 py-3 text-right">{num(r.approved)}</td>
              <td className="pms-num px-3 py-3 text-right">{num(r.declined)}</td>
              <td className="px-3 py-3">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-hover">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.members / maxMembers) * 100}%` }} />
                  </span>
                  <span className="pms-num font-semibold">{num(r.members)}</span>
                </span>
              </td>
              <td className="pms-num px-3 py-3 text-right">{rwfShort(r.membershipFeesRwf)}</td>
              <td className="pms-num px-3 py-3 text-right">{r.medianDecisionDays === null ? "—" : r.medianDecisionDays.toFixed(1)}</td>
              <td className="px-5 py-3">
                {r.officers.length ? (
                  <span className="text-sm">{r.officers.join(", ")}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-2xs font-semibold text-warn">
                    <AlertTriangle size={11} aria-hidden /> No district officer
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-20 animate-pulse rounded bg-hover" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded bg-hover" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded bg-hover" />
    </div>
  );
}
