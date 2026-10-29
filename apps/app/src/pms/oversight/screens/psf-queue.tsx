"use client";

/**
 * The PSF console's Queue (2026-10-19, rebuilt 2026-10-20): what waits on PSF
 * in the officer's place.
 *
 * Newest first by default, because what just arrived is what an officer looks
 * for; "Longest waiting" puts the overdue ones on top instead, and every row
 * past `PSF_OVERDUE_DAYS` says so whatever the order. Search finds a business
 * by name, business code or docID, and the filters narrow by sector,
 * membership and owner group. The console's place switcher narrows by
 * district.
 *
 * Every application here is paid (PSF reviews only paid applications), so the
 * amount column is money already held, not money asked for.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronRight, Inbox, Wallet } from "lucide-react";

import {
  PSF_FAMILY_LABEL,
  PSF_OFFERED_FAMILIES,
  PSF_OVERDUE_DAYS,
  PSF_OWNER_GROUP_SHORT,
  PsfOwnerGroup,
  type PsfCatalogue,
  type PsfMembershipFamily,
  type PsfQueueItem,
} from "@injishi/contracts";
import { formatPrice } from "@injishi/utils";

import { LoadFailed } from "../../components/ui";
import { fetchPsfCatalogue } from "../../data/psf";
import type { QueuedToast } from "../../lib/toast-queue";
import { fetchPsfQueueIn, type PsfQueueFilter } from "../data/psf-console";
import { psfApplicationHref, shortDate } from "../components/psf-format";
import { PsfConsoleShell, usePsfConsole } from "../components/psf-console-shell";
import { PsfFilterBar, PsfFilterSelect, PsfSearch } from "../components/psf-filters";
import { cn } from "@/lib/utils";

const SORT_LABEL: Record<PsfQueueFilter["sort"], string> = {
  newest: "Newest first",
  oldest: "Longest waiting",
  amount: "Highest fee",
};

const EMPTY_FILTER: PsfQueueFilter = { sort: "newest" };

export function PsfQueue() {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const toast = useCallback((txt: string, intent: QueuedToast["intent"] = "ok") => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), txt, intent }]);
  }, []);
  return (
    <PsfConsoleShell title="Queue" lede="Paid applications waiting on PSF" toasts={toasts}>
      <QueueBody toast={toast} />
    </PsfConsoleShell>
  );
}

function QueueBody({ toast }: { toast: (txt: string, intent?: QueuedToast["intent"]) => void }) {
  const { area, scope } = usePsfConsole();
  const [filter, setFilter] = useState<PsfQueueFilter>(EMPTY_FILTER);
  const [catalogue, setCatalogue] = useState<PsfCatalogue | null>(null);
  const [items, setItems] = useState<PsfQueueItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const open = (id: string) => router.push(psfApplicationHref(id, "queue", params));

  useEffect(() => {
    void fetchPsfCatalogue().then((r) => r.outcome === "ok" && setCatalogue(r.data));
  }, []);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await fetchPsfQueueIn(area, filter, null);
    if (res.outcome !== "ok") return setFailed(true);
    setItems(res.data.items);
    setTotal(res.data.total);
    setNext(res.data.nextCursor);
  }, [area, filter]);
  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    const res = await fetchPsfQueueIn(area, filter, next);
    setMore(false);
    if (res.outcome !== "ok") return toast("We couldn't load more applications. Try again.", "bad");
    setItems((prev) => [...(prev ?? []), ...res.data.items]);
    setNext(res.data.nextCursor);
  };

  const set = useCallback(<K extends keyof PsfQueueFilter>(k: K, v: PsfQueueFilter[K] | "") => {
    setFilter((f) => {
      const n = { ...f };
      if (v === "" || v === undefined) delete n[k];
      else n[k] = v as PsfQueueFilter[K];
      return n;
    });
  }, []);
  const setQ = useCallback((q: string) => set("q", q.trim()), [set]);

  const showDistrict = scope ? scope.level !== "district" && !area.district : false;
  const filtered = Boolean(filter.q || filter.cluster || filter.family || filter.group);
  const shown = items ?? [];
  const overdue = shown.filter((i) => i.waitingDays > PSF_OVERDUE_DAYS).length;
  const held = shown.reduce((sum, i) => sum + (i.paidRwf ?? 0), 0);
  const clusters = useMemo(() => (catalogue?.clusters ?? []).map((c) => ({ value: c.code, label: c.nameEn })), [catalogue]);

  return (
    <div className="flex flex-col gap-5">
      {/* Only District Managers decide (2026-10-23); this post reads the queue to report on it. */}
      {scope && scope.level !== "district" ? (
        <p className="rounded border border-line bg-hover/60 px-4 py-3 text-sm text-ink">
          For reporting: each application is approved or declined by the PSF District Manager of its district.
        </p>
      ) : null}
      <PsfFilterBar active={filtered || filter.sort !== "newest"} onClear={() => setFilter(EMPTY_FILTER)}>
        <PsfSearch value={filter.q ?? ""} onChange={setQ} placeholder="Search a business, code or docID" />
        <div className="flex flex-wrap gap-2">
          <PsfFilterSelect label="Sector" value={filter.cluster ?? ""} options={clusters} onChange={(v) => set("cluster", v)} />
          <PsfFilterSelect
            label="Membership"
            value={filter.family ?? ""}
            options={PSF_OFFERED_FAMILIES.map((f) => ({ value: f, label: PSF_FAMILY_LABEL[f] }))}
            onChange={(v) => set("family", v as PsfMembershipFamily)}
          />
          <PsfFilterSelect
            label="Owned by"
            value={filter.group ?? ""}
            options={PsfOwnerGroup.options.map((g) => ({ value: g, label: PSF_OWNER_GROUP_SHORT[g] }))}
            onChange={(v) => set("group", v as PsfOwnerGroup)}
            allLabel="Anyone"
          />
          <PsfFilterSelect
            label="Order"
            value={filter.sort === "newest" ? "" : filter.sort}
            options={(["oldest", "amount"] as const).map((s) => ({ value: s, label: SORT_LABEL[s] }))}
            onChange={(v) => set("sort", (v || "newest") as PsfQueueFilter["sort"])}
            allLabel={SORT_LABEL.newest}
          />
        </div>
      </PsfFilterBar>

      {failed ? (
        <LoadFailed onRetry={() => void load()}>We couldn&apos;t load the queue.</LoadFailed>
      ) : items === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-hover" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <p>
              <span className="pms-num font-bold">{total}</span>{" "}
              <span className="text-muted-foreground">{total === 1 ? "application" : "applications"} waiting{filtered ? " that match" : ""}</span>
            </p>
            {overdue > 0 ? (
              <p className="inline-flex items-center gap-1.5 font-semibold text-bad">
                <AlertTriangle size={14} aria-hidden /> {overdue} past {PSF_OVERDUE_DAYS} days
              </p>
            ) : null}
            {held > 0 ? (
              <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Wallet size={14} aria-hidden /> <span className="pms-num font-semibold text-foreground">{formatPrice(held)}</span> held for PSF
              </p>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded border border-dashed border-line bg-card px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-ok-bg text-ok">
                <Inbox size={22} aria-hidden />
              </span>
              <p className="text-base font-semibold">{filtered ? "Nothing matches" : "Nothing is waiting"}</p>
              <p className="max-w-[44ch] text-sm text-muted-foreground">
                {filtered
                  ? "No application waiting here matches these filters. Clear them to see the whole queue."
                  : "Every application here has been decided. New ones arrive the moment a business pays on the public form."}
              </p>
            </div>
          ) : (
            <QueueTable items={items} showDistrict={showDistrict} onOpen={open} />
          )}

          {next ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={more}
              className="self-center rounded border border-input bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-hover disabled:opacity-50"
            >
              {more ? "Loading" : `Show more (${total - items.length} left)`}
            </button>
          ) : null}
        </>
      )}

    </div>
  );
}

/** How long a row has waited, in the words an officer reads at a glance. */
function Waiting({ days }: { days: number }) {
  const late = days > PSF_OVERDUE_DAYS;
  return (
    <span
      className={cn(
        "pms-num inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        late ? "bg-bad-bg text-bad" : days === 0 ? "bg-ok-bg text-ok" : "bg-hover text-foreground",
      )}
      title={`Waiting ${days} day${days === 1 ? "" : "s"}`}
    >
      {late ? <AlertTriangle size={11} aria-hidden /> : null}
      {days === 0 ? "New today" : `${days} day${days === 1 ? "" : "s"}`}
    </span>
  );
}

const COLS = "lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_6.5rem_1rem]";
const COLS_DISTRICT = "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1fr)_6.5rem_1rem]";

function QueueTable({ items, showDistrict, onOpen }: { items: PsfQueueItem[]; showDistrict: boolean; onOpen: (id: string) => void }) {
  const cols = showDistrict ? COLS_DISTRICT : COLS;
  return (
    <div className="overflow-hidden rounded border border-line bg-card shadow-sm">
      <div className={cn("hidden gap-4 border-b border-line bg-hover/60 px-4 py-2.5 text-2xs font-bold uppercase tracking-wide text-muted-foreground lg:grid", cols)}>
        <span>Business</span>
        <span>Sector</span>
        {showDistrict ? <span>District</span> : null}
        <span>Membership</span>
        <span className="text-right">Paid</span>
        <span>Waiting</span>
        <span />
      </div>
      <ul className="flex list-none flex-col divide-y divide-line p-0">
        {items.map((item) => (
          <li key={item.applicationId}>
            <button
              type="button"
              onClick={() => onOpen(item.applicationId)}
              className={cn(
                "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-hover/70 focus-visible:bg-hover focus-visible:outline-none lg:gap-y-0",
                cols,
              )}
            >
              {/* Business */}
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{item.businessName}</span>
                  {item.decidesHere && !item.canDecide ? <span className="shrink-0 rounded-full bg-warn-bg px-2 py-0.5 text-2xs font-semibold text-warn">Your business</span> : null}
                  {/* Here for its branches in this region; the head office's district decides the business. */}
                  {item.branchesPending > 0 ? (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-semibold text-accent-text">
                      {item.headOfficeInScope ? "" : "Branch only · "}
                      {item.branchesPending === 1 ? "1 branch to admit" : `${item.branchesPending} branches to admit`}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {item.docId ? <span className="pms-num font-mono font-semibold text-foreground">{item.docId}</span> : null}
                  {item.businessCode ? <span className="pms-num font-mono">{item.businessCode}</span> : null}
                  <span>sent {shortDate(item.submittedAt)}</span>
                </span>
              </span>

              {/* Waiting, on a phone it sits beside the name */}
              <span className="lg:hidden">
                <Waiting days={item.waitingDays} />
              </span>

              {/* Sector */}
              <span className="col-span-2 min-w-0 text-xs lg:col-span-1">
                <span className="block truncate font-medium text-foreground">{item.subsectorName ?? item.clusterName ?? "—"}</span>
                <span className="block truncate text-muted-foreground">
                  {[item.subsectorName ? item.clusterName : null, item.associationName].filter(Boolean).join(" · ") || " "}
                </span>
              </span>

              {showDistrict ? <span className="col-span-2 truncate text-xs text-foreground lg:col-span-1">{item.districtName ?? "—"}</span> : null}

              {/* Membership */}
              <span className="col-span-2 min-w-0 text-xs lg:col-span-1">
                <span className="block truncate font-medium text-foreground">{item.requestedTierName}</span>
                {item.ownerGroups.length ? (
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {item.ownerGroups.map((g) => (
                      <span key={g} className="rounded-full bg-accent-soft px-1.5 py-px text-2xs font-semibold text-accent-text">
                        {PSF_OWNER_GROUP_SHORT[g]}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>

              {/* Paid */}
              <span className="col-span-2 text-xs lg:col-span-1 lg:text-right">
                {item.paidRwf !== null ? (
                  <span className="pms-num font-semibold text-ink">{formatPrice(item.paidRwf)}</span>
                ) : item.declaredFeeRwf !== null ? (
                  <span className="pms-num text-muted-foreground">{formatPrice(item.declaredFeeRwf)} due</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>

              <span className="hidden lg:block">
                <Waiting days={item.waitingDays} />
              </span>
              <ChevronRight
                size={16}
                aria-hidden
                className="hidden shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text lg:block"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
