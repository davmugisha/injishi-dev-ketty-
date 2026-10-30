import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

import { configEntries } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { localMidnight } from '../../pms/domain/pricing';
import {
  HR_RULE,
  parseHrRule,
  type HrRuleRow,
  type LeaveDefaultsRule,
  type PayeRule,
  type PublicHolidaysRule,
  type RssbRule,
  type OvertimeRule,
  type FinalSettlementRule,
  type DeclarationFormatsRule,
} from '../domain/hr-rules';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Reads Rwanda's HR rules from `config_entries` (ADR-058, index contract 8).
 *
 * National rows: the table carries no org column, and that is right. Each read
 * returns the row IN FORCE at the instant asked about, newest effective date
 * then highest version first, parsed through the one parser in
 * `domain/hr-rules.ts`. Null means "no readable row", and every caller refuses
 * rather than defaulting.
 */
@Injectable()
export class HrRulesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The row in force at 00:00 in Kigali on `date` (a month's rules: its first day). */
  private async inForce(
    configType: string,
    date: string,
    tx?: Tx,
  ): Promise<{ id: string; version: number; value: unknown } | null> {
    const at = localMidnight(date);
    const [row] = await (tx ?? this.db)
      .select({ id: configEntries.id, version: configEntries.version, value: configEntries.value })
      .from(configEntries)
      .where(
        and(
          eq(configEntries.configType, configType),
          or(isNull(configEntries.effectiveFrom), sql`${configEntries.effectiveFrom} <= ${at}`),
          or(isNull(configEntries.effectiveTo), sql`${configEntries.effectiveTo} > ${at}`),
        ),
      )
      .orderBy(
        sql`${configEntries.effectiveFrom} DESC NULLS LAST`,
        sql`${configEntries.version} DESC`,
      )
      .limit(1);
    return row ?? null;
  }

  paye(date: string, tx?: Tx): Promise<HrRuleRow<PayeRule> | null> {
    return this.inForce(HR_RULE.paye, date, tx).then((r) => parseHrRule(HR_RULE.paye, r));
  }

  rssb(date: string, tx?: Tx): Promise<HrRuleRow<RssbRule> | null> {
    return this.inForce(HR_RULE.rssb, date, tx).then((r) => parseHrRule(HR_RULE.rssb, r));
  }

  /** 058-payroll AC-PY4: how approved overtime is paid. */
  overtime(date: string, tx?: Tx): Promise<HrRuleRow<OvertimeRule> | null> {
    return this.inForce(HR_RULE.overtime, date, tx).then((r) => parseHrRule(HR_RULE.overtime, r));
  }

  /** 058-payroll AC-PY13: what a leaver's last payslip adds. */
  finalSettlement(date: string, tx?: Tx): Promise<HrRuleRow<FinalSettlementRule> | null> {
    return this.inForce(HR_RULE.finalSettlement, date, tx).then((r) => parseHrRule(HR_RULE.finalSettlement, r));
  }

  /** 058-payroll AC-PY12: the declaration formats; none in force means provisional CSV. */
  declarationFormats(date: string, tx?: Tx): Promise<HrRuleRow<DeclarationFormatsRule> | null> {
    return this.inForce(HR_RULE.declarationFormats, date, tx).then((r) => parseHrRule(HR_RULE.declarationFormats, r));
  }

  leaveDefaults(date: string, tx?: Tx): Promise<HrRuleRow<LeaveDefaultsRule> | null> {
    return this.inForce(HR_RULE.leaveDefaults, date, tx).then((r) =>
      parseHrRule(HR_RULE.leaveDefaults, r),
    );
  }

  /**
   * One year's public holidays: the newest version of that year's row that has
   * not been superseded. One row per year, so a range over New Year needs two
   * (AC-L3).
   */
  async publicHolidays(year: number, tx?: Tx): Promise<HrRuleRow<PublicHolidaysRule> | null> {
    const now = new Date();
    const [row] = await (tx ?? this.db)
      .select({ id: configEntries.id, version: configEntries.version, value: configEntries.value })
      .from(configEntries)
      .where(
        and(
          eq(configEntries.configType, HR_RULE.publicHolidays),
          // Compared as text, so a malformed row is skipped rather than
          // failing the cast for every reader.
          sql`${configEntries.value} ->> 'year' = ${String(year)}`,
          or(isNull(configEntries.effectiveTo), sql`${configEntries.effectiveTo} > ${now}`),
        ),
      )
      .orderBy(
        sql`${configEntries.effectiveFrom} DESC NULLS LAST`,
        sql`${configEntries.version} DESC`,
      )
      .limit(1);
    const parsed = parseHrRule(HR_RULE.publicHolidays, row ?? null);
    return parsed && parsed.value.year === year ? parsed : null;
  }
}
