import {
  GUEST_PLACE_TYPE_LABEL,
  type GuestPlaceType,
  type GuestReport,
  REPORT_TIMING_LABEL,
  type ReportBucket,
  STAY_BANDS,
  STAY_BAND_LABEL,
  type ReportTiming,
  addDays,
  daysBetween,
  guestNights,
  reportTimingOf,
  stayBandOf,
} from '@injishi/contracts';

/**
 * The leader's report (P5): totals, the area table, nationality and
 * relationship counts, arrivals over time, the average stay and the homes with
 * most guests. Pure, over the rows the repository read for the period and the
 * leader's area, so the maths is tested without a database.
 */

/** One guest as a report counts it: no name, no phone, no ID. */
export interface ReportRow {
  arrivalOn: string;
  departureOn: string;
  /** The Kigali day the guest was reported. */
  reportedOn: string;
  placeType: GuestPlaceType;
  /** The place's own kind in words ("Motel", "Residence"). */
  placeLabel: string;
  /** The business or building's name. */
  propertyName: string;
  nationality: string;
  nationalityName: string;
  fromAbroad: boolean;
  relationship: string;
  relationshipLabel: string;
  sectorId: number | null;
  sectorName: string | null;
  cellId: number | null;
  cellName: string | null;
  villageId: number | null;
  villageName: string | null;
  propertyId: string;
  unitId: string | null;
  /** The home in words: street, village up to district. */
  homeAddress: string;
  unitLabel: string | null;
  flagged: boolean;
}

/** What the 12 month purge left for months inside the period. */
export interface PurgedCounts {
  before: string;
  registered: number;
  fromAbroad: number;
  flagged: number;
}

/** How many nationalities a report names before folding the rest into Other. */
export const TOP_NATIONALITIES = 10;
/** How many homes the "most guests" table lists. */
export const TOP_HOMES = 10;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A day for a chart axis: `12 Oct`. */
function shortDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** Up to a month: by day; up to half a year: by week; longer: by month. */
export function reportBucket(from: string, to: string): ReportBucket {
  const days = daysBetween(from, to) + 1;
  if (days <= 31) return 'day';
  if (days <= 183) return 'week';
  return 'month';
}

/** The Monday on or before a day. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sunday
  return addDays(iso, -((dow + 6) % 7));
}

/** The bucket a day falls in. */
export function bucketOf(iso: string, bucket: ReportBucket): string {
  if (bucket === 'day') return iso;
  if (bucket === 'week') return weekStart(iso);
  return `${iso.slice(0, 7)}-01`;
}

/** Every bucket from `from` to `to`, in order, each with its axis label. */
export function bucketsBetween(from: string, to: string, bucket: ReportBucket): { start: string; label: string }[] {
  const out: { start: string; label: string }[] = [];
  let at = bucketOf(from, bucket);
  while (at <= to) {
    const label =
      bucket === 'month' ? `${MONTHS[Number(at.slice(5, 7)) - 1]} ${at.slice(0, 4)}` : shortDay(at);
    out.push({ start: at, label });
    if (bucket === 'day') at = addDays(at, 1);
    else if (bucket === 'week') at = addDays(at, 7);
    else {
      const [y, m] = at.split('-').map(Number) as [number, number];
      at = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    }
  }
  return out;
}

/** Arrivals per bucket, every bucket of the period present (zero where nobody arrived). */
export function arrivalSeries(rows: readonly Pick<ReportRow, 'arrivalOn'>[], from: string, to: string): GuestReport['arrivals'] {
  const bucket = reportBucket(from, to);
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.arrivalOn < from || r.arrivalOn > to) continue;
    const key = bucketOf(r.arrivalOn, bucket);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return {
    bucket,
    points: bucketsBetween(from, to, bucket).map((b) => ({ ...b, count: counts.get(b.start) ?? 0 })),
  };
}

/** Mean nights per stay to one decimal, or null with no stays. */
export function averageNights(rows: readonly Pick<ReportRow, 'arrivalOn' | 'departureOn'>[]): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + guestNights(r.arrivalOn, r.departureOn), 0);
  return Math.round((total / rows.length) * 10) / 10;
}

/** The area table at a level; guests with no place at that level are one row, id 0. */
export function byArea(rows: readonly ReportRow[], level: 'sector' | 'cell' | 'village'): GuestReport['byArea'] {
  const groups = new Map<number, { id: number; name: string; registered: number; fromAbroad: number; flagged: number }>();
  for (const r of rows) {
    const id = (level === 'sector' ? r.sectorId : level === 'cell' ? r.cellId : r.villageId) ?? 0;
    const name =
      (level === 'sector' ? r.sectorName : level === 'cell' ? r.cellName : r.villageName) ??
      (level === 'village' ? 'No village on record' : 'Not on record');
    const g = groups.get(id) ?? { id, name, registered: 0, fromAbroad: 0, flagged: 0 };
    g.registered += 1;
    if (r.fromAbroad) g.fromAbroad += 1;
    if (r.flagged) g.flagged += 1;
    groups.set(id, g);
  }
  return [...groups.values()].sort((a, b) => b.registered - a.registered || a.name.localeCompare(b.name));
}

/** Nationalities, most first; past the top ten the rest are one Other row. */
export function byNationality(rows: readonly ReportRow[]): GuestReport['byNationality'] {
  const groups = new Map<string, { code: string; name: string; count: number }>();
  for (const r of rows) {
    const g = groups.get(r.nationality) ?? { code: r.nationality, name: r.nationalityName, count: 0 };
    g.count += 1;
    groups.set(r.nationality, g);
  }
  const sorted = [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (sorted.length <= TOP_NATIONALITIES) return sorted;
  const top = sorted.slice(0, TOP_NATIONALITIES - 1);
  const rest = sorted.slice(TOP_NATIONALITIES - 1).reduce((n, g) => n + g.count, 0);
  return [...top, { code: 'other', name: 'Other countries', count: rest }];
}

export function byRelationship(rows: readonly ReportRow[]): GuestReport['byRelationship'] {
  const groups = new Map<string, { code: string; label: string; count: number }>();
  for (const r of rows) {
    const g = groups.get(r.relationship) ?? { code: r.relationship, label: r.relationshipLabel, count: 0 };
    g.count += 1;
    groups.set(r.relationship, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * The homes and places with the most guests: a hotel as one place, a residence by building and unit. Named by
 * the business or building and its address, never by the person living there.
 */
export function topHomes(rows: readonly ReportRow[]): GuestReport['topHomes'] {
  const groups = new Map<string, GuestReport['topHomes'][number]>();
  for (const r of rows) {
    const unit = r.placeType === 'residence' ? r.unitLabel : null;
    const key = `${r.propertyId}:${r.placeType === 'residence' ? (r.unitId ?? '') : ''}`;
    const g = groups.get(key) ?? { name: r.propertyName, placeLabel: r.placeLabel, address: r.homeAddress, unitLabel: unit, guests: 0, fromAbroad: 0 };
    g.guests += 1;
    if (r.fromAbroad) g.fromAbroad += 1;
    groups.set(key, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.guests - a.guests || a.name.localeCompare(b.name))
    .slice(0, TOP_HOMES);
}

/** Arrivals by type of place, most first, with those from abroad and the mean stay. */
export function byPlaceType(rows: readonly ReportRow[]): GuestReport['byPlaceType'] {
  const groups = new Map<GuestPlaceType, ReportRow[]>();
  for (const r of rows) groups.set(r.placeType, [...(groups.get(r.placeType) ?? []), r]);
  return [...groups.entries()]
    .map(([type, list]) => ({
      type,
      label: GUEST_PLACE_TYPE_LABEL[type],
      count: list.length,
      fromAbroad: list.filter((r) => r.fromAbroad).length,
      averageNights: averageNights(list),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** How long the stays are, every band present in order (zero where none). */
export function stayBands(rows: readonly Pick<ReportRow, 'arrivalOn' | 'departureOn'>[]): GuestReport['stayBands'] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const band = stayBandOf(guestNights(r.arrivalOn, r.departureOn));
    counts.set(band, (counts.get(band) ?? 0) + 1);
  }
  return STAY_BANDS.map((band) => ({ band, label: STAY_BAND_LABEL[band], count: counts.get(band) ?? 0 }));
}

/** When guests were reported against their arrival day: before, on the day, after. */
export function reportTiming(rows: readonly Pick<ReportRow, 'arrivalOn' | 'reportedOn'>[]): GuestReport['timing'] {
  const order: ReportTiming[] = ['before', 'same_day', 'after'];
  const counts = new Map<ReportTiming, number>();
  for (const r of rows) {
    const t = reportTimingOf(r.reportedOn, r.arrivalOn);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return order.map((timing) => ({ timing, label: REPORT_TIMING_LABEL[timing], count: counts.get(timing) ?? 0 }));
}

/** Guests present each day, labelled for a chart's axis. */
export function presentSeries(days: readonly { day: string; total: number; fromAbroad: number }[]): GuestReport['presentByDay'] {
  return days.map((d) => ({ ...d, label: shortDay(d.day) }));
}

/**
 * The figures of a report. `rows` are the guests who arrived in the period,
 * inside the leader's area (cancelled ones excluded); `stayingNow` is today's
 * count, whatever the period; `purged` the counts the retention purge kept for
 * months inside the period, folded into the totals.
 */
export function reportFigures(input: {
  rows: readonly ReportRow[];
  from: string;
  to: string;
  stayingNow: number;
  areaLevel: 'sector' | 'cell' | 'village';
  purged: PurgedCounts | null;
}): Pick<
  GuestReport,
  | 'totals'
  | 'areaLevel'
  | 'byArea'
  | 'byNationality'
  | 'byRelationship'
  | 'arrivals'
  | 'topHomes'
  | 'purged'
  | 'byPlaceType'
  | 'stayBands'
  | 'timing'
> {
  const rows = input.rows.filter((r) => r.arrivalOn >= input.from && r.arrivalOn <= input.to);
  const purged = input.purged && input.purged.registered > 0 ? input.purged : null;
  const registered = rows.length + (purged?.registered ?? 0);
  const fromAbroad = rows.filter((r) => r.fromAbroad).length + (purged?.fromAbroad ?? 0);
  return {
    totals: {
      registered,
      stayingNow: input.stayingNow,
      fromAbroad,
      nationals: registered - fromAbroad,
      nationalities: new Set(rows.map((r) => r.nationality)).size,
      flagged: rows.filter((r) => r.flagged).length + (purged?.flagged ?? 0),
      averageNights: averageNights(rows),
    },
    byPlaceType: byPlaceType(rows),
    stayBands: stayBands(rows),
    timing: reportTiming(rows),
    areaLevel: input.areaLevel,
    byArea: byArea(rows, input.areaLevel),
    byNationality: byNationality(rows),
    byRelationship: byRelationship(rows),
    arrivals: arrivalSeries(rows, input.from, input.to),
    topHomes: topHomes(rows),
    purged,
  };
}
