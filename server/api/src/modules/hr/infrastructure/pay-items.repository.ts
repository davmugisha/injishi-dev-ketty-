import {
  LOAN_LIST,
  MAX_BULK_IDS,
  PAY_ADJUSTMENT_LIST,
  PAY_CLAIM_LIST,
  type ListIds,
  type ListQuery,
  type LoanKind,
  type LoanPaidOut,
  type PayAdjustmentSide,
  type PayAdjustmentSource,
  type PayAdjustmentStatus,
  type PayAmountType,
  type PayClaimKind,
  type PayClaimStatus,
  type PayComponentKind,
  type PayConditionField,
  type PayConditionOp,
  type PayTargetMode,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  employeeLoans,
  employees,
  employmentContracts,
  jobPositions,
  leaveTypes,
  loanInstallments,
  payAdjustments,
  payClaims,
  payComponents,
  payComponentTargets,
  payStructureComponents,
  payStructures,
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
const decider = alias(users, 'decider');

export interface ComponentRow {
  id: string;
  orgId: string;
  code: string;
  name: string;
  kind: PayComponentKind;
  taxable: boolean;
  inContributionBase: boolean;
  beforeTax: boolean;
  amountType: PayAmountType;
  amountRwf: number | null;
  rate: number | null;
  capRwf: number | null;
  conditionField: PayConditionField | null;
  conditionOp: PayConditionOp | null;
  conditionValue: string | null;
  appliesAllActive: boolean;
  oneOffPeriod: string | null;
  status: 'active' | 'archived';
}

export type ComponentValues = Omit<ComponentRow, 'id' | 'orgId' | 'code' | 'status'>;

export interface PersonCard {
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
}

export interface LoanRow extends PersonCard {
  id: string;
  orgId: string;
  kind: LoanKind;
  amountRwf: number;
  givenOn: string;
  installments: number;
  firstPeriod: string;
  paidOut: LoanPaidOut;
  reason: string | null;
  paidOutPayslipId: string | null;
  settledAt: Date | null;
  createdAt: Date;
}

export interface InstallmentRow {
  id: string;
  loanId: string;
  period: string;
  amountRwf: number;
  deferredFrom: string | null;
  payslipId: string | null;
}

export interface ClaimRow extends PersonCard {
  id: string;
  orgId: string;
  kind: PayClaimKind;
  amountRwf: number | null;
  leaveTypeId: string | null;
  leaveTypeName: string | null;
  days: number | null;
  period: string;
  receiptKey: string | null;
  reason: string;
  status: PayClaimStatus;
  decidedAt: Date | null;
  decidedByName: string | null;
  decisionNote: string | null;
  payslipId: string | null;
  createdAt: Date;
}

export interface AdjustmentRow extends PersonCard {
  id: string;
  orgId: string;
  side: PayAdjustmentSide;
  amountRwf: number;
  taxable: boolean;
  contributable: boolean;
  correctsPeriod: string;
  reason: string;
  source: PayAdjustmentSource;
  sourceId: string | null;
  status: PayAdjustmentStatus;
  payslipId: string | null;
  paidInPeriod: string | null;
  createdAt: Date;
}

const card = {
  employeeId: employees.id,
  preferredName: employees.preferredName,
  legalName: employees.legalName,
  jobPositionTitle: jobPositions.title,
  workPropertyId: employees.workPropertyId,
};

/**
 * Pay components and structures, loans, claims and pay adjustments
 * (058-payroll). The only place that touches Drizzle for them. A loan's
 * schedule is written with it and only an unpaid installment ever moves; a
 * claim, an installment or an adjustment is stamped with the payslip that paid
 * it once, at confirm, and never again.
 */
@Injectable()
export class PayItemsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Components and structures (AC-PY5) -----------------------------------------------

  private readonly componentColumns = {
    id: payComponents.id,
    orgId: payComponents.orgId,
    code: payComponents.code,
    name: payComponents.name,
    kind: payComponents.kind,
    taxable: payComponents.taxable,
    inContributionBase: payComponents.inContributionBase,
    beforeTax: payComponents.beforeTax,
    amountType: payComponents.amountType,
    amountRwf: payComponents.amountRwf,
    rate: payComponents.rate,
    capRwf: payComponents.capRwf,
    conditionField: payComponents.conditionField,
    conditionOp: payComponents.conditionOp,
    conditionValue: payComponents.conditionValue,
    appliesAllActive: payComponents.appliesAllActive,
    oneOffPeriod: payComponents.oneOffPeriod,
    status: payComponents.status,
  };

  async components(orgId: string, tx?: Tx, activeOnly = false): Promise<ComponentRow[]> {
    const where = [eq(payComponents.orgId, orgId)];
    if (activeOnly) where.push(eq(payComponents.status, 'active'));
    return (tx ?? this.db)
      .select(this.componentColumns)
      .from(payComponents)
      .where(and(...where))
      .orderBy(asc(payComponents.kind), asc(payComponents.name));
  }

  async findComponent(id: string, tx?: Tx): Promise<ComponentRow | null> {
    const [row] = await (tx ?? this.db).select(this.componentColumns).from(payComponents).where(eq(payComponents.id, id)).limit(1);
    return row ?? null;
  }

  /** Throws 23505 on `pay_components_code_uk`. */
  async insertComponent(tx: Tx, values: ComponentValues & { orgId: string; code: string; createdByUserId: string }): Promise<string> {
    const [row] = await tx.insert(payComponents).values(values).returning({ id: payComponents.id });
    return row.id;
  }

  async updateComponent(tx: Tx, id: string, values: Partial<ComponentValues> & { status?: 'active' | 'archived' }): Promise<void> {
    if (Object.keys(values).length === 0) return;
    await tx.update(payComponents).set({ ...values, updatedAt: new Date() }).where(eq(payComponents.id, id));
  }

  async targets(componentIds: readonly string[], tx?: Tx): Promise<{ componentId: string; employeeId: string; mode: PayTargetMode; displayName: string }[]> {
    if (componentIds.length === 0) return [];
    return (tx ?? this.db)
      .select({ componentId: payComponentTargets.componentId, employeeId: payComponentTargets.employeeId, mode: payComponentTargets.mode, displayName: personName })
      .from(payComponentTargets)
      .innerJoin(employees, eq(employees.id, payComponentTargets.employeeId))
      .where(inArray(payComponentTargets.componentId, [...componentIds]))
      .orderBy(asc(personName));
  }

  async replaceTargets(tx: Tx, orgId: string, componentId: string, targets: readonly { employeeId: string; mode: PayTargetMode }[]): Promise<void> {
    await tx.delete(payComponentTargets).where(eq(payComponentTargets.componentId, componentId));
    const unique = new Map(targets.map((t) => [t.employeeId, t.mode]));
    if (unique.size > 0) {
      await tx.insert(payComponentTargets).values([...unique].map(([employeeId, mode]) => ({ orgId, componentId, employeeId, mode })));
    }
  }

  /** Every file of these ids that belongs to the business, for checking a target list. */
  async ownEmployees(orgId: string, ids: readonly string[], tx?: Tx): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await (tx ?? this.db)
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), inArray(employees.id, [...ids])));
    return rows.map((r) => r.id);
  }

  async structures(orgId: string, tx?: Tx): Promise<{ id: string; name: string; status: 'active' | 'archived'; componentIds: string[]; contractCount: number }[]> {
    const db = tx ?? this.db;
    const rows = await db
      .select({
        id: payStructures.id,
        name: payStructures.name,
        status: payStructures.status,
        contractCount: sql<number>`(select count(*)::int from "employment_contracts" c where c.pay_structure_id = "pay_structures"."id" and c.status <> 'ended')`,
      })
      .from(payStructures)
      .where(eq(payStructures.orgId, orgId))
      .orderBy(asc(payStructures.name));
    if (rows.length === 0) return [];
    const links = await db
      .select({ structureId: payStructureComponents.structureId, componentId: payStructureComponents.componentId })
      .from(payStructureComponents)
      .where(inArray(payStructureComponents.structureId, rows.map((r) => r.id)));
    return rows.map((r) => ({
      ...r,
      contractCount: Number(r.contractCount),
      componentIds: links.filter((l) => l.structureId === r.id).map((l) => l.componentId),
    }));
  }

  async findStructure(id: string, tx?: Tx): Promise<{ id: string; orgId: string; name: string; status: 'active' | 'archived' } | null> {
    const [row] = await (tx ?? this.db)
      .select({ id: payStructures.id, orgId: payStructures.orgId, name: payStructures.name, status: payStructures.status })
      .from(payStructures)
      .where(eq(payStructures.id, id))
      .limit(1);
    return row ?? null;
  }

  /** Throws 23505 on `pay_structures_name_uk`. */
  async insertStructure(tx: Tx, orgId: string, name: string): Promise<string> {
    const [row] = await tx.insert(payStructures).values({ orgId, name }).returning({ id: payStructures.id });
    return row.id;
  }

  async updateStructure(tx: Tx, id: string, values: { name?: string; status?: 'active' | 'archived' }): Promise<void> {
    if (Object.keys(values).length === 0) return;
    await tx.update(payStructures).set({ ...values, updatedAt: new Date() }).where(eq(payStructures.id, id));
  }

  async replaceStructureComponents(tx: Tx, orgId: string, structureId: string, componentIds: readonly string[]): Promise<void> {
    await tx.delete(payStructureComponents).where(eq(payStructureComponents.structureId, structureId));
    const unique = [...new Set(componentIds)];
    if (unique.length > 0) await tx.insert(payStructureComponents).values(unique.map((componentId) => ({ orgId, structureId, componentId })));
  }

  /** Each structure's component ids, for the run. */
  async structureComponentIds(orgId: string, tx?: Tx): Promise<Map<string, Set<string>>> {
    const rows = await (tx ?? this.db)
      .select({ structureId: payStructureComponents.structureId, componentId: payStructureComponents.componentId })
      .from(payStructureComponents)
      .innerJoin(payStructures, eq(payStructures.id, payStructureComponents.structureId))
      .where(and(eq(payStructureComponents.orgId, orgId), eq(payStructures.status, 'active')));
    const out = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = out.get(r.structureId) ?? new Set<string>();
      set.add(r.componentId);
      out.set(r.structureId, set);
    }
    return out;
  }

  /** Every target row of the business's active components, for the run. */
  async allTargets(orgId: string, tx?: Tx): Promise<{ componentId: string; employeeId: string; mode: PayTargetMode }[]> {
    return (tx ?? this.db)
      .select({ componentId: payComponentTargets.componentId, employeeId: payComponentTargets.employeeId, mode: payComponentTargets.mode })
      .from(payComponentTargets)
      .where(eq(payComponentTargets.orgId, orgId));
  }

  async ownComponents(orgId: string, ids: readonly string[], tx?: Tx): Promise<number> {
    if (ids.length === 0) return 0;
    const [row] = await (tx ?? this.db)
      .select({ count: countAll })
      .from(payComponents)
      .where(and(eq(payComponents.orgId, orgId), inArray(payComponents.id, [...new Set(ids)])));
    return Number(row?.count ?? 0);
  }

  // --- Loans and installments (AC-PY8) -------------------------------------------------

  private readonly loanColumns = {
    id: employeeLoans.id,
    orgId: employeeLoans.orgId,
    ...card,
    kind: employeeLoans.kind,
    amountRwf: employeeLoans.amountRwf,
    givenOn: employeeLoans.givenOn,
    installments: employeeLoans.installments,
    firstPeriod: employeeLoans.firstPeriod,
    paidOut: employeeLoans.paidOut,
    reason: employeeLoans.reason,
    paidOutPayslipId: employeeLoans.paidOutPayslipId,
    settledAt: employeeLoans.settledAt,
    createdAt: employeeLoans.createdAt,
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private loans(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.loanColumns)
      .from(employeeLoans)
      .innerJoin(employees, eq(employees.id, employeeLoans.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId));
  }

  async loanPage(input: { orgId: string; scope: BranchScope; query: ListQuery }): Promise<ListRows<LoanRow>> {
    const status = sql`case when ${employeeLoans.settledAt} is null then 'open' else 'settled' end`;
    const compiled = compileListQuery({
      spec: LOAN_LIST,
      columns: {
        employee: personName,
        kind: employeeLoans.kind,
        status,
        branch: employees.workPropertyId,
        givenOn: employeeLoans.givenOn,
        amountRwf: employeeLoans.amountRwf,
      },
      reader: 'full',
      query: input.query,
      tieBreaker: employeeLoans.id,
    });
    const own = and(eq(employeeLoans.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    const where = compiled.where ? and(own, compiled.where) : own;
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.loans().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db.select({ count: countAll }).from(employeeLoans).innerJoin(employees, eq(employees.id, employeeLoans.employeeId)).where(where),
      this.db
        .select({ value: status, count: countAll })
        .from(employeeLoans)
        .innerJoin(employees, eq(employees.id, employeeLoans.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(employeeLoans)
            .innerJoin(employees, eq(employees.id, employeeLoans.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows: rows as LoanRow[],
      total: Number(count),
      groups: groupsOf(LOAN_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows as { value: string; count: number }[]),
    };
  }

  async findLoan(id: string, tx?: Tx): Promise<LoanRow | null> {
    const [row] = await this.loans(tx).where(eq(employeeLoans.id, id)).limit(1);
    return (row as LoanRow | undefined) ?? null;
  }

  async loanByKey(orgId: string, key: string, tx?: Tx): Promise<string | null> {
    const [row] = await (tx ?? this.db)
      .select({ id: employeeLoans.id })
      .from(employeeLoans)
      .where(and(eq(employeeLoans.orgId, orgId), eq(employeeLoans.idempotencyKey, key)))
      .limit(1);
    return row?.id ?? null;
  }

  async loansOf(employeeId: string): Promise<LoanRow[]> {
    return (await this.loans().where(eq(employeeLoans.employeeId, employeeId)).orderBy(desc(employeeLoans.givenOn))) as LoanRow[];
  }

  async schedules(loanIds: readonly string[], tx?: Tx): Promise<InstallmentRow[]> {
    if (loanIds.length === 0) return [];
    return (tx ?? this.db)
      .select({
        id: loanInstallments.id,
        loanId: loanInstallments.loanId,
        period: loanInstallments.period,
        amountRwf: loanInstallments.amountRwf,
        deferredFrom: loanInstallments.deferredFrom,
        payslipId: loanInstallments.payslipId,
      })
      .from(loanInstallments)
      .where(inArray(loanInstallments.loanId, [...loanIds]))
      .orderBy(asc(loanInstallments.period));
  }

  /** Null when the key was used before: the caller answers with that loan. */
  async insertLoan(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      kind: LoanKind;
      amountRwf: number;
      givenOn: string;
      installments: number;
      firstPeriod: string;
      paidOut: LoanPaidOut;
      reason: string | null;
      createdByUserId: string;
      idempotencyKey: string;
    },
    schedule: readonly { period: string; amountRwf: number }[],
  ): Promise<string | null> {
    const [row] = await tx
      .insert(employeeLoans)
      .values(values)
      .onConflictDoNothing({ target: [employeeLoans.orgId, employeeLoans.idempotencyKey] })
      .returning({ id: employeeLoans.id });
    if (!row) return null;
    await tx.insert(loanInstallments).values(schedule.map((s) => ({ orgId: values.orgId, loanId: row.id, period: s.period, amountRwf: s.amountRwf })));
    return row.id;
  }

  /** Lock a loan's row: deferrals and early settlement run under it. */
  async lockLoan(tx: Tx, id: string): Promise<boolean> {
    const [row] = await tx.select({ id: employeeLoans.id }).from(employeeLoans).where(eq(employeeLoans.id, id)).for('update').limit(1);
    return !!row;
  }

  async moveInstallment(tx: Tx, id: string, to: string, deferredFrom: string | null): Promise<void> {
    await tx
      .update(loanInstallments)
      .set({ period: to, ...(deferredFrom ? { deferredFrom } : {}), updatedAt: new Date() })
      .where(and(eq(loanInstallments.id, id), isNull(loanInstallments.payslipId)));
  }

  /** Early settlement: every unpaid installment becomes one in `period` (AC-PY8). */
  async settleInto(tx: Tx, loanId: string, period: string): Promise<number> {
    const unpaid = await tx
      .select({ id: loanInstallments.id, amountRwf: loanInstallments.amountRwf, period: loanInstallments.period })
      .from(loanInstallments)
      .where(and(eq(loanInstallments.loanId, loanId), isNull(loanInstallments.payslipId)));
    if (unpaid.length === 0) return 0;
    const total = unpaid.reduce((s, i) => s + i.amountRwf, 0);
    await tx.delete(loanInstallments).where(and(eq(loanInstallments.loanId, loanId), isNull(loanInstallments.payslipId)));
    const [{ orgId }] = await tx.select({ orgId: employeeLoans.orgId }).from(employeeLoans).where(eq(employeeLoans.id, loanId)).limit(1);
    await tx.insert(loanInstallments).values({ orgId, loanId, period, amountRwf: total, deferredFrom: null });
    return total;
  }

  /** The unpaid installments of these people dated in `period`, with each loan's position. */
  async installmentsDue(employeeIds: readonly string[], period: string, tx?: Tx): Promise<(InstallmentRow & { employeeId: string; kind: LoanKind; number: number; count: number })[]> {
    if (employeeIds.length === 0) return [];
    const rows = await (tx ?? this.db)
      .select({
        id: loanInstallments.id,
        loanId: loanInstallments.loanId,
        period: loanInstallments.period,
        amountRwf: loanInstallments.amountRwf,
        deferredFrom: loanInstallments.deferredFrom,
        payslipId: loanInstallments.payslipId,
        employeeId: employeeLoans.employeeId,
        kind: employeeLoans.kind,
        number: sql<number>`(select count(*)::int from "loan_installments" i2 where i2.loan_id = "loan_installments"."loan_id" and i2.period <= "loan_installments"."period")`,
        count: sql<number>`(select count(*)::int from "loan_installments" i3 where i3.loan_id = "loan_installments"."loan_id")`,
      })
      .from(loanInstallments)
      .innerJoin(employeeLoans, eq(employeeLoans.id, loanInstallments.loanId))
      .where(and(inArray(employeeLoans.employeeId, [...employeeIds]), eq(loanInstallments.period, period), isNull(loanInstallments.payslipId)));
    return rows.map((r) => ({ ...r, number: Number(r.number), count: Number(r.count) }));
  }

  /** Every unpaid installment of these people after `period`: what a leaver's last payslip takes back (AC-PY13). */
  async installmentsAfter(employeeIds: readonly string[], period: string, tx?: Tx): Promise<(InstallmentRow & { employeeId: string })[]> {
    if (employeeIds.length === 0) return [];
    return (tx ?? this.db)
      .select({
        id: loanInstallments.id,
        loanId: loanInstallments.loanId,
        period: loanInstallments.period,
        amountRwf: loanInstallments.amountRwf,
        deferredFrom: loanInstallments.deferredFrom,
        payslipId: loanInstallments.payslipId,
        employeeId: employeeLoans.employeeId,
      })
      .from(loanInstallments)
      .innerJoin(employeeLoans, eq(employeeLoans.id, loanInstallments.loanId))
      .where(and(inArray(employeeLoans.employeeId, [...employeeIds]), gt(loanInstallments.period, period), isNull(loanInstallments.payslipId)));
  }

  /** Loans paid out on a payslip, given in the month and not paid out yet. */
  async loansToPayOut(employeeIds: readonly string[], first: string, last: string, tx?: Tx): Promise<{ id: string; employeeId: string; kind: LoanKind; amountRwf: number; givenOn: string }[]> {
    if (employeeIds.length === 0) return [];
    return (tx ?? this.db)
      .select({ id: employeeLoans.id, employeeId: employeeLoans.employeeId, kind: employeeLoans.kind, amountRwf: employeeLoans.amountRwf, givenOn: employeeLoans.givenOn })
      .from(employeeLoans)
      .where(
        and(
          inArray(employeeLoans.employeeId, [...employeeIds]),
          eq(employeeLoans.paidOut, 'payslip'),
          isNull(employeeLoans.paidOutPayslipId),
          sql`${employeeLoans.givenOn} between ${first} and ${last}`,
        ),
      );
  }

  async markInstallmentPaid(tx: Tx, id: string, payslipId: string): Promise<void> {
    await tx.update(loanInstallments).set({ payslipId, updatedAt: new Date() }).where(and(eq(loanInstallments.id, id), isNull(loanInstallments.payslipId)));
  }

  async markLoanPaidOut(tx: Tx, id: string, payslipId: string): Promise<void> {
    await tx.update(employeeLoans).set({ paidOutPayslipId: payslipId, updatedAt: new Date() }).where(and(eq(employeeLoans.id, id), isNull(employeeLoans.paidOutPayslipId)));
  }

  /** Stamp `settled_at` on every one of these loans whose installments are all paid. */
  async settleFullyPaid(tx: Tx, loanIds: readonly string[]): Promise<void> {
    if (loanIds.length === 0) return;
    await tx
      .update(employeeLoans)
      .set({ settledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          inArray(employeeLoans.id, [...new Set(loanIds)]),
          isNull(employeeLoans.settledAt),
          sql`not exists (select 1 from "loan_installments" i where i.loan_id = "employee_loans"."id" and i.payslip_id is null)`,
        ),
      );
  }

  // --- Claims (AC-PY9) --------------------------------------------------------------

  private readonly claimColumns = {
    id: payClaims.id,
    orgId: payClaims.orgId,
    ...card,
    kind: payClaims.kind,
    amountRwf: payClaims.amountRwf,
    leaveTypeId: payClaims.leaveTypeId,
    leaveTypeName: leaveTypes.name,
    days: payClaims.days,
    period: payClaims.period,
    receiptKey: payClaims.receiptKey,
    reason: payClaims.reason,
    status: payClaims.status,
    decidedAt: payClaims.decidedAt,
    decidedByName: decider.name,
    decisionNote: payClaims.decisionNote,
    payslipId: payClaims.payslipId,
    createdAt: payClaims.createdAt,
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private claims(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.claimColumns)
      .from(payClaims)
      .innerJoin(employees, eq(employees.id, payClaims.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(leaveTypes, eq(leaveTypes.id, payClaims.leaveTypeId))
      .leftJoin(decider, eq(decider.id, payClaims.decidedByUserId));
  }

  private claimQuery(input: { orgId: string; scope: BranchScope; query: ListQuery }): { compiled: ReturnType<typeof compileListQuery>; own: SQL | undefined; where: SQL | undefined } {
    const compiled = compileListQuery({
      spec: PAY_CLAIM_LIST,
      columns: {
        employee: personName,
        kind: payClaims.kind,
        status: payClaims.status,
        period: payClaims.period,
        branch: employees.workPropertyId,
        createdAt: payClaims.createdAt,
      },
      reader: 'full',
      query: input.query,
      tieBreaker: payClaims.id,
    });
    const own = and(eq(payClaims.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    return { compiled, own, where: compiled.where ? and(own, compiled.where) : own };
  }

  async claimPage(input: { orgId: string; scope: BranchScope; query: ListQuery }): Promise<ListRows<ClaimRow>> {
    const { compiled, own, where } = this.claimQuery(input);
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.claims().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db.select({ count: countAll }).from(payClaims).innerJoin(employees, eq(employees.id, payClaims.employeeId)).where(where),
      this.db
        .select({ value: payClaims.status, count: countAll })
        .from(payClaims)
        .innerJoin(employees, eq(employees.id, payClaims.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(payClaims.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(payClaims)
            .innerJoin(employees, eq(employees.id, payClaims.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows: rows as ClaimRow[],
      total: Number(count),
      groups: groupsOf(PAY_CLAIM_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows),
    };
  }

  async claimIds(input: { orgId: string; scope: BranchScope; query: ListQuery }): Promise<ListIds> {
    const { compiled, where } = this.claimQuery(input);
    const [rows, [{ count }]] = await Promise.all([
      this.db.select({ id: payClaims.id }).from(payClaims).innerJoin(employees, eq(employees.id, payClaims.employeeId)).where(where).orderBy(...compiled.orderBy).limit(MAX_BULK_IDS),
      this.db.select({ count: countAll }).from(payClaims).innerJoin(employees, eq(employees.id, payClaims.employeeId)).where(where),
    ]);
    return { ids: rows.map((r) => r.id), total: Number(count) };
  }

  async findClaim(id: string, tx?: Tx): Promise<ClaimRow | null> {
    const [row] = await this.claims(tx).where(eq(payClaims.id, id)).limit(1);
    return (row as ClaimRow | undefined) ?? null;
  }

  async claimByKey(orgId: string, key: string, tx?: Tx): Promise<string | null> {
    const [row] = await (tx ?? this.db).select({ id: payClaims.id }).from(payClaims).where(and(eq(payClaims.orgId, orgId), eq(payClaims.idempotencyKey, key))).limit(1);
    return row?.id ?? null;
  }

  async claimsOf(employeeId: string): Promise<ClaimRow[]> {
    return (await this.claims().where(eq(payClaims.employeeId, employeeId)).orderBy(desc(payClaims.createdAt)).limit(200)) as ClaimRow[];
  }

  /** Null when the key was used before. */
  async insertClaim(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      kind: PayClaimKind;
      amountRwf: number | null;
      leaveTypeId: string | null;
      days: number | null;
      period: string;
      receiptKey: string | null;
      reason: string;
      requestedByUserId: string;
      idempotencyKey: string;
    },
  ): Promise<string | null> {
    const [row] = await tx
      .insert(payClaims)
      .values(values)
      .onConflictDoNothing({ target: [payClaims.orgId, payClaims.idempotencyKey] })
      .returning({ id: payClaims.id });
    return row?.id ?? null;
  }

  /** Move a claim out of `requested`, only while it still is. */
  async moveClaim(tx: Tx, id: string, to: PayClaimStatus, extra: { userId?: string; note?: string | null; period?: string; amountRwf?: number } = {}): Promise<boolean> {
    const decided = to === 'approved' || to === 'rejected';
    const rows = await tx
      .update(payClaims)
      .set({
        status: to,
        ...(decided ? { decidedAt: new Date(), decidedByUserId: extra.userId ?? null, decisionNote: extra.note ?? null } : {}),
        ...(extra.period ? { period: extra.period } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(payClaims.id, id), eq(payClaims.status, 'requested')))
      .returning({ id: payClaims.id });
    return rows.length > 0;
  }

  /** Approved claims of these people to pay in `period`, not paid yet. */
  async claimsPayable(employeeIds: readonly string[], period: string, tx?: Tx): Promise<ClaimRow[]> {
    if (employeeIds.length === 0) return [];
    return (await this.claims(tx).where(
      and(inArray(payClaims.employeeId, [...employeeIds]), eq(payClaims.period, period), eq(payClaims.status, 'approved'), isNull(payClaims.payslipId)),
    )) as ClaimRow[];
  }

  /** Approved claims still unpaid for a period now confirmed move on to the next month (AC-PY9). */
  async moveUnpaidClaims(tx: Tx, orgId: string, from: string, to: string): Promise<number> {
    const rows = await tx
      .update(payClaims)
      .set({ period: to, updatedAt: new Date() })
      .where(and(eq(payClaims.orgId, orgId), eq(payClaims.period, from), inArray(payClaims.status, ['requested', 'approved']), isNull(payClaims.payslipId)))
      .returning({ id: payClaims.id });
    return rows.length;
  }

  async markClaimPaid(tx: Tx, id: string, payslipId: string): Promise<void> {
    await tx.update(payClaims).set({ payslipId, updatedAt: new Date() }).where(and(eq(payClaims.id, id), isNull(payClaims.payslipId)));
  }

  // --- Pay adjustments (AC-PY16) -------------------------------------------------------

  private readonly adjustmentColumns = {
    id: payAdjustments.id,
    orgId: payAdjustments.orgId,
    ...card,
    side: payAdjustments.side,
    amountRwf: payAdjustments.amountRwf,
    taxable: payAdjustments.taxable,
    contributable: payAdjustments.contributable,
    correctsPeriod: payAdjustments.correctsPeriod,
    reason: payAdjustments.reason,
    source: payAdjustments.source,
    sourceId: payAdjustments.sourceId,
    status: payAdjustments.status,
    payslipId: payAdjustments.payslipId,
    paidInPeriod: sql<string | null>`(select to_char(r.period_start, 'YYYY-MM') from "payslips" p join "pay_runs" r on r.id = p.pay_run_id where p.id = "pay_adjustments"."payslip_id")`,
    createdAt: payAdjustments.createdAt,
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private adjustments(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.adjustmentColumns)
      .from(payAdjustments)
      .innerJoin(employees, eq(employees.id, payAdjustments.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId));
  }

  async adjustmentPage(input: { orgId: string; scope: BranchScope; query: ListQuery }): Promise<ListRows<AdjustmentRow>> {
    const compiled = compileListQuery({
      spec: PAY_ADJUSTMENT_LIST,
      columns: {
        employee: personName,
        side: payAdjustments.side,
        source: payAdjustments.source,
        status: payAdjustments.status,
        correctsPeriod: payAdjustments.correctsPeriod,
        branch: employees.workPropertyId,
        createdAt: payAdjustments.createdAt,
      },
      reader: 'full',
      query: input.query,
      tieBreaker: payAdjustments.id,
    });
    const own = and(eq(payAdjustments.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    const where = compiled.where ? and(own, compiled.where) : own;
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.adjustments().where(where).orderBy(...compiled.orderBy).limit(compiled.limit).offset(compiled.offset),
      this.db.select({ count: countAll }).from(payAdjustments).innerJoin(employees, eq(employees.id, payAdjustments.employeeId)).where(where),
      this.db
        .select({ value: payAdjustments.status, count: countAll })
        .from(payAdjustments)
        .innerJoin(employees, eq(employees.id, payAdjustments.employeeId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(payAdjustments.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(payAdjustments)
            .innerJoin(employees, eq(employees.id, payAdjustments.employeeId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);
    const labels = await refLabels(this.db, input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows: rows as AdjustmentRow[],
      total: Number(count),
      groups: groupsOf(PAY_ADJUSTMENT_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows),
    };
  }

  async findAdjustment(id: string, tx?: Tx): Promise<AdjustmentRow | null> {
    const [row] = await this.adjustments(tx).where(eq(payAdjustments.id, id)).limit(1);
    return (row as AdjustmentRow | undefined) ?? null;
  }

  async adjustmentByKey(orgId: string, key: string, tx?: Tx): Promise<string | null> {
    const [row] = await (tx ?? this.db)
      .select({ id: payAdjustments.id })
      .from(payAdjustments)
      .where(and(eq(payAdjustments.orgId, orgId), eq(payAdjustments.idempotencyKey, key)))
      .limit(1);
    return row?.id ?? null;
  }

  /** Null when the key was used before. */
  async insertAdjustment(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      side: PayAdjustmentSide;
      amountRwf: number;
      taxable: boolean;
      contributable: boolean;
      correctsPeriod: string;
      reason: string;
      source: PayAdjustmentSource;
      sourceId: string | null;
      createdByUserId: string | null;
      idempotencyKey: string | null;
    },
  ): Promise<string | null> {
    const q = tx.insert(payAdjustments).values(values);
    const [row] = values.idempotencyKey
      ? await q.onConflictDoNothing().returning({ id: payAdjustments.id })
      : await q.returning({ id: payAdjustments.id });
    return row?.id ?? null;
  }

  async waiveAdjustment(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
      .update(payAdjustments)
      .set({ status: 'waived', updatedAt: new Date() })
      .where(and(eq(payAdjustments.id, id), eq(payAdjustments.status, 'open')))
      .returning({ id: payAdjustments.id });
    return rows.length > 0;
  }

  /** Open adjustments of these people: the next run pays or deducts each (AC-PY16). */
  async openAdjustments(employeeIds: readonly string[], tx?: Tx): Promise<AdjustmentRow[]> {
    if (employeeIds.length === 0) return [];
    return (await this.adjustments(tx)
      .where(and(inArray(payAdjustments.employeeId, [...employeeIds]), eq(payAdjustments.status, 'open')))
      .orderBy(asc(payAdjustments.createdAt))) as AdjustmentRow[];
  }

  /** The people a run holds: an open held adjustment names the run (AC-PY7). */
  async heldIn(payRunId: string, tx?: Tx): Promise<Set<string>> {
    const rows = await (tx ?? this.db)
      .select({ employeeId: payAdjustments.employeeId })
      .from(payAdjustments)
      .where(and(eq(payAdjustments.source, 'held_payslip'), eq(payAdjustments.sourceId, payRunId), inArray(payAdjustments.status, ['open', 'paid'])));
    return new Set(rows.map((r) => r.employeeId));
  }

  async markAdjustmentPaid(tx: Tx, id: string, payslipId: string): Promise<void> {
    await tx
      .update(payAdjustments)
      .set({ status: 'paid', payslipId, updatedAt: new Date() })
      .where(and(eq(payAdjustments.id, id), eq(payAdjustments.status, 'open')));
  }

  /** Contracts carrying a structure, for the contracts screen. */
  async setContractPayTerms(tx: Tx, contractId: string, values: { payStructureId?: string | null; noticeDays?: number | null }): Promise<void> {
    if (Object.keys(values).length === 0) return;
    await tx.update(employmentContracts).set({ ...values, updatedAt: new Date() }).where(eq(employmentContracts.id, contractId));
  }
}
