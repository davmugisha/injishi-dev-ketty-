import type {
  AdminAdapterHealth,
  AdminDistrictDensity,
  AdminKpi,
  AdminQueueHealth,
  AdminRevenueLine,
  AdminWorkQueueItem,
} from "@injishi/contracts";

import type {
  AdapterStatus,
  DistrictDensity,
  DistrictKey,
  Kpi,
  RevenueLine,
  WorkQueueItem,
} from "@/lib/types";

import { EMPTY, count, detail, money, movement, rate } from "./format";

/**
 * The overview screen's mapping (F-A02 / F-A09).
 *
 * The API sends facts and no colours. This file is where a number becomes a
 * sentence and a status becomes a tint, and it is the ONLY place either
 * happens for this screen.
 */

/* ---------- KPIs ---------- */

/**
 * The headline figures.
 *
 * No colour on the movement badges, and that is deliberate. `AdminKpi` carries
 * `value`, `unit` and `previousValue`, and nothing that says whether up is
 * good — so a rise is shown with its direction and left neutral. Painting a
 * climbing "failed EBM emissions" green because it rose is worse than painting
 * nothing. The fix, when it is wanted, is a polarity field on the contract, not
 * a table of key names guessed at in the browser.
 */
export function presentKpis(kpis: AdminKpi[]): Kpi[] {
  return kpis.map((kpi) => {
    const badge = movement(kpi.value, kpi.previousValue, "none");
    return {
      label: kpi.label,
      value: kpiValue(kpi),
      // `empty` drives the "no data yet" treatment. A null value is a true
      // statement about a platform with no rows, not a rendering failure.
      empty: kpi.value === null,
      ...(badge ? { noteBadge: badge } : {}),
    };
  });
}

function kpiValue(kpi: AdminKpi): string {
  if (kpi.value === null) return EMPTY;
  switch (kpi.unit) {
    case "rwf":
      // The unit itself names the currency; there is no separate tag on a KPI.
      return money(kpi.value, "RWF");
    case "percent":
      return `${kpi.value}%`;
    case "count":
      return count(kpi.value);
  }
}

/* ---------- Revenue ---------- */

/**
 * Revenue lines, with a month-on-month badge.
 *
 * Revenue is the one figure on this screen whose polarity is not in doubt, so
 * `"up"` is passed explicitly and a fall reads destructive.
 *
 * `RevenueLine.mom` is required by the presentation type, so a line with no
 * previous period still needs words. It gets "no prior period" — a statement
 * about the comparison being absent, never a fabricated 0%.
 */
export function presentRevenue(lines: AdminRevenueLine[]): RevenueLine[] {
  return lines.map((line) => ({
    line: line.line,
    amount: money(line.amountRwf, line.currency),
    mom: movement(line.amountRwf, line.previousAmountRwf, "up") ?? {
      text: "no prior period",
      intent: "default" as const,
    },
  }));
}

/* ---------- District density ---------- */

/**
 * Business density by district, busiest first.
 *
 * RANKED, because the reader's question is "where is supply" and a comparison
 * of thirty bars is only readable when the lengths step down. Ties fall back to
 * the district name so the order is stable between two reads of the same data.
 *
 * NO BAR LENGTH HERE. This used to compute a rounded `width` percentage, which
 * turned 1 business of 250 into 0% and so into the same picture as none. The
 * shared `BarList` scales against the busiest row itself, from the count, and
 * draws any non-zero count as at least a sliver. On a platform with nothing
 * registered anywhere every track is simply empty and every count says 0.
 *
 * A NOTE ON `key`. `DistrictKey` in `lib/types.ts` is a seven-member union left
 * over from the fixture world, and Rwanda has thirty districts. Dropping the
 * other twenty-three would be a national console that hides most of the
 * country, so every row is kept and its key is the slug of the district name
 * the API sent — a rewriting of a fact, not a new one. Widening `DistrictKey`
 * (or replacing it with `districtId`) is the real fix and it lives in
 * `lib/types.ts`, which this leaf does not own.
 */
export function presentDensity(rows: AdminDistrictDensity[]): DistrictDensity[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.orgCount - a.orgCount || a.districtName.localeCompare(b.districtName),
    )
    .map((row) => {
      const badge = movement(row.orgCount, row.previousOrgCount, "up");
      return {
        key: slug(row.districtName) as Exclude<DistrictKey, "all">,
        label: row.districtName,
        count: row.orgCount,
        ...(badge ? { momBadge: badge } : {}),
      };
    });
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

/* ---------- Work queue ---------- */

/**
 * The "what needs a person" list.
 *
 * NO TONES. `WorkQueueItem` can carry `countTone` and `detailTone`, and this
 * mapping sets neither, because `AdminWorkQueueItem` carries no severity — only
 * a count, a title, a detail and the route that answers it. A red count the API
 * never called red is a judgement the console invented, and on this particular
 * screen an invented red is an invented emergency.
 *
 * `href` is the one navigational fact the API does send, and rightly: the
 * server knows which route answers a queue, the browser does not.
 */
export function presentWorkQueue(items: AdminWorkQueueItem[]): WorkQueueItem[] {
  return items.map((item) => ({
    count: item.count,
    title: item.title,
    detail: item.detail,
    href: item.href,
  }));
}

/* ---------- Adapter and queue health ---------- */

/** The adapter strip's wording, so a machine name never reaches a screen. */
const ADAPTER_LABEL: Record<AdminAdapterHealth["adapter"], string> = {
  payment: "Payments",
  ebm_vsdc: "VSDC EBM",
  rra_tin: "RRA TIN",
  filing: "Contract filing",
  mailer: "Mailer",
  maps: "Maps",
};

/**
 * Adapter health.
 *
 * `mode` crosses through untouched, and it is the most important thing on the
 * strip: an admin looking at money must never mistake a mock adapter for a live
 * one, so the console repeats what the API said rather than deciding for itself
 * which adapter is live (`lib/api/environments.ts` says why).
 *
 * ONE COARSE MAPPING, stated plainly. `AdminAdapterStatus` has `up | degraded |
 * down`; `AdapterStatus.state` in `lib/types.ts` has `up | degraded |
 * dead-letter`. There is no `down`, and `dead-letter` is the only destructive
 * state the strip renders, so `down` lands there. The word in the cell would be
 * wrong on its own, which is why the detail line says "not responding" — the
 * sentence stays true even where the token is blunt. Adding `down` to
 * `AdapterStatus` is the fix, in `lib/types.ts`, which this leaf does not own.
 */
export function presentAdapters(rows: AdminAdapterHealth[]): AdapterStatus[] {
  return rows.map((row) => ({
    name: ADAPTER_LABEL[row.adapter],
    state: row.status === "down" ? "dead-letter" : row.status,
    mode: row.mode,
    detail: adapterDetail(row),
  }));
}

function adapterDetail(row: AdminAdapterHealth): string {
  if (row.status === "down") {
    return detail("not responding", row.errorRate !== null && `${rate(row.errorRate)} errors`);
  }
  return (
    detail(
      row.latencyMs !== null && `${row.latencyMs} ms`,
      row.errorRate !== null && row.errorRate > 0 && `${rate(row.errorRate)} errors`,
    ) || EMPTY
  );
}

/**
 * Queue health.
 *
 * Its own type rather than `AdapterStatus`, because `AdapterStatus.mode` is
 * required and a BullMQ queue has no mock/live mode. Reusing the shape would
 * have meant inventing one, and a fabricated "live" beside a money queue is
 * exactly the confusion the mode flag exists to prevent.
 *
 * The state is derived from counts the API sent: anything in the dead-letter
 * queue is destructive, because a dead-lettered job is work the platform
 * accepted and then silently stopped doing.
 */
export interface QueueStatus {
  name: string;
  state: AdapterStatus["state"];
  detail: string;
  deadCount?: number;
}

export function presentQueues(rows: AdminQueueHealth[]): QueueStatus[] {
  return rows.map((row) => ({
    name: row.queue,
    state:
      row.deadLetter > 0 ? "dead-letter" : row.failed > 0 ? "degraded" : "up",
    detail: detail(
      `${count(row.depth)} queued`,
      row.failed > 0 && `${count(row.failed)} failed`,
      `${row.throughput}/min`,
    ),
    ...(row.deadLetter > 0 ? { deadCount: row.deadLetter } : {}),
  }));
}
