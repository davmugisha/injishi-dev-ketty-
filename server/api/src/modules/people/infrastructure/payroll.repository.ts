import {
  PAY_RUN_LIST,
  type ListQuery,
  type PayRunRuleVersion,
  type PayRunStatus,
  type PayslipLine,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray, isNull, lte, notInArray, or, sql, type SQL } from 'drizzle-orm';

import {
  attendanceRecords,
  employees,
  employmentContracts,
  payRuns,
  payslips,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  compileListQuery,
  countAll,
  statusCountsOf,
  type ListColumns,
  type ListRows,
} from '../../../shared/lists/list-query';
import type { ComputedPayslip } from '../domain/pay-computation';
import type { ContractRow, Tx } from './employees.repository';

export interface PayRunRow {
  id: string;
  orgId: string;
  periodStart: string;
  status: PayRunStatus;
  computedAt: Date;
  ruleVersions: PayRunRuleVersion[];
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  headcount: number;
  grossRwf: number;
  netRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
}

export interface PayslipRow {
  id: string;
  employeeId: string;
  employeeNumber: string;
  preferredName: string | null;
  legalName: string;
  contractId: string;
  payableDays: number;
  grossRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  otherDeductionsRwf: number;
  netRwf: number;
  lines: PayslipLine[];
  status: PayRunStatus;
}

/** What confirm checks each covered person for (AC-Y3). */
export interface CoveredPerson {
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  rssbNumber: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
}

/**
 * One figure over a run's payslips, as a subquery of the run row.
 *
 * The outer row is named in full, `"pay_runs"."id"`, and that is the point of
 * this helper. Drizzle renders `${payRuns.id}` unqualified inside a select
 * list, and an unqualified `id` inside this subquery resolves to the PAYSLIP's
 * own id, which matched nothing and listed every run as empty. `expr` is only
 * ever one of the literals below, never input.
 */
function overSlips(expr: string): SQL<number> {
  return sql<number>`(select ${sql.raw(expr)} from "payslips" p where p.pay_run_id = "pay_runs"."id")`;
}

/**
 * Pay runs and payslips (ADR-058). The only place that touches Drizzle for
 * them. A confirmed row is never written again: every write below is guarded on
 * the run still being a draft, by the service under the run's row lock.
 */
@Injectable()
export class PayrollRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private readonly runColumns = {
    id: payRuns.id,
    orgId: payRuns.orgId,
    periodStart: payRuns.periodStart,
    status: payRuns.status,
    computedAt: payRuns.computedAt,
    ruleVersions: sql<PayRunRuleVersion[]>`${payRuns.ruleVersions}`,
    confirmedAt: payRuns.confirmedAt,
    confirmedByUserId: payRuns.confirmedByUserId,
    headcount: overSlips('count(*)::int'),
    grossRwf: overSlips('coalesce(sum(p.gross_rwf), 0)::bigint'),
    netRwf: overSlips('coalesce(sum(p.net_rwf), 0)::bigint'),
    payeRwf: overSlips('coalesce(sum(p.paye_rwf), 0)::bigint'),
    employeeContributionsRwf: overSlips('coalesce(sum(p.employee_contributions_rwf), 0)::bigint'),
    employerContributionsRwf: overSlips('coalesce(sum(p.employer_contributions_rwf), 0)::bigint'),
  };

  private toRun(row: Record<string, unknown>): PayRunRow {
    const r = row as unknown as PayRunRow;
    return {
      ...r,
      headcount: Number(r.headcount),
      grossRwf: Number(r.grossRwf),
      netRwf: Number(r.netRwf),
      payeRwf: Number(r.payeRwf),
      employeeContributionsRwf: Number(r.employeeContributionsRwf),
      employerContributionsRwf: Number(r.employerContributionsRwf),
    };
  }

  /** The pay run list's field to column map (`PAY_RUN_LIST`); the totals are the business's, never a person's. */
  private readonly runListColumns: ListColumns = {
    periodStart: payRuns.periodStart,
    status: payRuns.status,
    headcount: this.runColumns.headcount,
    grossRwf: this.runColumns.grossRwf,
    netRwf: this.runColumns.netRwf,
  };

  /** One page of the business's pay runs, newest month first by default (AC-LF3). */
  async listRunsPage(orgId: string, query: ListQuery): Promise<ListRows<PayRunRow>> {
    const compiled = compileListQuery({
      spec: PAY_RUN_LIST,
      columns: this.runListColumns,
      reader: 'full',
      query,
      tieBreaker: payRuns.id,
    });
    const own = eq(payRuns.orgId, orgId);
    const where = compiled.where ? and(own, compiled.where) : own;
    const [rows, [{ count }], statusRows] = await Promise.all([
      this.db
        .select(this.runColumns)
        .from(payRuns)
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(compiled.limit)
        .offset(compiled.offset),
      this.db.select({ count: countAll }).from(payRuns).where(where),
      this.db
        .select({ value: payRuns.status, count: countAll })
        .from(payRuns)
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(payRuns.status),
    ]);
    return {
      rows: rows.map((r) => this.toRun(r)),
      total: Number(count),
      groups: undefined,
      statusCounts: statusCountsOf(statusRows),
    };
  }

  async findRun(id: string, tx?: Tx): Promise<PayRunRow | null> {
    const [row] = await (tx ?? this.db)
      .select(this.runColumns)
      .from(payRuns)
      .where(eq(payRuns.id, id))
      .limit(1);
    return row ? this.toRun(row) : null;
  }

  /** Lock the run row for a recompute or a confirm; null when there is none. */
  async lockRun(tx: Tx, id: string): Promise<{ id: string; orgId: string; status: PayRunStatus; periodStart: string } | null> {
    const [row] = await tx
      .select({ id: payRuns.id, orgId: payRuns.orgId, status: payRuns.status, periodStart: payRuns.periodStart })
      .from(payRuns)
      .where(eq(payRuns.id, id))
      .for('update')
      .limit(1);
    return row ?? null;
  }

  /** A new draft run. Null when the month already has one (`pay_runs_period_uk`). */
  async insertRun(
    tx: Tx,
    values: { orgId: string; periodStart: string; ruleVersions: PayRunRuleVersion[] },
  ): Promise<string | null> {
    const [row] = await tx
      .insert(payRuns)
      .values({ ...values, status: 'draft', computedAt: new Date() })
      .onConflictDoNothing({ target: [payRuns.orgId, payRuns.periodStart] })
      .returning({ id: payRuns.id });
    return row?.id ?? null;
  }

  async markComputed(tx: Tx, id: string, ruleVersions: PayRunRuleVersion[]): Promise<void> {
    await tx
      .update(payRuns)
      .set({ ruleVersions, computedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(payRuns.id, id), eq(payRuns.status, 'draft')));
  }

  async markConfirmed(tx: Tx, id: string, userId: string): Promise<void> {
    await tx
      .update(payRuns)
      .set({ status: 'confirmed', confirmedAt: new Date(), confirmedByUserId: userId, updatedAt: new Date() })
      .where(and(eq(payRuns.id, id), eq(payRuns.status, 'draft')));
  }

  /**
   * Every contract of the business whose dates overlap the month, whatever its
   * status or the file's (AC-Y1). Pay reads dates, never statuses.
   */
  async contractsOverlapping(orgId: string, first: string, last: string, tx?: Tx): Promise<ContractRow[]> {
    return (tx ?? this.db)
      .select({
        id: employmentContracts.id,
        orgId: employmentContracts.orgId,
        employeeId: employmentContracts.employeeId,
        contractType: employmentContracts.contractType,
        startsOn: employmentContracts.startsOn,
        endsOn: employmentContracts.endsOn,
        wageBasis: employmentContracts.wageBasis,
        wageRwf: employmentContracts.wageRwf,
        status: employmentContracts.status,
        endReason: employmentContracts.endReason,
      })
      .from(employmentContracts)
      .where(
        and(
          eq(employmentContracts.orgId, orgId),
          lte(employmentContracts.startsOn, last),
          or(isNull(employmentContracts.endsOn), gte(employmentContracts.endsOn, first)),
        ),
      )
      .orderBy(asc(employmentContracts.startsOn));
  }

  async coveredPeople(employeeIds: readonly string[], tx?: Tx): Promise<CoveredPerson[]> {
    if (employeeIds.length === 0) return [];
    return (tx ?? this.db)
      .select({
        employeeId: employees.id,
        preferredName: employees.preferredName,
        legalName: employees.legalName,
        rssbNumber: employees.rssbNumber,
        idDocumentType: employees.idDocumentType,
        idDocumentNumber: employees.idDocumentNumber,
      })
      .from(employees)
      .where(inArray(employees.id, [...employeeIds]));
  }

  /**
   * Attendance in the month that would make the figures wrong if frozen now: a
   * record still open, or a self record nobody validated (AC-Y3).
   */
  async unsettledAttendance(
    employeeIds: readonly string[],
    first: string,
    last: string,
    tx?: Tx,
  ): Promise<{ employeeId: string; open: boolean; unvalidatedSelf: boolean }[]> {
    if (employeeIds.length === 0) return [];
    const rows = await (tx ?? this.db)
      .select({
        employeeId: attendanceRecords.employeeId,
        status: attendanceRecords.status,
        source: attendanceRecords.source,
        validated: attendanceRecords.validated,
      })
      .from(attendanceRecords)
      .where(
        and(
          inArray(attendanceRecords.employeeId, [...employeeIds]),
          gte(attendanceRecords.workDate, first),
          lte(attendanceRecords.workDate, last),
          or(
            eq(attendanceRecords.status, 'open'),
            and(
              eq(attendanceRecords.source, 'self'),
              eq(attendanceRecords.validated, false),
              sql`${attendanceRecords.status} <> 'superseded'`,
            ),
          ),
        ),
      );
    return rows.map((r) => ({
      employeeId: r.employeeId,
      open: r.status === 'open',
      unvalidatedSelf: r.source === 'self' && !r.validated && r.status !== 'superseded',
    }));
  }

  /**
   * Write the computed payslips: insert new ones, overwrite the draft figures
   * of existing ones. Only ever called on a draft run, under its lock.
   */
  async upsertPayslips(
    tx: Tx,
    input: {
      orgId: string;
      payRunId: string;
      status: PayRunStatus;
      slips: (ComputedPayslip & { employeeId: string })[];
    },
  ): Promise<void> {
    for (const slip of input.slips) {
      const values = {
        orgId: input.orgId,
        payRunId: input.payRunId,
        employeeId: slip.employeeId,
        contractId: slip.contractId,
        payableDays: slip.payableDays,
        grossRwf: slip.grossRwf,
        payeRwf: slip.payeRwf,
        employeeContributionsRwf: slip.employeeContributionsRwf,
        employerContributionsRwf: slip.employerContributionsRwf,
        otherDeductionsRwf: slip.otherDeductionsRwf,
        netRwf: slip.netRwf,
        lines: slip.lines,
        status: input.status,
      };
      await tx
        .insert(payslips)
        .values(values)
        .onConflictDoUpdate({
          target: [payslips.payRunId, payslips.employeeId],
          set: { ...values, updatedAt: new Date() },
          // A confirmed payslip never changes (key invariant).
          setWhere: sql`${payslips.status} = 'draft'`,
        });
    }
  }

  /**
   * Drop DRAFT payslips of people the month no longer covers, such as someone
   * offboarded to before the month since the last compute. A draft has never
   * been issued; it is a preview of the run, and keeping a stale one would
   * put a leaver's pay into a frozen month.
   */
  async dropStaleDrafts(tx: Tx, payRunId: string, keep: readonly string[]): Promise<void> {
    const where = [eq(payslips.payRunId, payRunId), eq(payslips.status, 'draft')];
    if (keep.length > 0) where.push(notInArray(payslips.employeeId, [...keep]));
    await tx.delete(payslips).where(and(...where));
  }

  async payslips(payRunId: string, tx?: Tx): Promise<PayslipRow[]> {
    const rows = await (tx ?? this.db)
      .select({
        id: payslips.id,
        employeeId: payslips.employeeId,
        employeeNumber: employees.employeeNumber,
        preferredName: employees.preferredName,
        legalName: employees.legalName,
        contractId: payslips.contractId,
        payableDays: payslips.payableDays,
        grossRwf: payslips.grossRwf,
        payeRwf: payslips.payeRwf,
        employeeContributionsRwf: payslips.employeeContributionsRwf,
        employerContributionsRwf: payslips.employerContributionsRwf,
        otherDeductionsRwf: payslips.otherDeductionsRwf,
        netRwf: payslips.netRwf,
        lines: sql<PayslipLine[]>`${payslips.lines}`,
        status: payslips.status,
      })
      .from(payslips)
      .innerJoin(employees, eq(employees.id, payslips.employeeId))
      .where(eq(payslips.payRunId, payRunId))
      .orderBy(asc(employees.employeeNumber));
    return rows;
  }
}
