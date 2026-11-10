import { HR_FEATURE_INFO, HrFeature, type HrFeatureList } from '@injishi/contracts';
import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import {
  assetLoans,
  employeeLoans,
  employees,
  hrSettings,
  payClaims,
  payrollContributionChoices,
  vacancies,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { writeHrAudit } from '../infrastructure/hr-audit';

/** The contribution choices that are insurance options, not statutory contributions. */
export const INSURANCE_CODES = ['medical', 'medical_scheme', 'private_health'] as const;

/**
 * HR's optional features for a business: which are off, switching one (Injishi staff, from the admin
 * Businesses screen), and refusing new work through one that is off. Off is a list on `hr_settings`, so a
 * business with no row has everything on.
 */
@Injectable()
export class HrFeaturesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async offFor(orgId: string): Promise<Set<HrFeature>> {
    const [row] = await this.db
      .select({ off: hrSettings.featuresOff })
      .from(hrSettings)
      .where(eq(hrSettings.orgId, orgId))
      .limit(1);
    return new Set((row?.off ?? []).filter((x): x is HrFeature => HrFeature.safeParse(x).success));
  }

  /** Refuse new work through a feature that is off for the business. */
  async assertOn(orgId: string, feature: HrFeature): Promise<void> {
    if ((await this.offFor(orgId)).has(feature)) {
      throw new ForbiddenException({
        code: 'hr_feature_off',
        message: `${HR_FEATURE_INFO[feature].label} is switched off for this business. Ask Injishi to switch it on.`,
      });
    }
  }

  /** The business a staff file belongs to, for routes reached through a person's own file. */
  async orgOfEmployee(employeeId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ orgId: employees.orgId })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);
    return row?.orgId ?? null;
  }

  /** Every feature, on or off, and why one that is on cannot be switched off yet. */
  async list(orgId: string): Promise<HrFeatureList> {
    const [off, blockers] = await Promise.all([this.offFor(orgId), this.blockers(orgId)]);
    return {
      features: HrFeature.options.map((id) => ({
        id,
        ...HR_FEATURE_INFO[id],
        on: !off.has(id),
        blockedOff: off.has(id) ? null : (blockers[id] ?? null),
      })),
    };
  }

  /** Switch a feature on or off. Audited; switching off is refused while the feature still carries work. */
  async set(orgId: string, userId: string, feature: HrFeature, on: boolean, reason: string | null): Promise<HrFeatureList> {
    const off = await this.offFor(orgId);
    if (on === !off.has(feature)) return this.list(orgId);
    if (!on) {
      const why = (await this.blockers(orgId))[feature];
      if (why) throw new ConflictException(`${HR_FEATURE_INFO[feature].label} cannot be switched off yet: ${why}`);
    }
    const next = on ? [...off].filter((x) => x !== feature) : [...off, feature];
    await this.db.transaction(async (tx) => {
      await tx
        .insert(hrSettings)
        .values({ orgId, featuresOff: next })
        .onConflictDoUpdate({ target: hrSettings.orgId, set: { featuresOff: next, updatedAt: new Date() } });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: on ? 'hr.feature_switched_on' : 'hr.feature_switched_off',
        orgId,
        diff: { feature },
        reason,
      });
    });
    return this.list(orgId);
  }

  /** What still runs through each feature, in words; a feature with nothing running has no entry. */
  private async blockers(orgId: string): Promise<Partial<Record<HrFeature, string>>> {
    const count = sql<number>`count(*)::int`;
    const [[open], [loans], [claims], [lent], [insured]] = await Promise.all([
      this.db.select({ n: count }).from(vacancies).where(and(eq(vacancies.orgId, orgId), eq(vacancies.status, 'open'))),
      this.db.select({ n: count }).from(employeeLoans).where(and(eq(employeeLoans.orgId, orgId), isNull(employeeLoans.settledAt))),
      this.db.select({ n: count }).from(payClaims).where(and(eq(payClaims.orgId, orgId), eq(payClaims.status, 'requested'))),
      this.db.select({ n: count }).from(assetLoans).where(and(eq(assetLoans.orgId, orgId), isNull(assetLoans.returnedOn))),
      this.db
        .select({ n: count })
        .from(payrollContributionChoices)
        .where(
          and(
            eq(payrollContributionChoices.orgId, orgId),
            eq(payrollContributionChoices.enabled, true),
            inArray(payrollContributionChoices.code, [...INSURANCE_CODES]),
          ),
        ),
    ]);
    const words = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
    const out: Partial<Record<HrFeature, string>> = {};
    if (open.n) out.talent = `${words(open.n, 'vacancy is', 'vacancies are')} still open.`;
    if (loans.n) out.loans = `${words(loans.n, 'loan is', 'loans are')} still being repaid.`;
    if (claims.n) out.claims = `${words(claims.n, 'claim is', 'claims are')} waiting for a decision.`;
    if (lent.n) out.assets = `${words(lent.n, 'item is', 'items are')} still out.`;
    if (insured.n) out.insurance = 'An insurance option is still on in Payroll rules.';
    return out;
  }
}
