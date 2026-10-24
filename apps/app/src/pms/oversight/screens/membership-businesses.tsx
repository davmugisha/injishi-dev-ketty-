"use client";

/**
 * The PSF Membership console's register of businesses (the PSF path).
 *
 * Every business in the officer's region that PSF can see: those registered
 * through Injishi's PSF path, and the hotels, which PSF files under Services. A
 * district officer reads their district, a country officer the whole country;
 * the region is a boundary the server holds, not a filter on this page.
 *
 * It opens on the region at a glance (how many are registered, how many are
 * members, how many wait on PSF, and what was paid this year), then counts by
 * sector, by owner group and, for a region wider than one district, by
 * district. Every count is also a filter. Under it, the list: a business's code,
 * its sector, who owns it, and where it stands with PSF. A business with an
 * application open opens that application, where it can be decided.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Banknote, Building2, Download, Hourglass, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  ENTERPRISE_REGISTRATION_KIND_LABEL,
  PSF_OWNER_GROUP_SHORT,
  PSF_STANDING_LABEL,
  PsfOwnerGroup,
  PsfStanding,
  type PsfBusinessRow,
  type PsfBusinessesQuery,
  type PsfCatalogue,
  type PsfRegisterSummary,
  type PsfTier,
} from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";

import { LoadFailed } from "../../components/ui";
import { fetchPsfBusinesses, fetchPsfCatalogue, fetchPsfTiers } from "../../data/psf";
import type { QueuedToast } from "../../lib/toast-queue";
import { ActionButton, Badge, EmptyState, Skeleton, surfaceClass } from "../components/ui";
import { PsfConsoleShell, usePsfConsole } from "../components/psf-console-shell";
import { fetchPsfSummaryIn } from "../data/psf-console";
import { psfBusinessHref, shortDate } from "../components/psf-format";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 w-full min-w-0 rounded border border-line2 bg-field px-2 text-sm text-foreground disabled:opacity-50";

export const STANDING_INTENT: Record<PsfStanding, "ok" | "warn" | "info" | "bad" | "neutral"> = {
  member: "ok",
  awaiting_payment: "warn",
  applied: "info",
  declined: "bad",
  lapsed: "neutral",
  not_applied: "neutral",
};

type Filters = Omit<PsfBusinessesQuery, "cursor">;

export function MembershipBusinesses() {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  return (
    <PsfConsoleShell title="Businesses" lede="Every business registered in your place" toasts={toasts}>
      <RegisterBody push={(t) => setToasts((x) => [...x, t])} />
    </PsfConsoleShell>
  );
}

function RegisterBody({ push }: { push: (t: QueuedToast) => void }) {
  const { area } = usePsfConsole();
  const [summary, setSummary] = useState<PsfRegisterSummary | null>(null);
  const [catalogue, setCatalogue] = useState<PsfCatalogue | null>(null);
  const [tiers, setTiers] = useState<PsfTier[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PsfBusinessRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const openBusiness = (orgId: string) => router.push(psfBusinessHref(orgId, params));
  const request = useRef(0);

  const toast = useCallback(
    (txt: string, intent: QueuedToast["intent"] = "ok") => push({ id: Date.now() + Math.random(), txt, intent }),
    [push],
  );
  // The console's place switcher narrows the register like any other filter.
  const scoped = useCallback(
    (f: Filters & { cursor?: string }) => ({ ...f, district: f.district ?? area.district, province: area.district ? undefined : area.province }),
    [area],
  );

  const loadSummary = useCallback(async () => {
    const res = await fetchPsfSummaryIn(area);
    if (res.outcome === "ok") setSummary(res.data);
  }, [area]);

  useEffect(() => {
    void loadSummary();
    void fetchPsfCatalogue().then((res) => res.outcome === "ok" && setCatalogue(res.data));
    void fetchPsfTiers().then((res) => res.outcome === "ok" && setTiers(res.data));
  }, [loadSummary]);

  // The search box writes the filter a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: search.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const mine = ++request.current;
    setLoadFailed(false);
    setRows(null);
    const res = await fetchPsfBusinesses(scoped(filters));
    if (mine !== request.current) return;
    if (res.outcome !== "ok") {
      setLoadFailed(true);
      return;
    }
    setRows(res.data.items);
    setTotal(res.data.total);
    setNextCursor(res.data.nextCursor);
  }, [filters, scoped]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const res = await fetchPsfBusinesses(scoped({ ...filters, cursor: nextCursor }));
    setLoadingMore(false);
    if (res.outcome !== "ok") {
      toast("We couldn't load more businesses. Try again.", "bad");
      return;
    }
    setRows((prev) => [...(prev ?? []), ...res.data.items]);
    setNextCursor(res.data.nextCursor);
  };

  /** Every page of the current filter, as a CSV the officer can open in a spreadsheet. */
  const exportCsv = async () => {
    setExporting(true);
    const all: PsfBusinessRow[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 100; page += 1) {
      const res = await fetchPsfBusinesses(scoped({ ...filters, cursor }));
      if (res.outcome !== "ok") {
        setExporting(false);
        toast("We couldn't build the download. Try again.", "bad");
        return;
      }
      all.push(...res.data.items);
      if (!res.data.nextCursor) break;
      cursor = res.data.nextCursor;
    }
    setExporting(false);
    downloadCsv(all, summary?.regionLabel ?? "region");
  };

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggle = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));

  const clusters = catalogue?.clusters ?? [];
  const associations = useMemo(
    () => (filters.cluster ? (clusters.find((c) => c.code === filters.cluster)?.associations ?? []) : clusters.flatMap((c) => c.associations)),
    [clusters, filters.cluster],
  );
  const manyDistricts = (summary?.byDistrict.length ?? 0) > 1;
  const active = activeFilters(filters, { clusters, tiers, summary });

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* ── The region at a glance ───────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">Your region</p>
            <h2 className="pms-display text-xl font-bold text-ink">{summary?.regionLabel ?? "Loading"}</h2>
          </div>
          <ActionButton onClick={() => void exportCsv()} disabled={exporting || total === 0}>
            <Download aria-hidden="true" className="mr-1.5 size-4" />
            {exporting ? "Preparing" : "Download CSV"}
          </ActionButton>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Kpi icon={Building2} label="Registered businesses" value={summary?.total} />
          <Kpi icon={BadgeCheck} label="PSF members" value={summary?.members} tone="ok" onPress={() => toggle("standing", "member")} active={filters.standing === "member"} />
          <Kpi icon={Hourglass} label="Waiting on PSF" value={summary?.waiting} tone="info" onPress={() => toggle("standing", "applied")} active={filters.standing === "applied"} />
          <Kpi icon={Banknote} label="Fees paid this year" value={summary ? formatPrice(summary.paidThisYearRwf) : undefined} tone="accent" />
        </div>

        <div className={cn("grid gap-2.5", manyDistricts ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          <Breakdown
            title="By sector"
            rows={(summary?.byCluster ?? []).map((c) => ({ key: c.key, label: c.label, count: c.count }))}
            activeKey={filters.cluster}
            onPick={(key) => setFilters((f) => ({ ...f, cluster: f.cluster === key ? undefined : key, association: undefined }))}
          />
          <Breakdown
            title="Owned by (Specialized)"
            rows={PsfOwnerGroup.options.map((g) => ({
              key: g,
              label: PSF_OWNER_GROUP_SHORT[g] === "PWD" ? "People with disabilities" : PSF_OWNER_GROUP_SHORT[g],
              count: summary?.byGroup.find((x) => x.key === g)?.count ?? 0,
            }))}
            activeKey={filters.group}
            onPick={(key) => toggle("group", key as Filters["group"])}
          />
          {manyDistricts && (
            <Breakdown
              title="By district"
              rows={(summary?.byDistrict ?? []).map((d) => ({ key: d.key, label: d.label, count: d.count, tag: d.letters }))}
              activeKey={filters.district !== undefined ? String(filters.district) : undefined}
              onPick={(key) => toggle("district", Number(key))}
            />
          )}
        </div>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <section className={cn(surfaceClass, "flex flex-col gap-3 p-3.5")}>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(0,1fr))]">
            <label className="relative">
              <span className="sr-only">Search by name, code or TIN</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Name, code or TIN" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <select
              aria-label="Sector"
              className={selectClass}
              value={filters.cluster ?? ""}
              onChange={(e) => set({ cluster: e.target.value || undefined, association: undefined })}
            >
              <option value="">Every sector</option>
              {clusters.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nameEn}
                </option>
              ))}
            </select>
            <select
              aria-label="Association"
              className={selectClass}
              value={filters.association ?? ""}
              onChange={(e) => set({ association: e.target.value || undefined })}
            >
              <option value="">Every association</option>
              {associations.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.acronym ? `${a.acronym} · ${a.nameEn}` : a.nameEn}
                </option>
              ))}
            </select>
            <select
              aria-label="Standing with PSF"
              className={selectClass}
              value={filters.standing ?? ""}
              onChange={(e) => set({ standing: (e.target.value || undefined) as Filters["standing"] })}
            >
              <option value="">Any standing</option>
              {PsfStanding.options.map((s) => (
                <option key={s} value={s}>
                  {PSF_STANDING_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              aria-label="Membership"
              className={selectClass}
              value={filters.tier ?? ""}
              onChange={(e) => set({ tier: e.target.value || undefined })}
            >
              <option value="">Any membership</option>
              {tiers.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.nameEn}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segment
              label="TIN"
              value={filters.tin}
              options={[
                { value: "with", label: "With TIN" },
                { value: "without", label: "No TIN" },
              ]}
              onChange={(v) => set({ tin: v as Filters["tin"] })}
            />
            <Segment
              label="Kind"
              value={filters.kind}
              options={[
                { value: "enterprise", label: "Registered for PSF" },
                { value: "hospitality", label: "Hotels" },
              ]}
              onChange={(v) => set({ kind: v as Filters["kind"] })}
            />
            {active.length > 0 && (
              <button
                type="button"
                className="ml-auto cursor-pointer text-xs font-semibold text-accent-text"
                onClick={() => {
                  setSearch("");
                  setFilters({});
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
          {active.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {active.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    if (a.key === "q") setSearch("");
                    setFilters((f) => ({ ...f, [a.key]: undefined, ...(a.key === "cluster" ? { association: undefined } : {}) }));
                  }}
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-accent-text/40 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-text"
                >
                  {a.label}
                  <X aria-hidden="true" className="size-3" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── The list ─────────────────────────────────────────────── */}
        {loadFailed ? (
          <LoadFailed onRetry={() => void load()}>We couldn&apos;t load the businesses.</LoadFailed>
        ) : rows === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton height={64} />
            <Skeleton height={64} delay={80} />
            <Skeleton height={64} delay={160} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState>
            {active.length > 0
              ? "No business in your region matches these filters. Clear one to see more."
              : "No business in your region has registered yet. They appear here the moment their payment goes through."}
          </EmptyState>
        ) : (
          <section className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Showing <span className="pms-num font-semibold text-ink">{rows.length}</span> of{" "}
              <span className="pms-num font-semibold text-ink">{total}</span>
            </p>
            <div className={cn(surfaceClass, "overflow-hidden")}>
              <div className="hidden grid-cols-[88px_minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_100px] gap-3 border-b border-line bg-hover/50 px-4 py-2.5 text-2xs font-bold tracking-wide text-muted-foreground uppercase lg:grid">
                <span>Code</span>
                <span>Business</span>
                <span>Where</span>
                <span>Owners</span>
                <span>With PSF</span>
                <span className="text-right">Paid</span>
                <span className="text-right">Registered</span>
              </div>
              <ul className="divide-y divide-line">
                {rows.map((b) => (
                  <BusinessRow key={b.orgId} business={b} onOpen={() => openBusiness(b.orgId)} />
                ))}
              </ul>
            </div>
            {nextCursor && (
              <ActionButton className="self-start" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? "Loading" : "Load more"}
              </ActionButton>
            )}
          </section>
        )}
      </div>

    </>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

const KPI_TONE = {
  neutral: "bg-hover text-ink2",
  ok: "bg-ok-bg text-ok",
  info: "bg-info-bg text-info",
  accent: "bg-accent-soft text-accent-text",
} as const;

function Kpi({
  icon: IconCmp,
  label,
  value,
  tone = "neutral",
  onPress,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string | undefined;
  tone?: keyof typeof KPI_TONE;
  onPress?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", KPI_TONE[tone])}>
        <IconCmp className="size-5" strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="pms-num truncate text-xl leading-tight font-bold text-ink">{value ?? "—"}</span>
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </>
  );
  const shell = cn(
    "flex min-w-0 items-center gap-3 rounded-card border px-3.5 py-3 text-left",
    active ? "border-accent-text bg-accent-soft" : "border-card-bd bg-card",
  );
  return onPress ? (
    <button type="button" aria-pressed={active} onClick={onPress} className={cn(shell, "cursor-pointer transition-colors hover:bg-hover")}>
      {body}
    </button>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/** Counts under one heading, each a filter, drawn as bars against the largest. */
function Breakdown({
  title,
  rows,
  activeKey,
  onPick,
}: {
  title: string;
  rows: { key: string; label: string; count: number; tag?: string }[];
  activeKey: string | undefined;
  onPick: (key: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className={cn(surfaceClass, "flex flex-col gap-2 p-3.5")}>
      <h3 className="text-2xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => {
            const on = activeKey === r.key;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(r.key)}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded px-2 py-1.5 text-left text-sm",
                    on ? "bg-accent-soft text-accent-text" : "text-ink2 hover:bg-hover",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("absolute inset-y-0 left-0 rounded", on ? "bg-accent-text/15" : "bg-accent-soft/70")}
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                  {r.tag && <span className="pms-num relative w-9 shrink-0 text-xs font-bold text-muted-foreground">{r.tag}</span>}
                  <span className="relative min-w-0 grow truncate font-medium">{r.label}</span>
                  <span className="pms-num relative shrink-0 font-bold">{r.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Segment({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border border-line2 bg-field p-0.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? undefined : o.value)}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              on ? "bg-accent-soft text-accent-text" : "text-muted-foreground hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function BusinessRow({ business: b, onOpen }: { business: PsfBusinessRow; onOpen?: () => void }) {
  const content = (
    <>
      <span className="pms-num text-xs font-bold text-accent-text">{b.businessCode ?? "—"}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{b.legalName}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[b.associationAcronym ?? b.associationName, b.clusterName].filter(Boolean).join(" · ") || "Sector not given"}
          {!b.hasTin && b.domain === "enterprise" && (
            <> · {b.registrationKind === "none" || !b.registrationKind ? "No TIN" : ENTERPRISE_REGISTRATION_KIND_LABEL[b.registrationKind].split(",")[0]}</>
          )}
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 text-xs">
        <span className="truncate text-ink2">{[b.sectorName, b.districtName].filter(Boolean).join(", ") || "Not recorded"}</span>
        {/* Where else it trades (2026-10-23); and when only a branch is here, say so. */}
        {b.branchCount > 0 ? (
          <span className="truncate text-muted-foreground">
            {b.branchCount === 1 ? "+1 branch" : `+${b.branchCount} branches`}
          </span>
        ) : null}
        {!b.headOfficeInScope ? (
          <Badge intent="accent" className="self-start">
            Branch in your area
          </Badge>
        ) : null}
      </span>
      <span className="flex flex-wrap gap-1">
        {b.ownerGroups.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          b.ownerGroups.map((g) => (
            <Badge key={g} intent="accent">
              {PSF_OWNER_GROUP_SHORT[g]}
            </Badge>
          ))
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <Badge intent={STANDING_INTENT[b.standing]} className="self-start">
          {PSF_STANDING_LABEL[b.standing]}
        </Badge>
        {(b.tierName || b.expiresOn) && (
          <span className="truncate text-xs text-muted-foreground">
            {[b.tierName, b.expiresOn ? `until ${shortDate(`${b.expiresOn}T12:00:00Z`)}` : null].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <span className="text-xs lg:text-right">
        {b.paidRwf > 0 ? (
          <>
            <span className="pms-num block font-semibold text-ink">{formatPrice(b.paidRwf)}</span>
            {b.lastPaidAt ? <span className="block text-muted-foreground">last {shortDate(b.lastPaidAt)}</span> : null}
          </>
        ) : (
          <span className="text-muted-foreground">Nothing yet</span>
        )}
      </span>
      <span className="text-xs text-muted-foreground lg:text-right">{shortDate(b.registeredAt)}</span>
    </>
  );
  const grid =
    "grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-4 py-3 lg:grid-cols-[88px_minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_100px]";
  return (
    <li>
      {onOpen ? (
        <button type="button" onClick={onOpen} className={cn(grid, "w-full cursor-pointer text-left hover:bg-hover")} title="Open the business: payments, applications, memberships">
          {content}
        </button>
      ) : (
        <div className={grid}>{content}</div>
      )}
    </li>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function activeFilters(
  f: Filters,
  ctx: { clusters: PsfCatalogue["clusters"]; tiers: PsfTier[]; summary: PsfRegisterSummary | null },
): { key: keyof Filters; label: string }[] {
  const out: { key: keyof Filters; label: string }[] = [];
  if (f.q) out.push({ key: "q", label: `“${f.q}”` });
  if (f.cluster) out.push({ key: "cluster", label: ctx.clusters.find((c) => c.code === f.cluster)?.nameEn ?? f.cluster });
  if (f.association) {
    const a = ctx.clusters.flatMap((c) => c.associations).find((x) => x.code === f.association);
    out.push({ key: "association", label: a?.acronym ?? a?.nameEn ?? f.association });
  }
  if (f.standing) out.push({ key: "standing", label: PSF_STANDING_LABEL[f.standing] });
  if (f.tier) out.push({ key: "tier", label: ctx.tiers.find((t) => t.code === f.tier)?.nameEn ?? f.tier });
  if (f.group) out.push({ key: "group", label: `${PSF_OWNER_GROUP_SHORT[f.group]} owned` });
  if (f.tin) out.push({ key: "tin", label: f.tin === "with" ? "With TIN" : "No TIN" });
  if (f.kind) out.push({ key: "kind", label: f.kind === "enterprise" ? "Registered for PSF" : "Hotels" });
  if (f.district !== undefined) {
    out.push({ key: "district", label: ctx.summary?.byDistrict.find((d) => d.key === String(f.district))?.label ?? "District" });
  }
  return out;
}

function downloadCsv(rows: PsfBusinessRow[], region: string) {
  const header = [
    "Code", "Business", "Kind", "Sector", "Association", "District", "Sector (place)", "Owners",
    "TIN", "Standing", "Membership", "Membership number", "Valid until", "Paid (RWF)", "Last paid", "Registered",
  ];
  const cell = (v: string | null | undefined) => {
    const s = v ?? "";
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((b) =>
    [
      b.businessCode, b.legalName, b.domain === "enterprise" ? "Registered for PSF" : "Hotel", b.clusterName, b.associationName,
      b.districtName, b.sectorName, b.ownerGroups.map((g) => PSF_OWNER_GROUP_SHORT[g]).join(" "),
      b.hasTin ? "Yes" : "No", PSF_STANDING_LABEL[b.standing], b.tierName, b.membershipNumber, b.expiresOn, String(b.paidRwf), b.lastPaidAt?.slice(0, 10), b.registeredAt.slice(0, 10),
    ]
      .map(cell)
      .join(","),
  );
  const blob = new Blob([`﻿${[header.join(","), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `psf-businesses-${region.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
