import {
  PSF_DECLINE_REASON_LABEL,
  PSF_FAMILY_LABEL,
  PSF_OFFERED_FAMILIES,
  PSF_OVERDUE_DAYS,
  PSF_OWNER_GROUP_LABEL,
  districtLetters,
  median,
  provinceDisplayName,
  type OversightGrant,
  type PsfDecisionsPage,
  type PsfDecisionsQuery,
  type PsfMembershipFamily,
  type PsfOfficerScope,
  type PsfOwnerGroup,
  type PsfReport,
  type PsfReportQuery,
} from '@injishi/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';

import { PsfReportRepository } from '../infrastructure/psf-report.repository';
import { PsfMembershipService } from './psf-membership.service';

const DECISIONS_PAGE_SIZE = 30;
const DAY_MS = 86_400_000;
/** The longest period a report covers: two years is already a lot of months. */
const MAX_PERIOD_DAYS = 731;

/** Midnight at the start of a Kigali yyyy-mm-dd date, as a moment (UTC+2 all year). */
function kigaliMidnight(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - 2 * 3600 * 1000);
}
function kigaliToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
}
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
const round1 = (v: number | null): number | null => (v === null ? null : Math.round(v * 10) / 10);

/**
 * The PSF officer console's report and decision log (2026-10-19).
 *
 * A district officer reads their district; a province officer (Kigali City,
 * say) reads every district in the province and compares them; a national
 * officer reads the country. The region is the officer's posting
 * (`PsfMembershipService.scopeFor`), narrowed when the console's switcher
 * picks one province or district inside it.
 */
@Injectable()
export class PsfReportService {
  constructor(
    private readonly repo: PsfReportRepository,
    private readonly psf: PsfMembershipService,
  ) {}

  /** What the officer covers, and the places the switcher offers. */
  async scope(grants: OversightGrant[]): Promise<PsfOfficerScope> {
    const own = grants.filter((g) => g.oversightRole === 'psf_membership_officer');
    const scope = await this.psf.scopeFor(grants);
    const places = await this.repo.geography();
    const level = own.some((g) => g.scopeLevel === 'country')
      ? 'country'
      : own.some((g) => g.scopeLevel === 'province')
        ? 'province'
        : 'district';
    const covered = places.filter((p) => scope === null || scope.includes(p.districtId));
    const provinces = new Map<number, PsfOfficerScope['provinces'][number]>();
    for (const p of covered) {
      const province = provinces.get(p.provinceId) ?? { id: p.provinceId, name: provinceDisplayName(p.provinceName), districts: [] };
      province.districts.push({ id: p.districtId, name: p.districtName, letters: districtLetters(p.districtId, p.districtName) });
      provinces.set(p.provinceId, province);
    }
    const list = [...provinces.values()];
    const label =
      level === 'country'
        ? 'Rwanda'
        : level === 'province'
          ? list.map((p) => p.name).join(', ')
          : list.flatMap((p) => p.districts.map((d) => `${d.name} district`)).join(', ');
    const title =
      own.find((g) => g.governmentTitle)?.governmentTitle ??
      (level === 'country' ? 'PSF National Manager' : level === 'province' ? 'PSF Provincial Manager' : 'PSF District Manager');
    return { level, label: label || 'No region', title, provinces: list };
  }

  async report(grants: OversightGrant[], query: PsfReportQuery): Promise<PsfReport> {
    if (query.to < query.from) throw new BadRequestException('The period ends before it starts.');
    const from = kigaliMidnight(query.from);
    const to = kigaliMidnight(addDays(query.to, 1));
    const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
    if (days > MAX_PERIOD_DAYS) throw new BadRequestException('Pick a period of two years or less.');
    const prevFrom = new Date(from.getTime() - days * DAY_MS);

    const scope = await this.psf.scopeFor(grants, { district: query.district, province: query.province });
    const today = kigaliToday();
    // The chart always shows twelve months at least, so a short period still has a trend.
    const chartFrom = days < 330 ? kigaliMidnight(`${addDays(query.to, -335).slice(0, 7)}-01`) : from;

    const [current, previous, now, months, funnel, bySector, byFamily, byGroup, districts, label] = await Promise.all([
      this.repo.periodCounts(scope, from, to),
      this.repo.periodCounts(scope, prevFrom, from),
      this.repo.now(scope, PSF_OVERDUE_DAYS, today, addDays(today, 30)),
      this.repo.months(scope, chartFrom, to),
      this.repo.funnel(scope, from, to),
      this.repo.bySector(scope, from, to),
      this.repo.byFamily(scope),
      this.repo.byGroup(scope),
      this.repo.districts(scope, from, to, PSF_OVERDUE_DAYS),
      this.regionLabel(grants, query),
    ]);
    const kpi = (k: keyof Omit<typeof current, 'decisionDays'>) => ({ value: current[k], previous: previous[k] });
    const families = new Map(byFamily.map((f) => [f.key, f]));
    return {
      regionLabel: label,
      from: query.from,
      to: query.to,
      kpis: {
        registered: kpi('registered'),
        applied: kpi('applied'),
        approved: kpi('approved'),
        declined: kpi('declined'),
        newMembers: kpi('newMembers'),
        membershipFeesRwf: kpi('membershipFeesRwf'),
        medianDecisionDays: { value: round1(median(current.decisionDays)), previous: round1(median(previous.decisionDays)) },
      },
      now,
      months,
      funnel,
      bySector,
      byFamily: PSF_OFFERED_FAMILIES.map((f) => ({
        key: f,
        label: PSF_FAMILY_LABEL[f as PsfMembershipFamily],
        count: families.get(f)?.count ?? 0,
        amountRwf: families.get(f)?.amountRwf ?? 0,
      })),
      byGroup: byGroup.map((g) => ({
        key: g.key,
        label: PSF_OWNER_GROUP_LABEL[g.key as PsfOwnerGroup] ?? g.key,
        count: g.count,
        amountRwf: 0,
      })),
      districts: districts.map((d) => ({
        districtId: d.districtId,
        name: d.name,
        letters: districtLetters(d.districtId, d.name),
        provinceName: provinceDisplayName(d.provinceName),
        registered: d.registered,
        waiting: d.waiting,
        overdue: d.overdue,
        approved: d.approved,
        declined: d.declined,
        members: d.members,
        membershipFeesRwf: d.feesRwf,
        medianDecisionDays: round1(median(d.decisionDays)),
        officers: d.officers,
      })),
    };
  }

  /** The region in words, narrowed when the switcher narrowed it. */
  private async regionLabel(grants: OversightGrant[], area: { district?: number; province?: number }): Promise<string> {
    if (area.district === undefined && area.province === undefined) return (await this.scope(grants)).label;
    const places = await this.repo.geography();
    if (area.district !== undefined) {
      const d = places.find((p) => p.districtId === area.district);
      return d ? `${d.districtName} district` : 'No region';
    }
    const p = places.find((x) => x.provinceId === area.province);
    return p ? provinceDisplayName(p.provinceName) : 'No region';
  }

  async decisions(grants: OversightGrant[], query: PsfDecisionsQuery): Promise<PsfDecisionsPage> {
    const scope = await this.psf.scopeFor(grants, { district: query.district, province: query.province });
    const page = await this.repo.decisions(scope, { outcome: query.outcome, q: query.q, cluster: query.cluster }, decodeCursor(query.cursor), DECISIONS_PAGE_SIZE);
    const last = page.rows.at(-1);
    return {
      items: page.rows.map((r) => ({
        applicationId: r.applicationId,
        docId: r.docId,
        businessName: r.businessName,
        businessCode: r.businessCode,
        districtName: r.districtName,
        tierName: r.tierName,
        outcome: r.status === 'declined' ? 'declined' : 'approved',
        paid: r.status === 'member',
        membershipNumber: r.approvedMembershipNumber,
        feeRwf: r.approvedFeeRwf,
        declineReasonLabel: r.declineReason ? PSF_DECLINE_REASON_LABEL[r.declineReason] : null,
        decidedAt: r.decidedAt.toISOString(),
        decidedByName: r.decidedByName,
        clusterName: r.clusterName,
        subsectorName: r.subsectorName,
        daysToDecide: round1(Math.max(0, (r.decidedAt.getTime() - r.waitFrom.getTime()) / DAY_MS)),
      })),
      nextCursor: page.more && last ? encodeCursor(last.decidedAt, last.applicationId) : null,
    };
  }
}

function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url');
}
function decodeCursor(cursor: string | undefined): { sortAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const sortAt = at ? new Date(at) : null;
  if (!sortAt || Number.isNaN(sortAt.getTime()) || !id || !/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  return { sortAt, id };
}
