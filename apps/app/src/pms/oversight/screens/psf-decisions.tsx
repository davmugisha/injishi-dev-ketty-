"use client";

/**
 * The PSF console's Decisions (2026-10-19, rebuilt 2026-10-20): every
 * approval and decline in the officer's place, newest first, with who
 * decided, and how long it took.
 *
 * Search finds a business by name, code or docID; the filters narrow by
 * outcome and sector. A row opens the same detail panel as the queue, read
 * only, with the business's payments and history.
 *
 * A province officer reads the districts' decisions here as well as their own,
 * which is how a province sees that a district is declining for the wrong
 * reason.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronRight, Clock3, ScrollText, XCircle } from "lucide-react";

import type { PsfCatalogue, PsfDecisionItem } from "@injishi/contracts";
import { formatPrice } from "@injishi/utils";

import { LoadFailed } from "../../components/ui";
import { fetchPsfCatalogue } from "../../data/psf";
import { fetchPsfDecisions, type PsfDecisionFilter } from "../data/psf-console";
import { psfApplicationHref, shortDate } from "../components/psf-format";
import { PsfConsoleShell, usePsfConsole } from "../components/psf-console-shell";
import { PsfFilterBar, PsfFilterSelect, PsfSearch } from "../components/psf-filters";
import { cn } from "@/lib/utils";

export function PsfDecisions() {
  return (
    <PsfConsoleShell title="Decisions" lede="Approvals and declines, newest first">
      <DecisionsBody />
    </PsfConsoleShell>
  );
}

function DecisionsBody() {
  const { area, scope } = usePsfConsole();
  const [filter, setFilter] = useState<PsfDecisionFilter>({});
  const [catalogue, setCatalogue] = useState<PsfCatalogue | null>(null);
  const [items, setItems] = useState<PsfDecisionItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const setSel = (id: string) => router.push(psfApplicationHref(id, "decisions", params));

  useEffect(() => {
    void fetchPsfCatalogue().then((r) => r.outcome === "ok" && setCatalogue(r.data));
  }, []);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await fetchPsfDecisions(area, filter, null);
    if (res.outcome !== "ok") return setFailed(true);
    setItems(res.data.items);
    setNext(res.data.nextCursor);
  }, [area, filter]);
  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    const res = await fetchPsfDecisions(area, filter, next);
    setMore(false);
    if (res.outcome === "ok") {
      setItems((p) => [...(p ?? []), ...res.data.items]);
      setNext(res.data.nextCursor);
    }
  };

  const set = useCallback(<K extends keyof PsfDecisionFilter>(k: K, v: string) => {
    setFilter((f) => {
      const n = { ...f };
      if (!v) delete n[k];
      else n[k] = v as PsfDecisionFilter[K];
      return n;
    });
  }, []);
  const setQ = useCallback((q: string) => set("q", q.trim()), [set]);

  const showDistrict = scope ? scope.level !== "district" && !area.district : false;
  const filtered = Boolean(filter.q || filter.cluster || filter.outcome);
  const clusters = useMemo(() => (catalogue?.clusters ?? []).map((c) => ({ value: c.code, label: c.nameEn })), [catalogue]);
  const shown = items ?? [];
  const approved = shown.filter((d) => d.outcome === "approved").length;

  return (
    <div className="flex flex-col gap-5">
      <PsfFilterBar active={filtered} onClear={() => setFilter({})}>
        <PsfSearch value={filter.q ?? ""} onChange={setQ} placeholder="Search a business, code or docID" />
        <div className="flex flex-wrap gap-2">
          <PsfFilterSelect
            label="Decision"
            value={filter.outcome ?? ""}
            options={[
              { value: "approved", label: "Approved" },
              { value: "declined", label: "Declined" },
            ]}
            onChange={(v) => set("outcome", v)}
          />
          <PsfFilterSelect label="Sector" value={filter.cluster ?? ""} options={clusters} onChange={(v) => set("cluster", v)} />
        </div>
      </PsfFilterBar>

      {failed ? (
        <LoadFailed onRetry={() => void load()}>We couldn&apos;t load the decisions.</LoadFailed>
      ) : items === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-hover" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded border border-dashed border-line bg-card px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-hover text-muted-foreground">
            <ScrollText size={22} aria-hidden />
          </span>
          <p className="text-base font-semibold">{filtered ? "Nothing matches" : "No decisions here yet"}</p>
          <p className="max-w-[44ch] text-sm text-muted-foreground">
            {filtered ? "No decision here matches these filters." : "Approvals and declines appear here the moment an officer makes them."}
          </p>
        </div>
      ) : (
        <>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span>
              <span className="pms-num font-bold text-foreground">{shown.length}</span>
              {next ? "+" : ""} shown
            </span>
            <span>
              <span className="pms-num font-semibold text-ok">{approved}</span> approved ·{" "}
              <span className="pms-num font-semibold text-bad">{shown.length - approved}</span> declined
            </span>
          </p>
          <div className="overflow-x-auto rounded border border-line bg-card shadow-sm">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-hover/60 text-left text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Business</th>
                  {showDistrict ? <th className="px-3 py-2.5">District</th> : null}
                  <th className="px-3 py-2.5">Decision</th>
                  <th className="px-3 py-2.5">Membership</th>
                  <th className="px-3 py-2.5 text-right">Took</th>
                  <th className="px-3 py-2.5">Decided by</th>
                  <th className="px-3 py-2.5 text-right">When</th>
                  <th className="w-8 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((d) => (
                  <tr
                    key={d.applicationId}
                    tabIndex={0}
                    onClick={() => setSel(d.applicationId)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(d.applicationId))}
                    className="group cursor-pointer transition-colors hover:bg-hover/70 focus-visible:bg-hover focus-visible:outline-none"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{d.businessName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[d.docId, d.subsectorName ?? d.clusterName].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    {showDistrict ? <td className="px-3 py-3 text-xs">{d.districtName ?? "—"}</td> : null}
                    <td className="px-3 py-3">
                      {d.outcome === "approved" ? (
                        <span className="inline-flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-ok">
                            <CheckCircle2 size={14} aria-hidden /> Approved
                          </span>
                          <span className={cn("text-xs", d.paid ? "text-muted-foreground" : "text-warn")}>{d.paid ? "A member" : "Waiting for payment"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-bad">
                            <XCircle size={14} aria-hidden /> Declined
                          </span>
                          <span className="text-xs text-muted-foreground">{d.declineReasonLabel}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs font-medium">{d.tierName}</p>
                      {d.outcome === "approved" ? (
                        <p className="pms-num text-xs text-muted-foreground">
                          {[d.membershipNumber, d.feeRwf !== null ? formatPrice(d.feeRwf) : null].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="pms-num px-3 py-3 text-right text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} aria-hidden className="text-faint" />
                        {d.daysToDecide === null ? "—" : `${d.daysToDecide.toFixed(1)} d`}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">{d.decidedByName ?? "—"}</td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground">{shortDate(d.decidedAt)}</td>
                    <td className="pr-3">
                      <ChevronRight size={15} aria-hidden className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {next ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={more}
          className="self-center rounded border border-input bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-hover disabled:opacity-50"
        >
          {more ? "Loading" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
