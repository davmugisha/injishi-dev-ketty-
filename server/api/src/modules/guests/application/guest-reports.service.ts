import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import {
  GUEST_LENGTH_LABEL,
  GUEST_PLACE_TYPE_LABEL,
  GUEST_RETENTION_MONTHS,
  type GuestReport,
  type GuestReportQuery,
  isChainRole,
  LEADER_ROLE_CHAIN,
  LEADER_ROLE_LABEL,
  type LeaderGuestQuery,
  type LeaderRole,
  type OversightGrant,
  RWANDA_CODE,
  addMonths,
  guestLengthHolds,
  guestNights,
  guestPlaceKindLabel,
  guestPlaceTypeOf,
  kigaliDateOf,
  kigaliToday,
} from '@injishi/contracts';

import type { SummarySection, Workbook } from '../domain/guest-export';
import { renderGuestReportPdf } from '../domain/guest-report-pdf';
import { type ReportRow, presentSeries, reportFigures } from '../domain/guest-reports';
import { addressWords, toCsv } from '../domain/guest-words';
import { writeXlsx } from '../infrastructure/xlsx-workbook';
import { reportAreaLevel } from '../domain/guest-routing';
import { GuestRegistryRepository } from '../infrastructure/guest-registry.repository';
import { REGISTRATION_COLUMNS, TALLY_COLUMNS, scopeSql } from '../infrastructure/leader-scope';
import { LeaderConsoleService, guestFilterSql, narrowSql } from './leader-console.service';

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
    const purgeable = query.from < cutoff && !query.nationality && !query.relationship && !query.flagged && !query.placeType && !query.length;
    const filtered = sql`${narrow} and ${guestFilterSql(query, today)}`;
    const audience = this.console.audience(posts);
    const [raw, chain, stayingNow, present, purged, leader, scopes, narrowedTo] = await Promise.all([
      this.guests.reportRows(scope, narrow, query.from, query.to),
      this.guests.reportChain(scope, filtered, query.from, query.to),
      this.guests.stayingNow(scope, filtered, today),
      this.guests.presentByDay(scope, filtered, query.from, query.to),
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
      this.console.narrowedWords(query),
    ]);
    const all: ReportRow[] = raw.map((r) => ({
      arrivalOn: r.arrivalOn,
      departureOn: r.departureOn,
      reportedOn: r.reportedOn,
      placeType: guestPlaceTypeOf(r.hostKind, r.businessKind),
      placeLabel: guestPlaceKindLabel(r.hostKind, r.businessKind),
      propertyName: r.propertyName,
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
      audience,
      presentByDay: presentSeries(present),
      leader,
      scopes,
      narrowedTo,
      filteredBy: filterWords(query, all),
      choices: choicesOf(all),
      // Each body reads its own chain: local government its three posts, DGIE its three.
      chain: chain
        .filter((c) => isChainRole(c.role) && LEADER_ROLE_CHAIN[c.role as LeaderRole] === audience)
        .map((c) => ({ ...c, role: c.role as LeaderRole, label: LEADER_ROLE_LABEL[c.role as LeaderRole] })),
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

  /** The report's figures as titled sections: the totals first, then each table. One shape for CSV and Excel. */
  sections(r: GuestReport): SummarySection[] {
    const t = r.totals;
    const dgie = r.audience === 'dgie';
    const area = r.areaLevel === 'sector' ? 'Sector' : r.areaLevel === 'cell' ? 'Cell' : 'Village';
    const peak = r.presentByDay.reduce<GuestReport['presentByDay'][number] | null>((best, d) => (d.total > (best?.total ?? -1) ? d : best), null);
    return [
      {
        title: 'Totals',
        rows: [
          [dgie ? 'Foreign guests arrived' : 'Guests arrived', t.registered],
          ...(dgie ? [] : ([['Rwandan', t.nationals], ['Foreign', t.fromAbroad]] as [string, number][])),
          ['Nationalities', t.nationalities],
          ['Staying now', t.stayingNow],
          ['Most present on one day', peak && peak.total > 0 ? `${peak.total} on ${peak.day}` : 0],
          ['Average stay (nights)', t.averageNights],
          ['Flagged', t.flagged],
        ],
      },
      {
        title: 'By type of place',
        head: ['Type', 'Guests', dgie ? 'Abroad' : 'Foreign', 'Average nights'],
        rows: r.byPlaceType.map((p) => [p.label, p.count, p.fromAbroad, p.averageNights]),
      },
      { title: 'By nationality', rows: r.byNationality.map((n) => [n.name, n.count]) },
      { title: 'How long they stay', rows: r.stayBands.map((b) => [b.label, b.count]) },
      { title: 'When they were reported', rows: r.timing.map((x) => [x.label, x.count]) },
      ...(dgie ? [] : [{ title: 'Who they are to their hosts', rows: r.byRelationship.map((x): [string, number] => [x.label, x.count]) }]),
      {
        title: `By ${area.toLowerCase()}`,
        head: [area, 'Guests', 'Foreign', 'Flagged'],
        rows: r.byArea.map((a) => [a.name, a.registered, a.fromAbroad, a.flagged]),
      },
      {
        title: 'Places with the most guests',
        head: ['Place', 'Type', 'Guests', 'Foreign'],
        rows: r.topHomes.map((h) => [[h.name, h.unitLabel ? `unit ${h.unitLabel}` : null].filter(Boolean).join(', '), h.placeLabel, h.guests, h.fromAbroad]),
      },
      {
        title: 'Along the chain',
        head: ['Leader post', 'Received', 'Opened', 'Flagged', 'Waiting'],
        rows: r.chain.map((c) => [c.label, c.guests, c.opened, c.flagged, c.waiting]),
      },
    ].filter((s) => s.rows.length > 0) as SummarySection[];
  }

  private meta(r: GuestReport): [string, string][] {
    return [
      ['Period', `${r.period.from} to ${r.period.to} (by arrival day)`],
      ['Prepared by', r.leader.name ? `${r.leader.name} (${r.leader.email})` : r.leader.email],
      ...r.scopes.map((s): [string, string] => [s.roleLabel, s.area]),
      ...(r.narrowedTo ? [['Narrowed to', r.narrowedTo] as [string, string]] : []),
      ['Filters', r.filteredBy.length ? r.filteredBy.join(', ') : 'None'],
      ['Generated', `${kigaliDateOf(r.generatedAt)} on Injishi`],
    ];
  }

  /** The report as CSV: a section per table, the totals first. */
  async csv(userId: string, grants: readonly OversightGrant[], query: GuestReportQuery): Promise<string> {
    const r = await this.report(userId, grants, query);
    const lines: (string | number | null)[][] = [];
    for (const [label, value] of this.meta(r)) lines.push([label, value]);
    for (const s of this.sections(r)) {
      lines.push([], s.head ? [s.title, ...s.head.slice(1)] : [s.title]);
      for (const line of s.rows) lines.push(line);
    }
    return toCsv([r.audience === 'dgie' ? 'Foreign guest report' : 'Guest report', `${r.period.from} to ${r.period.to}`], lines);
  }

  /**
   * The report as an Excel workbook: the summary sheet (who, period, filters, every figure), the guests present
   * each day, and the guests themselves for the same period and filters, in the audience's columns.
   */
  async xlsx(userId: string, grants: readonly OversightGrant[], query: GuestReportQuery): Promise<Buffer> {
    const r = await this.report(userId, grants, query);
    const list: LeaderGuestQuery = {
      tab: query.flagged ? 'flagged' : 'all',
      when: 'soon',
      page: 1,
      sectorId: query.sectorId,
      cellId: query.cellId,
      villageId: query.villageId,
      origin: query.origin,
      nationality: query.nationality,
      relationship: query.relationship,
      placeType: query.placeType,
      length: query.length,
      arrivedFrom: query.from,
      arrivedTo: query.to,
    };
    const guests = await this.console.exportBook(userId, grants, list);
    const book: Workbook = {
      title: `${r.audience === 'dgie' ? 'Foreign guest report' : 'Guest report'}, ${r.period.from} to ${r.period.to}`,
      meta: this.meta(r),
      summary: this.sections(r),
      sheets: [
        ...guests.sheets,
        {
          name: 'Present each day',
          columns: [
            { key: 'day', header: 'Day', kind: 'date' },
            { key: 'total', header: 'Guests present', kind: 'int' },
            ...(r.audience === 'dgie' ? [] : [{ key: 'abroad', header: 'Of them foreign', kind: 'int' as const }]),
          ],
          rows: r.presentByDay.map((d) => (r.audience === 'dgie' ? [d.day, d.total] : [d.day, d.total, d.fromAbroad])),
        },
      ],
    };
    return writeXlsx(book);
  }

  async pdf(userId: string, grants: readonly OversightGrant[], query: GuestReportQuery): Promise<Buffer> {
    return renderGuestReportPdf(await this.report(userId, grants, query));
  }
}

/** Does a guest pass the report's guest filters (nationality, origin, relationship, flagged)? */
function keeps(q: GuestReportQuery, r: ReportRow): boolean {
  if (q.origin === 'nationals' && r.fromAbroad) return false;
  if (q.origin === 'international' && !r.fromAbroad) return false;
  if (q.nationality && r.nationality !== q.nationality) return false;
  if (q.relationship && r.relationship !== q.relationship) return false;
  if (q.flagged && !r.flagged) return false;
  if (q.placeType && r.placeType !== q.placeType) return false;
  if (q.length && !guestLengthHolds(q.length, guestNights(r.arrivalOn, r.departureOn))) return false;
  return true;
}

/** The filters in words, for the screen's chips, the CSV and the PDF. */
function filterWords(q: GuestReportQuery, rows: readonly ReportRow[]): string[] {
  const words: string[] = [];
  if (q.origin) words.push(q.origin === 'nationals' ? 'Rwandan guests' : 'Foreign guests');
  if (q.nationality) words.push(rows.find((r) => r.nationality === q.nationality)?.nationalityName ?? q.nationality);
  if (q.relationship) words.push(rows.find((r) => r.relationship === q.relationship)?.relationshipLabel ?? q.relationship);
  if (q.placeType) words.push(GUEST_PLACE_TYPE_LABEL[q.placeType]);
  if (q.length) words.push(GUEST_LENGTH_LABEL[q.length]);
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
