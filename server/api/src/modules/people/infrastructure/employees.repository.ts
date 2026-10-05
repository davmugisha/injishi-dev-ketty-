import {
  EMPLOYEE_LIST,
  type ContractStatus,
  type ContractType,
  type EmployeeStatus,
  type HrIdDocumentType,
  type HrSex,
  type ListCount,
  type ListFilterOp,
  type ListGroup,
  type ListIds,
  type ListQuery,
  type ListView,
  MAX_BULK_IDS,
  type OrgRole,
  type WageBasis,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNotNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  departmentMembers,
  departments,
  employees,
  employmentContracts,
  hrCounters,
  jobPositions,
  leaveLedgerEntries,
  orgMemberships,
  payRuns,
  payslips,
  properties,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  compileListQuery,
  countAll,
  groupOrder,
  groupsOf,
  statusCountsOf,
  type CompiledList,
  type ListColumns,
} from '../../../shared/lists/list-query';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface EmployeeRow {
  id: string;
  orgId: string;
  orgMembershipId: string | null;
  employeeNumber: string;
  legalName: string;
  preferredName: string | null;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  sex: HrSex | null;
  idDocumentType: HrIdDocumentType | null;
  idDocumentNumber: string | null;
  rssbNumber: string | null;
  workPropertyId: string | null;
  workPropertyName: string | null;
  jobPositionId: string | null;
  jobPositionTitle: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  hiredOn: string;
  status: EmployeeStatus;
  offboardedOn: string | null;
  offboardReason: string | null;
  membershipRole: OrgRole | null;
  membershipStatus: 'active' | 'removed' | null;
  membershipUserId: string | null;
}

export interface ContractRow {
  id: string;
  orgId: string;
  employeeId: string;
  contractType: ContractType;
  startsOn: string;
  endsOn: string | null;
  wageBasis: WageBasis;
  wageRwf: number;
  status: ContractStatus;
  endReason: string | null;
}

/** What a create or an edit writes. The service has already validated it. */
export interface EmployeeValues {
  legalName?: string;
  preferredName?: string | null;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  sex?: HrSex | null;
  idDocumentType?: HrIdDocumentType | null;
  idDocumentNumber?: string | null;
  rssbNumber?: string | null;
  workPropertyId?: string | null;
  jobPositionId?: string | null;
  reportingManagerId?: string | null;
  hiredOn?: string;
  employeeNumber?: string;
}

/** A unique constraint that broke on this write, by name, or null. */
export function violatedConstraint(error: unknown, code = '23505'): string | null {
  for (const e of [error, (error as { cause?: unknown })?.cause]) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === code) {
      return (e as { constraint?: string }).constraint ?? '';
    }
  }
  return null;
}

const manager = alias(employees, 'reporting_manager');

/**
 * "In department X" for a person who may sit in several departments: an
 * EXISTS over the active roster rows, never a join that would repeat the file.
 */
function inDepartment(op: ListFilterOp, value: unknown): SQL {
  const member = (extra?: SQL): SQL =>
    sql`exists (select 1 from ${departmentMembers} where ${departmentMembers.employeeId} = ${employees.id} and ${departmentMembers.status} = 'active'${extra ? sql` and ${extra}` : sql``})`;
  switch (op) {
    case 'eq':
      return member(eq(departmentMembers.departmentId, value as string));
    case 'ne':
      return sql`not ${member(eq(departmentMembers.departmentId, value as string))}`;
    case 'in':
      return member(inArray(departmentMembers.departmentId, value as string[]));
    case 'nin':
      return sql`not ${member(inArray(departmentMembers.departmentId, value as string[]))}`;
    case 'isNull':
      return sql`not ${member()}`;
    case 'isNotNull':
      return member();
    default:
      throw new Error(`The department field does not support ${op}.`);
  }
}

/**
 * HR files and contracts (ADR-058). The only place that touches Drizzle for
 * them.
 *
 * Same split as every operator repository: a LIST is filtered by the org and
 * the caller's branches in its `where`; a SINGLE ROW is read unscoped so the
 * service can prove it belongs to the caller's business and answer 404.
 */
@Injectable()
export class EmployeesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private readonly columns = {
    id: employees.id,
    orgId: employees.orgId,
    orgMembershipId: employees.orgMembershipId,
    employeeNumber: employees.employeeNumber,
    legalName: employees.legalName,
    preferredName: employees.preferredName,
    phone: employees.phone,
    email: employees.email,
    dateOfBirth: employees.dateOfBirth,
    sex: employees.sex,
    idDocumentType: employees.idDocumentType,
    idDocumentNumber: employees.idDocumentNumber,
    rssbNumber: employees.rssbNumber,
    workPropertyId: employees.workPropertyId,
    workPropertyName: properties.name,
    jobPositionId: employees.jobPositionId,
    jobPositionTitle: jobPositions.title,
    reportingManagerId: employees.reportingManagerId,
    reportingManagerName: sql<string | null>`coalesce(${manager.preferredName}, ${manager.legalName})`,
    hiredOn: employees.hiredOn,
    status: employees.status,
    offboardedOn: employees.offboardedOn,
    offboardReason: employees.offboardReason,
    membershipRole: orgMemberships.orgRole,
    membershipStatus: orgMemberships.status,
    membershipUserId: orgMemberships.userId,
  };

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private base(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.columns)
      .from(employees)
      .leftJoin(properties, eq(properties.id, employees.workPropertyId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(manager, eq(manager.id, employees.reportingManagerId))
      .leftJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId));
  }

  /**
   * The employee list's one field to column map (058-list-framework). The only
   * place the list names a column; `EMPLOYEE_LIST` in contracts says which
   * fields may be filtered, sorted and grouped.
   */
  private readonly listColumns: ListColumns = {
    employeeNumber: employees.employeeNumber,
    name: sql`coalesce(nullif(btrim(${employees.preferredName}), ''), ${employees.legalName})`,
    legalName: employees.legalName,
    phone: employees.phone,
    status: employees.status,
    branch: employees.workPropertyId,
    department: { filter: (op, value) => inDepartment(op, value) },
    jobPosition: employees.jobPositionId,
    hiredOn: employees.hiredOn,
    hasAccount: sql`(${employees.orgMembershipId} is not null and ${orgMemberships.status} = 'active')`,
    // The same four checks as `detailsMissing` in the presenter.
    detailsMissing: sql`(${employees.phone} is null or ${employees.dateOfBirth} is null or ${employees.sex} is null or ${employees.idDocumentType} is null or ${employees.idDocumentNumber} is null)`,
    dateOfBirth: employees.dateOfBirth,
  };

  /** The list query compiled, and the business and branch condition it is added to. */
  private compiled(input: { orgId: string; scope: BranchScope; view: ListView; query: ListQuery }): {
    compiled: CompiledList;
    own: SQL | undefined;
    where: SQL | undefined;
  } {
    const compiled = compileListQuery({
      spec: EMPLOYEE_LIST,
      columns: this.listColumns,
      reader: input.view,
      query: input.query,
      tieBreaker: employees.id,
    });
    const own = and(eq(employees.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope));
    return { compiled, own, where: compiled.where ? and(own, compiled.where) : own };
  }

  /**
   * One page of a business's files in the caller's branches, filtered, sorted
   * and grouped as the query asks and the spec allows (AC-LF3, AC-LF4). The org
   * and branch conditions come first and the list query only adds to them.
   */
  async listPage(input: {
    orgId: string;
    scope: BranchScope;
    view: ListView;
    query: ListQuery;
  }): Promise<{ rows: EmployeeRow[]; total: number; groups: ListGroup[] | undefined; statusCounts: ListCount[] }> {
    const { compiled, own, where } = this.compiled(input);
    const [rows, [{ count }], statusRows, groupRows] = await Promise.all([
      this.base()
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(compiled.limit)
        .offset(compiled.offset) as Promise<EmployeeRow[]>,
      this.db
        .select({ count: countAll })
        .from(employees)
        .leftJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId))
        .where(where),
      this.db
        .select({ value: employees.status, count: countAll })
        .from(employees)
        .leftJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId))
        .where(compiled.whereForStatusCounts ? and(own, compiled.whereForStatusCounts) : own)
        .groupBy(employees.status),
      compiled.groupColumn
        ? this.db
            .select({ key: sql`${compiled.groupColumn}`, count: countAll })
            .from(employees)
            .leftJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId))
            .where(where)
            .groupBy(sql`${compiled.groupColumn}`)
            .orderBy(groupOrder(compiled.groupColumn))
        : Promise.resolve([] as { key: unknown; count: number }[]),
    ]);

    const labels = await this.groupLabels(input.query.groupBy, groupRows.map((g) => g.key));
    return {
      rows,
      total: Number(count),
      groups: groupsOf(EMPLOYEE_LIST, input.query.groupBy, groupRows, labels),
      statusCounts: statusCountsOf(statusRows),
    };
  }

  /**
   * Select all (AC-LF15): the ids matching the query in list order, at most the
   * bulk cap, and how many match, so the screen can refuse to act on part of a
   * filter silently.
   */
  async listIds(input: { orgId: string; scope: BranchScope; view: ListView; query: ListQuery }): Promise<ListIds> {
    const { compiled, where } = this.compiled(input);
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({ id: employees.id })
        .from(employees)
        .leftJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId))
        .where(where)
        .orderBy(...compiled.orderBy)
        .limit(MAX_BULK_IDS),
      this.db
        .select({ count: countAll })
        .from(employees)
        .leftJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId))
        .where(where),
    ]);
    return { ids: rows.map((r) => r.id), total: Number(count) };
  }

  /** Names for grouped ids: a branch's name, a position's title. */
  private async groupLabels(groupBy: string | undefined, keys: readonly unknown[]): Promise<Map<string, string>> {
    const ids = keys.filter((k): k is string => typeof k === 'string');
    if (ids.length === 0) return new Map();
    if (groupBy === 'branch') {
      const rows = await this.db
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .where(inArray(properties.id, ids));
      return new Map(rows.map((r) => [r.id, r.name]));
    }
    if (groupBy === 'jobPosition') {
      const rows = await this.db
        .select({ id: jobPositions.id, name: jobPositions.title })
        .from(jobPositions)
        .where(inArray(jobPositions.id, ids));
      return new Map(rows.map((r) => [r.id, r.name]));
    }
    return new Map();
  }

  async find(id: string, tx?: Tx): Promise<EmployeeRow | null> {
    const [row] = await this.base(tx).where(eq(employees.id, id)).limit(1);
    return (row as EmployeeRow | undefined) ?? null;
  }

  /** Several files at once, for roster cards and payslips. */
  async findMany(ids: readonly string[], tx?: Tx): Promise<EmployeeRow[]> {
    if (ids.length === 0) return [];
    return (await this.base(tx).where(inArray(employees.id, [...ids]))) as EmployeeRow[];
  }

  /**
   * The caller's own file at this business, through their membership. Used to
   * refuse deciding one's own leave (AC-L5) and to put a manager's queue first.
   */
  async findForUser(orgId: string, userId: string, tx?: Tx): Promise<string | null> {
    const [row] = await (tx ?? this.db)
      .select({ id: employees.id })
      .from(employees)
      .innerJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId))
      .where(and(eq(employees.orgId, orgId), eq(orgMemberships.userId, userId)))
      .limit(1);
    return row?.id ?? null;
  }

  /** A property's owner and branch, read unscoped for the service to check. */
  async findProperty(id: string, tx?: Tx): Promise<{ id: string; orgId: string } | null> {
    const [row] = await (tx ?? this.db)
      .select({ id: properties.id, orgId: properties.orgId })
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);
    return row ?? null;
  }

  /** The file holding this ID at this business, if any (AC-P3). */
  async findByIdDocument(
    orgId: string,
    type: HrIdDocumentType,
    number: string,
    tx?: Tx,
  ): Promise<{ id: string; employeeNumber: string } | null> {
    const [row] = await (tx ?? this.db)
      .select({ id: employees.id, employeeNumber: employees.employeeNumber })
      .from(employees)
      .where(
        and(
          eq(employees.orgId, orgId),
          eq(employees.idDocumentType, type),
          eq(employees.idDocumentNumber, number),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async numberTaken(orgId: string, employeeNumber: string, tx?: Tx): Promise<boolean> {
    const [row] = await (tx ?? this.db)
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.employeeNumber, employeeNumber)))
      .limit(1);
    return !!row;
  }

  /**
   * The next free employee number for a business: `0001`, `0002`, … (AC-P1).
   *
   * `INSERT … ON CONFLICT DO UPDATE … RETURNING` takes the number and moves the
   * counter in one statement, so two creates at once take two numbers. A number
   * somebody TYPED onto a file is skipped rather than minted a second time.
   */
  async mintEmployeeNumber(tx: Tx, orgId: string): Promise<string> {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const [row] = await tx
        .insert(hrCounters)
        .values({ orgId, nextEmployeeNumber: 2 })
        .onConflictDoUpdate({
          target: hrCounters.orgId,
          set: {
            nextEmployeeNumber: sql`${hrCounters.nextEmployeeNumber} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({ minted: sql<number>`${hrCounters.nextEmployeeNumber} - 1` });
      const candidate = String(row.minted).padStart(4, '0');
      if (!(await this.numberTaken(orgId, candidate, tx))) return candidate;
    }
    throw new Error('Could not mint an employee number.');
  }

  async insert(
    tx: Tx,
    orgId: string,
    values: EmployeeValues & { legalName: string; hiredOn: string; employeeNumber: string },
  ): Promise<string> {
    const [row] = await tx
      .insert(employees)
      .values({ orgId, ...values })
      .returning({ id: employees.id });
    return row.id;
  }

  async update(tx: Tx, id: string, values: EmployeeValues): Promise<void> {
    await tx
      .update(employees)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(employees.id, id));
  }

  /**
   * Run `fn` in a transaction holding the employee row locked. Leave writes,
   * contract writes and offboarding for one person go through here, so they
   * apply one after the other (key invariant: serialised by a row lock).
   */
  async withEmployeeLock<T>(
    employeeId: string,
    fn: (tx: Tx, employee: EmployeeRow) => Promise<T>,
  ): Promise<T | null> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .for('update')
        .limit(1);
      if (!locked) return null;
      const row = await this.find(employeeId, tx);
      if (!row) return null;
      return fn(tx, row);
    });
  }

  /**
   * Would making `managerId` the reporting manager of `employeeId` close a loop?
   * Walks up from the proposed manager; a chain that reaches the person is one.
   */
  async wouldLoop(employeeId: string, managerId: string, tx?: Tx): Promise<boolean> {
    const result = await (tx ?? this.db).execute<{ found: boolean }>(sql`
      with recursive chain(id, depth) as (
        select ${managerId}::uuid, 0
        union all
        select e.reporting_manager_id, c.depth + 1
        from ${employees} e join chain c on e.id = c.id
        where e.reporting_manager_id is not null and c.depth < 500
      )
      select exists (select 1 from chain where id = ${employeeId}::uuid) as found
    `);
    return Boolean(result.rows[0]?.found);
  }

  /** Has this person earned leave or been paid? Then the hire date is history (AC-P6). */
  async hireDateLocked(employeeId: string, tx?: Tx): Promise<boolean> {
    const db = tx ?? this.db;
    const [accrual] = await db
      .select({ id: leaveLedgerEntries.id })
      .from(leaveLedgerEntries)
      .where(and(eq(leaveLedgerEntries.employeeId, employeeId), eq(leaveLedgerEntries.kind, 'accrual')))
      .limit(1);
    if (accrual) return true;
    const [slip] = await db
      .select({ id: payslips.id })
      .from(payslips)
      .where(eq(payslips.employeeId, employeeId))
      .limit(1);
    return !!slip;
  }

  // --- Contracts -----------------------------------------------------------

  private readonly contractColumns = {
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
  };

  /** A person's contracts, newest start first. */
  async contracts(employeeId: string, tx?: Tx): Promise<ContractRow[]> {
    return (tx ?? this.db)
      .select(this.contractColumns)
      .from(employmentContracts)
      .where(eq(employmentContracts.employeeId, employeeId))
      .orderBy(desc(employmentContracts.startsOn));
  }

  /** The active contract of each person, else their next scheduled one. */
  async currentContracts(employeeIds: readonly string[]): Promise<Map<string, ContractRow>> {
    const out = new Map<string, ContractRow>();
    if (employeeIds.length === 0) return out;
    const rows = await this.db
      .select(this.contractColumns)
      .from(employmentContracts)
      .where(
        and(
          inArray(employmentContracts.employeeId, [...employeeIds]),
          inArray(employmentContracts.status, ['active', 'scheduled']),
        ),
      )
      .orderBy(asc(employmentContracts.startsOn));
    for (const row of rows) {
      const held = out.get(row.employeeId);
      if (!held || (held.status !== 'active' && row.status === 'active')) out.set(row.employeeId, row);
    }
    return out;
  }

  async insertContract(
    tx: Tx,
    values: Omit<ContractRow, 'id' | 'endReason'> & { createdByUserId: string },
  ): Promise<string> {
    const [row] = await tx
      .insert(employmentContracts)
      .values(values)
      .returning({ id: employmentContracts.id });
    return row.id;
  }

  async updateContract(
    tx: Tx,
    id: string,
    patch: Partial<Pick<ContractRow, 'endsOn' | 'status' | 'endReason'>>,
  ): Promise<void> {
    await tx
      .update(employmentContracts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(employmentContracts.id, id));
  }

  async findContract(id: string, tx?: Tx): Promise<ContractRow | null> {
    const [row] = await (tx ?? this.db)
      .select(this.contractColumns)
      .from(employmentContracts)
      .where(eq(employmentContracts.id, id))
      .limit(1);
    return row ?? null;
  }

  // --- Departments of a person --------------------------------------------

  async departmentsOf(
    employeeId: string,
  ): Promise<{ departmentId: string; name: string; departmentPosition: string }[]> {
    return this.db
      .select({
        departmentId: departments.id,
        name: departments.name,
        departmentPosition: departmentMembers.departmentPosition,
      })
      .from(departmentMembers)
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .where(and(eq(departmentMembers.employeeId, employeeId), eq(departmentMembers.status, 'active')))
      .orderBy(asc(departments.name));
  }

  // --- Offboarding (AC-O1) -------------------------------------------------

  /** The last month a confirmed pay run froze, as its first day, or null. */
  async latestConfirmedPeriod(orgId: string, tx?: Tx): Promise<string | null> {
    const [row] = await (tx ?? this.db)
      .select({ periodStart: payRuns.periodStart })
      .from(payRuns)
      .where(and(eq(payRuns.orgId, orgId), eq(payRuns.status, 'confirmed')))
      .orderBy(desc(payRuns.periodStart))
      .limit(1);
    return row?.periodStart ?? null;
  }

  async removeMembership(tx: Tx, membershipId: string): Promise<void> {
    await tx
      .update(orgMemberships)
      .set({ status: 'removed', removedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orgMemberships.id, membershipId), eq(orgMemberships.status, 'active')));
  }

  /** Their department rows, by file or by account, go to `removed`. */
  async removeDepartmentRows(tx: Tx, employeeId: string, membershipId: string | null): Promise<number> {
    const who = membershipId
      ? or(eq(departmentMembers.employeeId, employeeId), eq(departmentMembers.orgMembershipId, membershipId))
      : eq(departmentMembers.employeeId, employeeId);
    const rows = await tx
      .update(departmentMembers)
      .set({ status: 'removed', updatedAt: new Date() })
      .where(and(who, eq(departmentMembers.status, 'active')))
      .returning({ id: departmentMembers.id });
    return rows.length;
  }

  /** Nobody reports to someone who has left. */
  async clearReports(tx: Tx, employeeId: string): Promise<number> {
    const rows = await tx
      .update(employees)
      .set({ reportingManagerId: null, updatedAt: new Date() })
      .where(eq(employees.reportingManagerId, employeeId))
      .returning({ id: employees.id });
    return rows.length;
  }

  async markOffboarded(tx: Tx, employeeId: string, lastDay: string, reason: string): Promise<void> {
    await tx
      .update(employees)
      .set({ status: 'offboarded', offboardedOn: lastDay, offboardReason: reason, updatedAt: new Date() })
      .where(eq(employees.id, employeeId));
  }

  /**
   * The daily contract status move (AC-P4), on Kigali dates. Ending runs first,
   * so the one active contract index never sees two actives at once.
   */
  async moveContractStatuses(today: string): Promise<{ ended: number; started: number }> {
    return this.db.transaction(async (tx) => {
      const ended = await tx
        .update(employmentContracts)
        .set({ status: 'ended', updatedAt: new Date() })
        .where(
          and(
            ne(employmentContracts.status, 'ended'),
            isNotNull(employmentContracts.endsOn),
            sql`${employmentContracts.endsOn} < ${today}`,
          ),
        )
        .returning({ id: employmentContracts.id });
      const started = await tx
        .update(employmentContracts)
        .set({ status: 'active', updatedAt: new Date() })
        .where(
          and(
            eq(employmentContracts.status, 'scheduled'),
            lte(employmentContracts.startsOn, today),
          ),
        )
        .returning({ id: employmentContracts.id });
      return { ended: ended.length, started: started.length };
    });
  }
}
