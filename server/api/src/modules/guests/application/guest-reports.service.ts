import { Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import {
  GUEST_RETENTION_MONTHS,
  type GuestReport,
  type GuestReportQuery,
  type OversightGrant,
  RWANDA_CODE,
  addMonths,
  kigaliToday,
} from '@injishi/contracts';

import { renderGuestReportPdf } from '../domain/guest-report-pdf';
import { type ReportRow, reportFigures } from '../domain/guest-reports';
import { addressWords, placeWords, toCsv } from '../domain/guest-words';
import { reportAreaLevel } from '../domain/guest-routing';
import { GuestRegistryRepository } from '../infrastructure/guest-registry.repository';
import { REGISTRATION_COLUMNS, TALLY_COLUMNS, scopeSql } from '../infrastructure/leader-scope';
import { LeaderConsoleService, narrowSql } from './leader-console.service';

/**
 * The leader's reports (P5): for a period, inside the leader's own area (and
 * a narrowing to a sector, cell or village in it), the totals, the area
 * table, nationalities, relationships, arrivals over time, the average stay
 * and the homes with the most guests, as JSON for the screen, CSV and a
 * one-page PDF to send up the chain. Months already purged are added from the
 * purge's counts.
 */
@Injectable()
export class GuestReportsService {
  constructor(
    private readonly guests: GuestRegistryRepository,
    private readonly console: LeaderConsoleService,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  async report(userId: string, grants: readonly OversightGrant[], query: GuestReportQuery): Promise<GuestReport> {
    const posts = this.console.posts(grants);
    const now = this.now();
    const today = kigaliToday(now);
    const scope = scopeSql(posts, REGISTRATION_COLUMNS);
    const narrow = narrowSql(query);
    const cutoff = addMonths(today, -GUEST_RETENTION_MONTHS);
    // Purged months keep counts by "from abroad" only: a nationality, relationship or flag filter can't
    // reach them, so those leave the purged counts out.
    const purgeable = query.from < cutoff && !query.nationality && !query.relationship && !query.flagged;
    const [raw, stayingNow, purged, leader, scopes, narrowedTo] = await Promise.all([
      this.guests.reportRows(scope, narrow, query.from, query.to),
      this.guests.stayingNow(scope, sql`${narrow} and ${guestFilterSql(query)}`, today),
      purgeable
        ? this.guests.purgedCounts(
            scopeSql(posts, TALLY_COLUMNS),
            query.origin
              ? sql`${narrowSql(query, 't')} and t.from_abroad = ${query.origin === 'international'}`
              : narrowSql(query, 't'),
            query.from,
            query.to,
          )
        : Promise.resolve(null),
      this.guests.leader(userId),
      this.console.scopes(posts),
      this.narrowedWords(query),
    ]);
    const all: ReportRow[] = raw.map((r) => ({
      arrivalOn: r.arrivalOn,
      departureOn: r.departureOn,
      nationality: r.nationality,
      nationalityName: r.nationalityName,
      fromAbroad: r.nationality !== RWANDA_CODE,
      relationship: r.relationship,
      relationshipLabel: r.relationshipLabel,
      sectorId: r.sectorId,
      sectorName: r.sectorName,
      cellId: r.cellId,
      cellName: r.cellName,
      villageId: r.villageId,
      villageName: r.villageName,
      propertyId: r.propertyId,
      unitId: r.unitId,
      homeAddress: addressWords(r.addressText, r),
      unitLabel: r.unitLabel,
      flagged: r.flagged,
    }));
    const rows = all.filter((r) => keeps(query, r));
    // A narrowing to a cell breaks down by village; to a sector, by cell.
    const widest = reportAreaLevel(posts);
    const areaLevel = query.villageId || query.cellId ? 'village' : query.sectorId ? 'cell' : widest;
    return {
      period: { from: query.from, to: query.to },
      generatedAt: now.toISOString(),
      leader,
      scopes,
      narrowedTo,
      filteredBy: filterWords(query, all),
      choices: choicesOf(all),
      ...reportFigures({
        rows,
        from: query.from,
        to: query.to,
        stayingNow,
        areaLevel,
        purged: purged ? { before: cutoff, ...purged } : null,
      }),
    };
  }

  /** The report as CSV: a section per table, the totals first. */
  async csv(userId: string, grants: readonly OversightGrant[], query: GuestReportQuery): Promise<string> {
    const r = await this.report(userId, grants, query);
    const blank: string[] = [];
    const t = r.totals;
    const lines: (string | number | null)[][] = [
      ['Guest report', `${r.period.from} to ${r.period.to}`],
      ['Prepared by', r.leader.name ? `${r.leader.name} (${r.leader.email})` : r.leader.email],
      ...r.scopes.map((s) => [s.roleLabel, s.area]),
      ...(r.narrowedTo ? [['Narrowed to', r.narrowedTo]] : []),
      ...(r.filteredBy.length ? [['Guests', r.filteredBy.join(', ')]] : []),
      blank,
      ['Registered', t.registered],
      ['Staying now', t.stayingNow],
      ['From abroad', t.fromAbroad],
      ['Flagged', t.flagged],
      ['Average stay (nights)', t.averageNights],
      blank,
      [r.areaLevel === 'sector' ? 'Sector' : r.areaLevel === 'cell' ? 'Cell' : 'Village', 'Guests', 'From abroad', 'Flagged'],
      ...r.byArea.map((a) => [a.name, a.registered, a.fromAbroad, a.flagged]),
      blank,
      ['Nationality', 'Guests'],
      ...r.byNationality.map((n) => [n.name, n.count]),
      blank,
      ['Relationship', 'Guests'],
      ...r.byRelationship.map((x) => [x.label, x.count]),
      blank,
      [`Arrivals per ${r.arrivals.bucket}`, 'Guests'],
      ...r.arrivals.points.map((p) => [p.start, p.count]),
      blank,
      ['Home', 'Unit', 'Guests'],
      ...r.topHomes.map((h) => [h.address, h.unitLabel, h.guests]),
    ];
    const [header, ...rest] = lines;
    return toCsv((header ?? []).map((c) => String(c ?? '')), rest);
  }

  async pdf(userId: string, grants: readonly OversightGrant[], query: GuestReportQuery): Promise<Buffer> {
    return renderGuestReportPdf(await this.report(userId, grants, query));
  }

  private async narrowedWords(query: GuestReportQuery): Promise<string | null> {
    const level = query.villageId ? 'village' : query.cellId ? 'cell' : query.sectorId ? 'sector' : null;
    if (!level) return null;
    const id = (query.villageId ?? query.cellId ?? query.sectorId) as number;
    const area = await this.guests.placeIn(level, id);
    if (!area) return null;
    return placeWords(await this.guests.areaNames(area)) || null;
  }
}

/** Does a guest pass the report's guest filters (nationality, origin, relationship, flagged)? */
function keeps(q: GuestReportQuery, r: ReportRow): boolean {
  if (q.origin === 'nationals' && r.fromAbroad) return false;
  if (q.origin === 'international' && !r.fromAbroad) return false;
  if (q.nationality && r.nationality !== q.nationality) return false;
  if (q.relationship && r.relationship !== q.relationship) return false;
  if (q.flagged && !r.flagged) return false;
  return true;
}

/** The same filters over `guest_registrations g`, for the counts read in SQL (staying now). */
function guestFilterSql(q: GuestReportQuery): SQL {
  const parts: SQL[] = [];
  if (q.origin === 'nationals') parts.push(sql`g.nationality = ${RWANDA_CODE}`);
  if (q.origin === 'international') parts.push(sql`g.nationality <> ${RWANDA_CODE}`);
  if (q.nationality) parts.push(sql`g.nationality = ${q.nationality}`);
  if (q.relationship) parts.push(sql`g.relationship = ${q.relationship}`);
  if (q.flagged) {
    parts.push(sql`exists (select 1 from guest_registration_routes fr where fr.registration_id = g.id and fr.flagged_at is not null)`);
  }
  return parts.length ? sql`(${sql.join(parts, sql` and `)})` : sql`true`;
}

/** The filters in words, for the screen's chips, the CSV and the PDF. */
function filterWords(q: GuestReportQuery, rows: readonly ReportRow[]): string[] {
  const words: string[] = [];
  if (q.origin) words.push(q.origin === 'nationals' ? 'Rwandan guests' : 'Foreign guests');
  if (q.nationality) words.push(rows.find((r) => r.nationality === q.nationality)?.nationalityName ?? q.nationality);
  if (q.relationship) words.push(rows.find((r) => r.relationship === q.relationship)?.relationshipLabel ?? q.relationship);
  if (q.flagged) words.push('Flagged only');
  return words;
}

/** Every nationality and relationship among the period's guests, most first: what the filters offer. */
function choicesOf(rows: readonly ReportRow[]): GuestReport['choices'] {
  const tally = <K extends string>(
    key: (r: ReportRow) => K,
    label: (r: ReportRow) => string,
  ): [K, { label: string; count: number }][] => {
    const m = new Map<K, { label: string; count: number }>();
    for (const r of rows) {
      const k = key(r);
      const hit = m.get(k);
      if (hit) hit.count += 1;
      else m.set(k, { label: label(r), count: 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label));
  };
  return {
    nationalities: tally((r) => r.nationality, (r) => r.nationalityName).map(([code, v]) => ({ code, name: v.label, count: v.count })),
    relationships: tally((r) => r.relationship, (r) => r.relationshipLabel).map(([code, v]) => ({ code, label: v.label, count: v.count })),
  };
}
