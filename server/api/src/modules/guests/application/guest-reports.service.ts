import { Injectable } from '@nestjs/common';
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
    const [raw, stayingNow, purged, leader, scopes, narrowedTo] = await Promise.all([
      this.guests.reportRows(scope, narrow, query.from, query.to),
      this.guests.stayingNow(scope, narrow, today),
      query.from < cutoff
        ? this.guests.purgedCounts(scopeSql(posts, TALLY_COLUMNS), narrowSql(query, 't'), query.from, query.to)
        : Promise.resolve(null),
      this.guests.leader(userId),
      this.console.scopes(posts),
      this.narrowedWords(query),
    ]);
    const rows: ReportRow[] = raw.map((r) => ({
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
    // A narrowing to a cell breaks down by village; to a sector, by cell.
    const widest = reportAreaLevel(posts);
    const areaLevel = query.villageId || query.cellId ? 'village' : query.sectorId ? 'cell' : widest;
    return {
      period: { from: query.from, to: query.to },
      generatedAt: now.toISOString(),
      leader,
      scopes,
      narrowedTo,
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
