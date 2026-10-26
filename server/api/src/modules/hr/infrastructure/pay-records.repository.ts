import {
  CONTRACT_LIST,
  MAX_BULK_IDS,
  PAYSLIP_LIST,
  type ListIds,
  type ListQuery,
  type PaidMethod,
  type PayDeclarationKind,
  type PayExportKind,
  type PayRunStatus,
  type PayslipLine,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  attendanceRecords,
  configEntries,
  departmentMembers,
  employeeLoans,
  employeePayAccounts,
  employees,
  employmentContracts,
  hrSettings,
  jobPositions,
  leaveLedgerEntries,
  leaveRequests,
  loanInstallments,
  orgs,
  payAdjustments,
  payClaims,
  payDeclarations,
  payExports,
  payRuns,
  payslips,
  users,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  compileListQuery,
  countAll,
  groupOrder,
  groupsOf,
  statusCountsOf,
  type ListRows,
} from '../../../shared/lists/list-query';
import type { Tx } from './employees.repository';
import { refLabels } from './hr-labels';

const personName = sql<string>`coalesce(nullif(btrim(${employees.preferredName}), ''), ${employees.legalName})`;
const marker = alias(users, 'marker');

export interface PayslipListRow {
  id: string;
  orgId: string;
  payRunId: string;
  period: string;
  employeeId: string;
  employeeNumber: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  grossRwf: number;
  netRwf: number;
  status: PayRunStatus;
  paidAt: Date | null;
  paidMethod: PaidMethod | null;
  paidReference: string | null;
  sentAt: Date | null;
}

export interface PayslipFullRow extends PayslipListRow {
  contractId: string;
  payableDays: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  otherDeductionsRwf: number;
  nonIncomeRwf: number;
  lines: PayslipLine[];
  snapshot: PayslipSnapshot | null;
}

/** The business and the person as they were the day a run was confirmed (AC-PY11). */
export interface PayslipSnapshot {
  businessName: string;
  tin: string | null;
  rssbEmployerNumber: string | null;
  personName: string;
  employeeNumber: string;
  jobPosition: string | null;
  rssbNumber: string | null;
  idNumber: string | null;
  payAccount: string | null;
  confirmedOn: string;
}

export interface ContractListRow {
  id: string;
  orgId: string;
  employeeId: string;
  employeeNumber: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  contractType: string;
  startsOn: string;
  endsOn: string | null;
  wageBasis: 'monthly' | 'daily' | 'hourly';
  wageRwf: number;
  status: string;
  payStructureId: string | null;
  noticeDays: number | null;
}

/** A person as the run's components and settlement read them, on the month's first day. */
export interface PaySubjectRow {
  employeeId: string;
  sex: string | null;
  maritalStatus: string | null;
  childrenCount: number | null;
  hiredOn: string;
  priorExperienceYears: number | null;
  employeeTypeId: string | null;
  jobPositionId: string | null;
  workPropertyId: string | null;
  offboardedOn: string | null;
  status: 'active' | 'offboarded';
}

/**
 * The records payroll keeps besides runs and payslip figures (058-payroll):
 * paid status, the files a confirmed run produces, the contracts list, the
 * rules in force, the dashboard, and the reads a run's computation needs. The
 * only place that touches Drizzle for them.
 */
@Injectable()
export class PayRecordsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Payslips across runs and paid status (AC-PY10) ------------------------------------

  private readonly listColumns = {
    id: payslips.id,
    orgId: payslips.orgId,
    payRunId: payslips.payRunId,
    period: sql<string>`to_char(${payRuns.periodStart}, 'YYYY-MM')`,
    employeeId: payslips.employeeId,
    employeeNumber: employees.employeeNumber,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    grossRwf: payslips.grossRwf,
    netRwf: payslips.netRwf,
    status: payslips.status,
    paidAt: payslips.paidAt,
    paidMethod: payslips.paidMethod,
    paidReference: payslips.paidReference,
    sentAt: payslips.sentAt,
  };

  private readonly fullColumns = {
    ...this.listColumns,
    contractId: payslips.contractId,
    payableDays: payslips.payableDays,
    payeRwf: payslips.payeRwf,
    employeeContributionsRwf: payslips.employeeContributionsRwf,
    employerContributionsRwf: payslips.employerContributionsRwf,
    otherDeductionsRwf: payslips.otherDeductionsRwf,
    nonIncomeRwf: payslips.nonIncomeRwf,
    lines: sql<PayslipLine[]>`${payslips.lines}`,
    snapshot: sql<PayslipSnapshot | null>`${payslips.snapshot}`,
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private listSlips(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.listColumns)
      .from(payslips)
      .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
      .innerJoin(employees, eq(employees.id, payslips.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId));
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private fullSlips(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.fullColumns)
      .from(payslips)
      .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
      .innerJoin(employees, eq(employees.id, payslips.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId));
  }

  private slipQuery(input: { orgId: string; scope: BranchScope; query: ListQuery }): { compiled: ReturnType<typeof compileListQuery>; own: SQL | undefined; where: SQL | undefined } {
    const compiled = compileListQuery({
      spec: PAYSLIP_LIST,
      columns: {
        period: sql`to_char(${payRuns.periodStart}, 'YYYY-MM')`,
        employee: personName,
        branch: employees.workPropertyId,
        status: payslips.status,
        paid: sql`(${payslips.paidAt} is not null)`,
        paidMethod: payslips.paidMethod,
        netRwf: payslips.netRwf,
      },
      reader: 'full',
      query: input.query,
      tieBreaker: payslips.id,
    });
    const own = and(eq(payslips.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    return { compiled, own, where: compiled.where ? and(own, compiled.where) : own };
  }

  async payslipPage(input: { orgId: string; scope: BranchScope; query: ListQuery }): Promise<ListRows<PayslipListRow>> {
    const { compiled, own, where } = this.slipQuery(input);
    // Counts and groups need only the run (its period) and the file (name, branch).
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.listSlips().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.slipCounts().where(where),
      this.db
        .select({ value: payslips.status, count: countAll })
        .from(payslips)
        .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
        .innerJoin(employees, eq(employees.id, payslips.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(payslips.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(payslips)
            .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
            .innerJoin(employees, eq(employees.id, payslips.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows: rows as PayslipListRow[],
      total: Number(count),
      groups: groupsOf(PAYSLIP_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows as { value: string; count: number }[]),
    };
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private slipCounts() {
    return this.db
      .select({ count: countAll })
      .from(payslips)
      .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
      .innerJoin(employees, eq(employees.id, payslips.employeeId));
  }

  async payslipIds(input: { orgId: string; scope: BranchScope; query: ListQuery }): Promise<ListIds> {
    const { compiled, where } = this.slipQuery(input);
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({ id: payslips.id })
        .from(payslips)
        .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
        .innerJoin(employees, eq(employees.id, payslips.employeeId))
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(MAX_BULK_IDS),
      this.slipCounts().where(where),
    ]);
    return { ids: rows.map((r) => r.id), total: Number(count) };
  }

  async findPayslip(id: string, tx?: Tx): Promise<PayslipFullRow | null> {
    const [row] = await this.fullSlips(tx).where(eq(payslips.id, id)).limit(1);
    return (row as PayslipFullRow | undefined) ?? null;
  }

  /** A run's payslips in full, in employee number order: the PDF and the files read these. */
  async payslipsOfRun(payRunId: string, tx?: Tx): Promise<PayslipFullRow[]> {
    return (await this.fullSlips(tx).where(eq(payslips.payRunId, payRunId)).orderBy(asc(employees.employeeNumber))) as PayslipFullRow[];
  }

  /** A person's confirmed payslips, newest first (058-self-service AC-SS7). */
  async confirmedOf(employeeId: string): Promise<PayslipListRow[]> {
    return (await this.listSlips()
      .where(and(eq(payslips.employeeId, employeeId), eq(payslips.status, 'confirmed')))
      .orderBy(desc(payRuns.periodStart))) as PayslipListRow[];
  }

  /** Mark a confirmed payslip paid, once (AC-PY10). False when it is not confirmed or already paid. */
  async markPaid(tx: Tx, id: string, values: { paidAt: Date; method: PaidMethod; reference: string; userId: string }): Promise<boolean> {
    const rows = await tx
      .update(payslips)
      .set({ paidAt: values.paidAt, paidMethod: values.method, paidReference: values.reference, markedPaidByUserId: values.userId, updatedAt: new Date() })
      .where(and(eq(payslips.id, id), eq(payslips.status, 'confirmed'), isNull(payslips.paidAt)))
      .returning({ id: payslips.id });
    return rows.length > 0;
  }

  async unmarkPaid(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
      .update(payslips)
      .set({ paidAt: null, paidMethod: null, paidReference: null, markedPaidByUserId: null, updatedAt: new Date() })
      .where(and(eq(payslips.id, id), isNotNull(payslips.paidAt)))
      .returning({ id: payslips.id });
    return rows.length > 0;
  }

  async setSnapshot(tx: Tx, id: string, snapshot: PayslipSnapshot): Promise<void> {
    await tx.update(payslips).set({ snapshot, updatedAt: new Date() }).where(eq(payslips.id, id));
  }

  async markSent(id: string): Promise<void> {
    await this.db.update(payslips).set({ sentAt: new Date() }).where(and(eq(payslips.id, id), isNull(payslips.sentAt)));
  }

  // --- Exports and declarations (AC-PY10, AC-PY12) -------------------------------------------

  async insertExport(tx: Tx, values: { orgId: string; payRunId: string; kind: PayExportKind; fileKey: string; rowCount: number; totalRwf: number; createdByUserId: string }): Promise<string> {
    const [row] = await tx.insert(payExports).values(values).returning({ id: payExports.id });
    return row.id;
  }

  async insertDeclaration(tx: Tx, values: { orgId: string; payRunId: string; kind: PayDeclarationKind; formatVersion: string; fileKey: string; createdByUserId: string }): Promise<string> {
    const [row] = await tx.insert(payDeclarations).values(values).returning({ id: payDeclarations.id });
    return row.id;
  }

  async filesOfRun(payRunId: string): Promise<
    { id: string; kind: PayExportKind | PayDeclarationKind; rowCount: number | null; totalRwf: number | null; formatVersion: string | null; fileKey: string; createdAt: Date; createdByName: string | null }[]
  > {
    const [exportsRows, declarations] = await Promise.all([
      this.db
        .select({ id: payExports.id, kind: payExports.kind, rowCount: payExports.rowCount, totalRwf: payExports.totalRwf, fileKey: payExports.fileKey, createdAt: payExports.createdAt, createdByName: marker.name })
        .from(payExports)
        .leftJoin(marker, eq(marker.id, payExports.createdByUserId))
        .where(eq(payExports.payRunId, payRunId)),
      this.db
        .select({ id: payDeclarations.id, kind: payDeclarations.kind, formatVersion: payDeclarations.formatVersion, fileKey: payDeclarations.fileKey, createdAt: payDeclarations.createdAt, createdByName: marker.name })
        .from(payDeclarations)
        .leftJoin(marker, eq(marker.id, payDeclarations.createdByUserId))
        .where(eq(payDeclarations.payRunId, payRunId)),
    ]);
    return [
      ...exportsRows.map((e) => ({ ...e, formatVersion: null })),
      ...declarations.map((d) => ({ ...d, rowCount: null, totalRwf: null })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findFile(id: string): Promise<{ orgId: string; payRunId: string; fileKey: string } | null> {
    const [e] = await this.db.select({ orgId: payExports.orgId, payRunId: payExports.payRunId, fileKey: payExports.fileKey }).from(payExports).where(eq(payExports.id, id)).limit(1);
    if (e) return e;
    const [d] = await this.db
      .select({ orgId: payDeclarations.orgId, payRunId: payDeclarations.payRunId, fileKey: payDeclarations.fileKey })
      .from(payDeclarations)
      .where(eq(payDeclarations.id, id))
      .limit(1);
    return d ?? null;
  }

  // --- Every contract (AC-PY15) ------------------------------------------------------------

  private readonly contractColumns = {
    id: employmentContracts.id,
    orgId: employmentContracts.orgId,
    employeeId: employmentContracts.employeeId,
    employeeNumber: employees.employeeNumber,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    contractType: employmentContracts.contractType,
    startsOn: employmentContracts.startsOn,
    endsOn: employmentContracts.endsOn,
    wageBasis: employmentContracts.wageBasis,
    wageRwf: employmentContracts.wageRwf,
    status: employmentContracts.status,
    payStructureId: employmentContracts.payStructureId,
    noticeDays: employmentContracts.noticeDays,
  };

  async contractPage(input: { orgId: string; scope: BranchScope; query: ListQuery }): Promise<ListRows<ContractListRow>> {
    const compiled = compileListQuery({
      spec: CONTRACT_LIST,
      columns: {
        employee: personName,
        status: employmentContracts.status,
        wageBasis: employmentContracts.wageBasis,
        branch: employees.workPropertyId,
        startsOn: employmentContracts.startsOn,
        endsOn: employmentContracts.endsOn,
      },
      reader: 'full',
      query: input.query,
      tieBreaker: employmentContracts.id,
    });
    const own = and(eq(employmentContracts.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    const where = compiled.where ? and(own, compiled.where) : own;
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.db
        .select(this.contractColumns)
        .from(employmentContracts)
        .innerJoin(employees, eq(employees.id, employmentContracts.employeeId))
        .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(compiled.limit)
        .offset(compiled.offset),
      this.db
        .select({ count: countAll })
        .from(employmentContracts)
        .innerJoin(employees, eq(employees.id, employmentContracts.employeeId))
        .where(where),
      this.db
        .select({ value: employmentContracts.status, count: countAll })
        .from(employmentContracts)
        .innerJoin(employees, eq(employees.id, employmentContracts.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(employmentContracts.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(employmentContracts)
            .innerJoin(employees, eq(employees.id, employmentContracts.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows: rows as ContractListRow[],
      total: Number(count),
      groups: groupsOf(CONTRACT_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows as { value: string; count: number }[]),
    };
  }

  async findContract(id: string, tx?: Tx): Promise<ContractListRow | null> {
    const [row] = await (tx ?? this.db)
      .select(this.contractColumns)
      .from(employmentContracts)
      .innerJoin(employees, eq(employees.id, employmentContracts.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(eq(employmentContracts.id, id))
      .limit(1);
    return row ?? null;
  }

  /** Contracts overlapping a month with the structure each carries (the run reads these). */
  async contractsWithStructure(orgId: string, first: string, last: string, tx?: Tx): Promise<{ id: string; employeeId: string; startsOn: string; endsOn: string | null; wageBasis: 'monthly' | 'daily' | 'hourly'; wageRwf: number; payStructureId: string | null }[]> {
    return (tx ?? this.db)
      .select({
        id: employmentContracts.id,
        employeeId: employmentContracts.employeeId,
        startsOn: employmentContracts.startsOn,
        endsOn: employmentContracts.endsOn,
        wageBasis: employmentContracts.wageBasis,
        wageRwf: employmentContracts.wageRwf,
        payStructureId: employmentContracts.payStructureId,
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

  // --- The reads a run's computation needs ---------------------------------------------------

  /** Closed, validated, current attendance of these people in the month (AC-PY2, AC-PY4). */
  async workInMonth(
    employeeIds: readonly string[],
    first: string,
    last: string,
    tx?: Tx,
  ): Promise<{ employeeId: string; workDate: string; workedMinutes: number; approvedOvertimeMinutes: number; dayKind: 'weekday' | 'weekly_off' | 'public_holiday' | null; workPropertyId: string | null }[]> {
    if (employeeIds.length === 0) return [];
    const rows = await (tx ?? this.db)
      .select({
        employeeId: attendanceRecords.employeeId,
        workDate: attendanceRecords.workDate,
        workedMinutes: attendanceRecords.workedMinutes,
        approvedOvertimeMinutes: attendanceRecords.approvedOvertimeMinutes,
        dayKind: attendanceRecords.dayKind,
        workPropertyId: employees.workPropertyId,
      })
      .from(attendanceRecords)
      .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
      .where(
        and(
          inArray(attendanceRecords.employeeId, [...employeeIds]),
          gte(attendanceRecords.workDate, first),
          lte(attendanceRecords.workDate, last),
          eq(attendanceRecords.status, 'closed'),
          eq(attendanceRecords.validated, true),
        ),
      );
    return rows.map((r) => ({
      employeeId: r.employeeId,
      workDate: r.workDate,
      workedMinutes: r.workedMinutes ?? 0,
      approvedOvertimeMinutes: r.approvedOvertimeMinutes ?? 0,
      dayKind: r.dayKind,
      workPropertyId: r.workPropertyId,
    }));
  }

  /**
   * Every `taken` and `reversal` row of a leave request dated in the month, with
   * the pay terms the request was made under (AC-PY2, AC-PY3): unpaid and partly
   * paid leave on a monthly wage, paid leave on a daily or hourly one.
   */
  async leaveInMonth(orgId: string, first: string, last: string, tx?: Tx): Promise<{ employeeId: string; days: number; effectiveOn: string; payment: 'paid' | 'unpaid' | 'partial'; paymentPercent: number | null }[]> {
    return (tx ?? this.db)
      .select({
        employeeId: leaveLedgerEntries.employeeId,
        days: leaveLedgerEntries.days,
        effectiveOn: leaveLedgerEntries.effectiveOn,
        payment: leaveRequests.payment,
        paymentPercent: leaveRequests.paymentPercent,
      })
      .from(leaveLedgerEntries)
      .innerJoin(leaveRequests, eq(leaveRequests.id, leaveLedgerEntries.leaveRequestId))
      .where(
        and(
          eq(leaveLedgerEntries.orgId, orgId),
          inArray(leaveLedgerEntries.kind, ['taken', 'reversal']),
          gte(leaveLedgerEntries.effectiveOn, first),
          lte(leaveLedgerEntries.effectiveOn, last),
        ),
      );
  }

  async subjects(employeeIds: readonly string[], tx?: Tx): Promise<PaySubjectRow[]> {
    if (employeeIds.length === 0) return [];
    return (tx ?? this.db)
      .select({
        employeeId: employees.id,
        sex: employees.sex,
        maritalStatus: employees.maritalStatus,
        childrenCount: employees.childrenCount,
        hiredOn: employees.hiredOn,
        priorExperienceYears: employees.priorExperienceYears,
        employeeTypeId: employees.employeeTypeId,
        jobPositionId: employees.jobPositionId,
        workPropertyId: employees.workPropertyId,
        offboardedOn: employees.offboardedOn,
        status: employees.status,
      })
      .from(employees)
      .where(inArray(employees.id, [...employeeIds]));
  }

  async departmentsOf(employeeIds: readonly string[], tx?: Tx): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (employeeIds.length === 0) return out;
    const rows = await (tx ?? this.db)
      .select({ employeeId: departmentMembers.employeeId, departmentId: departmentMembers.departmentId })
      .from(departmentMembers)
      .where(and(inArray(departmentMembers.employeeId, [...employeeIds]), eq(departmentMembers.status, 'active')));
    for (const r of rows) {
      if (!r.employeeId) continue;
      out.set(r.employeeId, [...(out.get(r.employeeId) ?? []), r.departmentId]);
    }
    return out;
  }

  // --- The business and its people, for a snapshot and the files ------------------------------

  async business(orgId: string, tx?: Tx): Promise<{ name: string; tin: string | null; rssbEmployerNumber: string | null }> {
    const [org] = await (tx ?? this.db).select({ name: orgs.legalName, tin: orgs.tin }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    const [settings] = await (tx ?? this.db).select({ rssb: hrSettings.rssbEmployerNumber }).from(hrSettings).where(eq(hrSettings.orgId, orgId)).limit(1);
    return { name: org?.name ?? '', tin: org?.tin ?? null, rssbEmployerNumber: settings?.rssb ?? null };
  }

  async people(employeeIds: readonly string[], tx?: Tx): Promise<{ employeeId: string; preferredName: string | null; legalName: string; employeeNumber: string; jobPositionTitle: string | null; rssbNumber: string | null; idDocumentNumber: string | null; phone: string | null }[]> {
    if (employeeIds.length === 0) return [];
    return (tx ?? this.db)
      .select({
        employeeId: employees.id,
        preferredName: employees.preferredName,
        legalName: employees.legalName,
        employeeNumber: employees.employeeNumber,
        jobPositionTitle: jobPositions.title,
        rssbNumber: employees.rssbNumber,
        idDocumentNumber: employees.idDocumentNumber,
        phone: employees.phone,
      })
      .from(employees)
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(inArray(employees.id, [...employeeIds]));
  }

  /** Each person's active primary pay account (AC-PY10). */
  async primaryAccounts(employeeIds: readonly string[], tx?: Tx): Promise<Map<string, { kind: 'bank' | 'momo'; bankName: string | null; accountNumber: string | null; branchName: string | null; momoPhone: string | null }>> {
    const out = new Map<string, { kind: 'bank' | 'momo'; bankName: string | null; accountNumber: string | null; branchName: string | null; momoPhone: string | null }>();
    if (employeeIds.length === 0) return out;
    const rows = await (tx ?? this.db)
      .select({
        employeeId: employeePayAccounts.employeeId,
        kind: employeePayAccounts.kind,
        bankName: employeePayAccounts.bankName,
        accountNumber: employeePayAccounts.accountNumber,
        branchName: employeePayAccounts.branchName,
        momoPhone: employeePayAccounts.momoPhone,
      })
      .from(employeePayAccounts)
      .where(and(inArray(employeePayAccounts.employeeId, [...employeeIds]), eq(employeePayAccounts.isPrimary, true), eq(employeePayAccounts.status, 'active')));
    for (const r of rows) out.set(r.employeeId, { kind: r.kind, bankName: r.bankName, accountNumber: r.accountNumber, branchName: r.branchName, momoPhone: r.momoPhone });
    return out;
  }

  // --- The rules in force and the dashboard (AC-PY15) ----------------------------------------

  async ruleRows(types: readonly string[]): Promise<{ id: string; configType: string; version: number; value: unknown; effectiveFrom: Date | null; effectiveTo: Date | null }[]> {
    return this.db
      .select({
        id: configEntries.id,
        configType: configEntries.configType,
        version: configEntries.version,
        value: configEntries.value,
        effectiveFrom: configEntries.effectiveFrom,
        effectiveTo: configEntries.effectiveTo,
      })
      .from(configEntries)
      .where(inArray(configEntries.configType, [...types]))
      .orderBy(asc(configEntries.configType), desc(configEntries.version));
  }

  async dashboard(orgId: string): Promise<{
    months: { period: string; status: PayRunStatus; headcount: number; grossRwf: number; netRwf: number; payeRwf: number; employeeContributionsRwf: number; employerContributionsRwf: number }[];
    openLoansRwf: number;
    claimsWaiting: number;
    adjustmentsOpen: number;
    unpaidPayslips: number;
  }> {
    const months = await this.db
      .select({
        period: sql<string>`to_char(${payRuns.periodStart}, 'YYYY-MM')`,
        status: payRuns.status,
        headcount: sql<number>`count(${payslips.id})::int`,
        grossRwf: sql<number>`coalesce(sum(${payslips.grossRwf}), 0)::bigint`,
        netRwf: sql<number>`coalesce(sum(${payslips.netRwf}), 0)::bigint`,
        payeRwf: sql<number>`coalesce(sum(${payslips.payeRwf}), 0)::bigint`,
        employeeContributionsRwf: sql<number>`coalesce(sum(${payslips.employeeContributionsRwf}), 0)::bigint`,
        employerContributionsRwf: sql<number>`coalesce(sum(${payslips.employerContributionsRwf}), 0)::bigint`,
      })
      .from(payRuns)
      .leftJoin(payslips, eq(payslips.payRunId, payRuns.id))
      .where(eq(payRuns.orgId, orgId))
      .groupBy(payRuns.id, payRuns.periodStart, payRuns.status)
      .orderBy(desc(payRuns.periodStart))
      .limit(12);
    const [[loans], [claims], [adjustments], [unpaid]] = await Promise.all([
      this.db
        .select({ total: sql<number>`coalesce(sum(${loanInstallments.amountRwf}), 0)::bigint` })
        .from(loanInstallments)
        .where(and(eq(loanInstallments.orgId, orgId), isNull(loanInstallments.payslipId))),
      this.db.select({ count: countAll }).from(payClaims).where(and(eq(payClaims.orgId, orgId), eq(payClaims.status, 'requested'))),
      this.db.select({ count: countAll }).from(payAdjustments).where(and(eq(payAdjustments.orgId, orgId), eq(payAdjustments.status, 'open'))),
      this.db
        .select({ count: countAll })
        .from(payslips)
        .where(and(eq(payslips.orgId, orgId), eq(payslips.status, 'confirmed'), isNull(payslips.paidAt))),
    ]);
    return {
      months: months.map((m) => ({
        ...m,
        headcount: Number(m.headcount),
        grossRwf: Number(m.grossRwf),
        netRwf: Number(m.netRwf),
        payeRwf: Number(m.payeRwf),
        employeeContributionsRwf: Number(m.employeeContributionsRwf),
        employerContributionsRwf: Number(m.employerContributionsRwf),
      })),
      openLoansRwf: Number(loans?.total ?? 0),
      claimsWaiting: Number(claims?.count ?? 0),
      adjustmentsOpen: Number(adjustments?.count ?? 0),
      unpaidPayslips: Number(unpaid?.count ?? 0),
    };
  }

  // --- The month fence (AC-PY17) ---------------------------------------------------------------

  /**
   * Lock a month's run row FOR SHARE and answer its status, or null when the
   * month has no run. Every write that changes a month's pay takes this before
   * deciding, and confirm takes the same row FOR UPDATE, so nothing lands in a
   * month between the confirm's computation and its freeze.
   */
  async fenceMonth(tx: Tx, orgId: string, period: string): Promise<PayRunStatus | null> {
    const [row] = await tx
      .select({ status: payRuns.status })
      .from(payRuns)
      .where(and(eq(payRuns.orgId, orgId), eq(payRuns.periodStart, `${period}-01`)))
      .for('share')
      .limit(1);
    return row?.status ?? null;
  }

  /** The first month on or after `from` with no confirmed run: where a late claim or an adjustment lands. */
  async nextOpenPeriod(orgId: string, from: string, tx?: Tx): Promise<string> {
    const rows = await (tx ?? this.db)
      .select({ period: sql<string>`to_char(${payRuns.periodStart}, 'YYYY-MM')` })
      .from(payRuns)
      .where(and(eq(payRuns.orgId, orgId), eq(payRuns.status, 'confirmed'), gte(payRuns.periodStart, `${from}-01`)))
      .orderBy(asc(payRuns.periodStart));
    let period = from;
    for (const r of rows) {
      if (r.period !== period) break;
      const [y, m] = period.split('-').map(Number);
      period = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
    return period;
  }

  /** Businesses whose automatic draft day is today (AC-PY14). */
  /** Businesses whose automatic draft day is `day` and whose `period` has no run yet (AC-PY14). */
  async autoDraftOrgs(day: number, period: string): Promise<string[]> {
    const rows = await this.db
      .select({ orgId: hrSettings.orgId })
      .from(hrSettings)
      .where(
        and(
          eq(hrSettings.payRunAutoDraftDay, day),
          sql`not exists (select 1 from ${payRuns} where ${payRuns.orgId} = ${hrSettings.orgId} and ${payRuns.periodStart} = ${`${period}-01`})`,
        ),
      );
    return rows.map((r) => r.orgId);
  }

  /** A loan's employee, for the self service and the routes that act on one. */
  async loanEmployee(loanId: string): Promise<string | null> {
    const [row] = await this.db.select({ employeeId: employeeLoans.employeeId }).from(employeeLoans).where(eq(employeeLoans.id, loanId)).limit(1);
    return row?.employeeId ?? null;
  }

  /** Whether any active file of these ids is not the business's. */
  async notOurs(orgId: string, ids: readonly string[]): Promise<boolean> {
    if (ids.length === 0) return false;
    const rows = await this.db.select({ id: employees.id }).from(employees).where(and(inArray(employees.id, [...ids]), ne(employees.orgId, orgId))).limit(1);
    return rows.length > 0;
  }
}
