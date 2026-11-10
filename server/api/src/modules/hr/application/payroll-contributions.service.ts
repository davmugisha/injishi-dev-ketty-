import {
  PRIVATE_HEALTH_CODE,
  type PayrollContribution,
  type PayrollContributionList,
  type SetPayrollContributionRequest,
} from '@injishi/contracts';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { payrollContributionChoices } from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { kigaliToday } from '../domain/hr-calendar';
import type { RssbRule } from '../domain/hr-rules';
import type { Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { HrRulesRepository } from '../infrastructure/hr-rules.repository';
import { orgOf } from './hr-access';
import { HrFeaturesService, INSURANCE_CODES } from './hr-features.service';

type ChoiceRow = typeof payrollContributionChoices.$inferSelect;

/** What a business's choices make of the RSSB rule: the contributions it pays, and its private insurer. */
export interface AppliedContributions {
  rssb: RssbRule;
  fixed: { code: string; label: string; employeeRwf: number; employerRwf: number }[];
}

/**
 * The rule's contributions with this business's choices on the optional ones, and its private
 * health insurer (058-payroll). A computation reads them through `applied`, so a pay run and this
 * screen can never disagree on what is taken.
 */
export function applyChoices(rule: RssbRule, choices: readonly ChoiceRow[]): AppliedContributions {
  const byCode = new Map(choices.map((c) => [c.code, c]));
  const on = (c: RssbRule['contributions'][number]): boolean => !c.optional || (byCode.get(c.code)?.enabled ?? c.defaultOn ?? false);
  const insurer = byCode.get(PRIVATE_HEALTH_CODE);
  const fixed =
    insurer?.enabled && ((insurer.employeeAmountRwf ?? 0) > 0 || (insurer.employerAmountRwf ?? 0) > 0)
      ? [
          {
            code: PRIVATE_HEALTH_CODE,
            label: insurer.provider ? `Health insurance (${insurer.provider})` : 'Health insurance',
            employeeRwf: insurer.employeeAmountRwf ?? 0,
            employerRwf: insurer.employerAmountRwf ?? 0,
          },
        ]
      : [];
  return { rssb: { ...rule, contributions: rule.contributions.filter(on) }, fixed };
}

@Injectable()
export class PayrollContributionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly rules: HrRulesRepository,
    private readonly hrFeatures: HrFeaturesService,
  ) {}

  /** A business's choices, in a transaction or not. */
  choicesOf(orgId: string, tx?: Tx): Promise<ChoiceRow[]> {
    return (tx ?? this.db).select().from(payrollContributionChoices).where(eq(payrollContributionChoices.orgId, orgId));
  }

  async list(ws: ScopedWorkspace): Promise<PayrollContributionList> {
    const orgId = orgOf(ws);
    const today = kigaliToday();
    const [rule, paye, choices] = await Promise.all([this.rules.rssb(today), this.rules.paye(today), this.choicesOf(orgId)]);
    const byCode = new Map(choices.map((c) => [c.code, c]));
    const contributions: PayrollContribution[] = (rule?.value.contributions ?? []).map((c) => {
      const choice = byCode.get(c.code);
      const optional = c.optional ?? false;
      return {
        code: c.code,
        label: c.label,
        base: c.base,
        employeeRate: c.employeeRate,
        employerRate: c.employerRate,
        capRwf: c.capRwf ?? null,
        optional,
        enabled: !optional || (choice?.enabled ?? c.defaultOn ?? false),
        byDefault: optional && !choice,
      };
    });
    const insurer = byCode.get(PRIVATE_HEALTH_CODE);
    return {
      ruleVersion: rule?.version ?? null,
      effectiveFrom: null,
      note: rule?.value.note ?? null,
      contributions,
      paye: paye ? { taxableBase: paye.value.taxableBase, bands: paye.value.bands.map((b) => ({ fromRwf: b.fromRwf, toRwf: b.toRwf, rate: b.rate })) } : null,
      privateHealth: {
        enabled: insurer?.enabled ?? false,
        provider: insurer?.provider ?? null,
        employeeAmountRwf: insurer?.employeeAmountRwf ?? 0,
        employerAmountRwf: insurer?.employerAmountRwf ?? 0,
      },
      canChoose: ws.permissions.includes('payroll.run'),
    };
  }

  /** Switch an optional contribution, or set the private insurer. Runs not yet confirmed follow. */
  async set(ws: ScopedWorkspace, userId: string, code: string, body: SetPayrollContributionRequest): Promise<PayrollContributionList> {
    const orgId = orgOf(ws);
    // Switching an insurance option on needs the feature; switching one off never does.
    if (body.enabled && (INSURANCE_CODES as readonly string[]).includes(code)) await this.hrFeatures.assertOn(orgId, 'insurance');
    const isInsurer = code === PRIVATE_HEALTH_CODE;
    if (!isInsurer) {
      const rule = await this.rules.rssb(kigaliToday());
      const found = rule?.value.contributions.find((c) => c.code === code);
      if (!found) throw new NotFoundException(`No contribution ${code} in the rule in force.`);
      if (!found.optional) throw new UnprocessableEntityException(`${found.label} is required by law: it cannot be switched off.`);
      if (body.employeeAmountRwf !== undefined || body.employerAmountRwf !== undefined || body.provider !== undefined) {
        throw new UnprocessableEntityException(`${found.label} is a share of pay; it takes no amount.`);
      }
    } else if (body.enabled && !(body.employeeAmountRwf || body.employerAmountRwf)) {
      throw new UnprocessableEntityException('Say what the premium is: the business part, the employee part, or both.');
    }
    const values = {
      enabled: body.enabled,
      employeeAmountRwf: isInsurer ? (body.employeeAmountRwf ?? 0) : null,
      employerAmountRwf: isInsurer ? (body.employerAmountRwf ?? 0) : null,
      provider: isInsurer ? (body.provider?.trim() || null) : null,
      updatedByUserId: userId,
      updatedAt: new Date(),
    };
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: payrollContributionChoices.id })
        .from(payrollContributionChoices)
        .where(and(eq(payrollContributionChoices.orgId, orgId), eq(payrollContributionChoices.code, code)));
      if (existing) {
        await tx.update(payrollContributionChoices).set(values).where(eq(payrollContributionChoices.id, existing.id));
      } else {
        await tx.insert(payrollContributionChoices).values({ orgId, code, ...values });
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.payroll_contribution_set',
        orgId,
        diff: {
          code,
          enabled: body.enabled,
          ...(isInsurer
            ? { provider: values.provider, employeeAmountRwf: values.employeeAmountRwf, employerAmountRwf: values.employerAmountRwf }
            : {}),
        },
      });
    });
    return this.list(ws);
  }
}
