import {
  ACCOMMODATION_CLASS_LABEL,
  OVERSIGHT_ROLE_LABEL,
  PSF_DECLINE_REASON_LABEL,
  REJECTION_REASON_LABEL,
  PSF_OVERDUE_DAYS,
  PSF_OWNER_GROUP_LABEL,
  districtLetters,
  median,
  psfFeeKindsOf,
  psfFeeTotal,
  provinceDisplayName,
  type OversightGrant,
  type PsfDecisionsPage,
  type PsfDecisionsQuery,
  type PsfKpi,
  type PsfOfficerScope,
  type PsfOwnerGroup,
  type PsfReport,
  type PsfReportQuery,
  type PsfRegistrationProfile,
  type RegistrationRejectionReason,
} from '@injishi/contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PsfReportRepository } from '../infrastructure/psf-report.repository';
import { PsfMembershipService, isPsfConsoleRole } from './psf-membership.service';

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

/** The chart's months with every series filled, so a month with nothing still draws as zero. */
function fillMonths<T extends Record<string, number>>(
  keys: string[],
  rows: ({ month: string } & T)[],
  zero: T,
): ({ month: string } & T)[] {
  const by = new Map(rows.map((r) => [r.month, r]));
  return keys.map((month) => ({ ...zero, ...(by.get(month) ?? {}), month }));
}

/** The first day of the chart's first month, as a Kigali date, for the bookings' date column. */
function chartFromDay(chartFrom: Date): string {
  return new Date(chartFrom.getTime() + 2 * 3600 * 1000).toISOString().slice(0, 10);
}

/** A business kind in words: an accommodation's RDB class, else what the business is. */
const KIND_LABEL: Readonly<Record<string, string>> = {
  ...(ACCOMMODATION_CLASS_LABEL as Readonly<Record<string, string>>),
  hospitality: 'Hospitality',
  residence: 'Residences',
  enterprise: 'PSF enterprises',
};

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
    const own = grants.filter((g) => isPsfConsoleRole(g.oversightRole));
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

    const toDay = addDays(query.to, 1);
    const prevFromDay = addDays(query.from, -days);
    const [
      current,
      previous,
      now,
      months,
      funnel,
      bySector,
      byFamily,
      byGroup,
      districts,
      label,
      registrations,
      registrationsBefore,
      kinds,
      stays,
      staysBefore,
      registrationMonths,
      decided,
      bookingMonths,
      top,
    ] = await Promise.all([
      this.repo.periodCounts(scope, from, to),
      this.repo.periodCounts(scope, prevFrom, from),
      this.repo.now(scope, PSF_OVERDUE_DAYS, today, addDays(today, 30), addDays(today, 60), addDays(today, 90)),
      this.repo.months(scope, chartFrom, to),
      this.repo.funnel(scope, from, to),
      this.repo.bySector(scope, from, to),
      this.repo.byFamily(scope),
      this.repo.byGroup(scope),
      this.repo.districts(scope, from, to, PSF_OVERDUE_DAYS),
      this.regionLabel(grants, query),
      this.repo.registrations(scope, from, to),
      this.repo.registrations(scope, prevFrom, from),
      this.repo.activeBusinesses(scope),
      this.repo.bookings(scope, query.from, toDay),
      this.repo.bookings(scope, prevFromDay, query.from),
      this.repo.registrationMonths(scope, chartFrom, to),
      this.repo.decided(scope, from, to),
      this.repo.bookingMonths(scope, chartFromDay(chartFrom), toDay),
      this.repo.topBusinesses(scope, query.from, toDay),
    ]);
    const [split, districtPercent, levels, feeLines, feeLinesBefore, feeLinesCharted] = await Promise.all([
      this.repo.feeSplit(scope, from, to),
      this.repo.currentSplitPercent(),
      this.psf.levels(),
      this.repo.feeLines(scope, from, to),
      this.repo.feeLines(scope, prevFrom, from),
      this.repo.feeLines(scope, chartFrom, to),
    ]);
    const kpi = (k: keyof Omit<typeof current, 'decisionDays'>): PsfKpi => ({ value: current[k], previous: previous[k] });
    const fees = psfFeeKindsOf(feeLines);
    const feesBefore = psfFeeKindsOf(feeLinesBefore);
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
        renewed: kpi('renewed'),
        cardHolders: kpi('cardHolders'),
        upgraded: kpi('upgraded'),
        membershipFeesRwf: { value: psfFeeTotal(fees).totalRwf, previous: psfFeeTotal(feesBefore).totalRwf },
        medianDecisionDays: { value: round1(median(current.decisionDays)), previous: round1(median(previous.decisionDays)) },
      },
      fees: {
        current: fees,
        previous: feesBefore,
        ourShare: grants.some((g) => g.oversightRole === 'psf_membership_officer' && g.scopeLevel === 'country') ? 'headquarters' : 'district',
      },
      split: {
        totalRwf: split.reduce((sum, d) => sum + d.totalRwf, 0),
        districtRwf: split.reduce((sum, d) => sum + d.districtRwf, 0),
        headquartersRwf: split.reduce((sum, d) => sum + d.headquartersRwf, 0),
        districtPercent,
        byDistrict: split,
      },
      now,
      registrations: {
        waitingReview: registrations.waitingReview,
        waitingApproval: registrations.waitingApproval,
        waitingPayment: registrations.waitingPayment,
        active: registrations.active,
        rejected: registrations.rejected,
        suspended: registrations.suspended,
        approvedInPeriod: { value: registrations.approved, previous: registrationsBefore.approved },
        rejectedInPeriod: { value: registrations.rejectedInPeriod, previous: registrationsBefore.rejectedInPeriod },
        medianDaysToDecision: round1(median(registrations.decisionDays)),
        oldestWaitingDays: registrations.oldestWaitingDays,
        months: fillMonths(months.map((m) => m.month), registrationMonths, { submitted: 0, approved: 0, rejected: 0 }),
        decided: decided.map((d) => ({
          orgId: d.orgId,
          legalName: d.legalName,
          kindLabel: KIND_LABEL[d.kind] ?? d.kind,
          decision: d.decision,
          decidedAt: d.decidedAt.toISOString(),
          decidedBy: d.decidedBy,
          status: d.status,
        })),
      },
      economy: {
        activeBusinesses: kinds.map((k) => ({ key: k.key, label: KIND_LABEL[k.key] ?? k.key, count: k.count })),
        bookings: { value: stays.bookings, previous: staysBefore.bookings },
        guestNights: { value: stays.guestNights, previous: staysBefore.guestNights },
        bookedValueRwf: { value: stays.valueRwf, previous: staysBefore.valueRwf },
        months: fillMonths(months.map((m) => m.month), bookingMonths, { bookings: 0, guestNights: 0, valueRwf: 0 }),
        topBusinesses: top,
      },
      months: months.map((m) => {
        const inMonth = psfFeeKindsOf(feeLinesCharted.filter((f) => f.month === m.month));
        return { ...m, feesRwf: psfFeeTotal(inMonth).totalRwf, fees: inMonth };
      }),
      funnel,
      bySector,
      // PSF's own levels (2026-11-06), any it retired kept while they still hold members.
      byFamily: levels
        .filter((l) => l.active || families.has(l.code))
        .map((l) => ({
          key: l.code,
          label: l.nameEn,
          count: families.get(l.code)?.count ?? 0,
          amountRwf: families.get(l.code)?.amountRwf ?? 0,
          districtRwf: 0,
          headquartersRwf: 0,
        })),
      byGroup: byGroup.map((g) => ({
        key: g.key,
        label: PSF_OWNER_GROUP_LABEL[g.key as PsfOwnerGroup] ?? g.key,
        count: g.count,
        amountRwf: 0,
        districtRwf: 0,
        headquartersRwf: 0,
      })),
      districts: districts.map((d) => {
        const inDistrict = psfFeeKindsOf(feeLines.filter((f) => f.districtId === d.districtId));
        return {
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
          membershipFeesRwf: psfFeeTotal(inDistrict).totalRwf,
          fees: inDistrict,
          medianDecisionDays: round1(median(d.decisionDays)),
          officers: d.officers,
        };
      }),
    };
  }

  /**
   * One business's side on Injishi (2026-10-30), for the PSF District Manager covering it: what it is,
   * who decided its registration and when, and whether guests can find it yet.
   */
  async registrationProfile(grants: OversightGrant[], orgId: string): Promise<PsfRegistrationProfile> {
    const scope = await this.psf.scopeFor(grants);
    const found = await this.repo.registrationProfile(orgId);
    const districtId = found ? (found.org.district_id as number | null) : null;
    if (!found || (scope !== null && (districtId === null || !scope.includes(districtId)))) {
      throw new NotFoundException('This business is not in your region.');
    }
    const { org, owner, reviews, listings, bookings90Days } = found;
    const iso = (v: unknown): string | null => (v ? new Date(String(v)).toISOString() : null);
    return {
      orgId: String(org.id),
      legalName: String(org.legal_name),
      businessCode: (org.business_code as string | null) ?? null,
      kindLabel: KIND_LABEL[String(org.kind)] ?? String(org.kind),
      domain: String(org.domain),
      districtName: (org.district_name as string | null) ?? null,
      sectorName: (org.sector_name as string | null) ?? null,
      addressText: (org.address_text as string | null) ?? null,
      tin: (org.tin as string | null) ?? null,
      starGrade: org.eac_star_grade === null || org.eac_star_grade === undefined ? null : Number(org.eac_star_grade),
      starGradeConfirmed: !!org.star_grade_verified_at,
      status: String(org.status),
      owner: owner
        ? {
            name: (owner.name as string | null) ?? null,
            email: String(owner.email),
            phone: (owner.phone_number as string | null) ?? null,
          }
        : null,
      registeredAt: iso(org.created_at) ?? new Date().toISOString(),
      reviews: reviews.map((r) => ({
        stage: String(r.stage),
        decision: r.decision === 'rejected' ? 'rejected' : 'passed',
        roleLabel:
          (OVERSIGHT_ROLE_LABEL as Readonly<Record<string, string>>)[String(r.role)] ?? String(r.role),
        byName: (r.by_name as string | null) ?? null,
        at: iso(r.decided_at) ?? '',
        notes: (r.notes as string | null) ?? null,
        reasonLabel: r.reason ? (REJECTION_REASON_LABEL[r.reason as RegistrationRejectionReason] ?? null) : null,
      })),
      listings: listings.map((l) => ({
        propertyName: String(l.name),
        status: String(l.status),
        publishedAt: iso(l.published_at),
        slug: (l.slug as string | null) ?? null,
        roomTypes: Number(l.room_types ?? 0),
        rooms: Number(l.rooms ?? 0),
      })),
      bookings90Days,
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
