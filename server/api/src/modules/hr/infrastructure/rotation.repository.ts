import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import {
  employees,
  jobPositions,
  rosterEntries,
  rotationAssignments,
  rotationPatterns,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Tx } from './employees.repository';

export interface PatternRow {
  id: string;
  orgId: string;
  propertyId: string;
  name: string;
  steps: string[];
  rule: 'every_n_days' | 'weekly' | 'monthly';
  ruleValue: number;
  status: 'active' | 'archived';
  openAssignments: number;
}

export interface AssignmentRow {
  id: string;
  orgId: string;
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  employeeStatus: 'active' | 'offboarded';
  offboardedOn: string | null;
  patternId: string;
  patternName: string;
  propertyId: string;
  steps: string[];
  rule: 'every_n_days' | 'weekly' | 'monthly';
  ruleValue: number;
  startsOn: string;
  endsOn: string | null;
  startStep: number;
}

/**
 * Rotation patterns and who is on them (ADR-058, 058-time AC-TM3). The only
 * place that touches Drizzle for them. An assignment ends on a date; nothing
 * here is deleted.
 */
@Injectable()
export class RotationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private readonly patternColumns = {
    id: rotationPatterns.id,
    orgId: rotationPatterns.orgId,
    propertyId: rotationPatterns.propertyId,
    name: rotationPatterns.name,
    steps: rotationPatterns.steps,
    rule: rotationPatterns.rule,
    ruleValue: rotationPatterns.ruleValue,
    status: rotationPatterns.status,
    // Spelled with table names: from a single table select Drizzle renders a
    // column unqualified, and an unqualified "id" inside the subquery is the
    // assignment's own, which counted nothing.
    openAssignments: sql<number>`(select count(*)::int from rotation_assignments a where a.pattern_id = rotation_patterns.id and a.ends_on is null)`,
  };

  async patterns(orgId: string, scope: BranchScope, propertyId?: string): Promise<PatternRow[]> {
    const where = [eq(rotationPatterns.orgId, orgId), inBranchScope(rotationPatterns.propertyId, scope)];
    if (propertyId) where.push(eq(rotationPatterns.propertyId, propertyId));
    return this.db
      .select(this.patternColumns)
      .from(rotationPatterns)
      .where(and(...where))
      .orderBy(asc(rotationPatterns.status), asc(rotationPatterns.name));
  }

  async findPattern(id: string, tx?: Tx): Promise<PatternRow | null> {
    const [row] = await (tx ?? this.db).select(this.patternColumns).from(rotationPatterns).where(eq(rotationPatterns.id, id)).limit(1);
    return row ?? null;
  }

  async insertPattern(
    tx: Tx,
    values: {
      orgId: string;
      propertyId: string;
      name: string;
      steps: string[];
      rule: 'every_n_days' | 'weekly' | 'monthly';
      ruleValue: number;
      createdByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(rotationPatterns).values(values).returning({ id: rotationPatterns.id });
    return row.id;
  }

  async updatePattern(tx: Tx, id: string, values: { name?: string; status?: 'active' | 'archived' }): Promise<void> {
    await tx
      .update(rotationPatterns)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(rotationPatterns.id, id));
  }

  private readonly assignmentColumns = {
    id: rotationAssignments.id,
    orgId: rotationAssignments.orgId,
    employeeId: rotationAssignments.employeeId,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    employeeStatus: employees.status,
    offboardedOn: employees.offboardedOn,
    patternId: rotationAssignments.patternId,
    patternName: rotationPatterns.name,
    propertyId: rotationPatterns.propertyId,
    steps: rotationPatterns.steps,
    rule: rotationPatterns.rule,
    ruleValue: rotationPatterns.ruleValue,
    startsOn: rotationAssignments.startsOn,
    endsOn: rotationAssignments.endsOn,
    startStep: rotationAssignments.startStep,
  };

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private assignmentQuery(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.assignmentColumns)
      .from(rotationAssignments)
      .innerJoin(rotationPatterns, eq(rotationPatterns.id, rotationAssignments.patternId))
      .innerJoin(employees, eq(employees.id, rotationAssignments.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId));
  }

  /** A business's assignments in the caller's branches: open ones, or every one. */
  /** The rotation a person is on now, if any. */
  async runningFor(employeeId: string): Promise<AssignmentRow | null> {
    const [row] = await this.assignmentQuery()
      .where(and(eq(rotationAssignments.employeeId, employeeId), isNull(rotationAssignments.endsOn)))
      .limit(1);
    return (row as AssignmentRow | undefined) ?? null;
  }

  async assignments(input: { orgId: string; scope: BranchScope; patternId?: string; includeEnded: boolean }): Promise<AssignmentRow[]> {
    const where = [eq(rotationAssignments.orgId, input.orgId), inBranchScope(rotationPatterns.propertyId, input.scope)];
    if (input.patternId) where.push(eq(rotationAssignments.patternId, input.patternId));
    if (!input.includeEnded) where.push(isNull(rotationAssignments.endsOn));
    return this.assignmentQuery()
      .where(and(...where))
      .orderBy(asc(rotationPatterns.name), asc(employees.legalName)) as Promise<AssignmentRow[]>;
  }

  async findAssignment(id: string, tx?: Tx): Promise<AssignmentRow | null> {
    const [row] = await this.assignmentQuery(tx).where(eq(rotationAssignments.id, id)).limit(1);
    return (row as AssignmentRow | undefined) ?? null;
  }

  /** Throws 23505 on `rotation_assignments_open_uk` when the person is already on one. */
  async insertAssignment(
    tx: Tx,
    values: { orgId: string; employeeId: string; patternId: string; startsOn: string; startStep: number; createdByUserId: string },
  ): Promise<string> {
    const [row] = await tx.insert(rotationAssignments).values(values).returning({ id: rotationAssignments.id });
    return row.id;
  }

  /** End an open assignment on a day. False when it had already ended. */
  async endAssignment(tx: Tx, id: string, endsOn: string): Promise<boolean> {
    const rows = await tx
      .update(rotationAssignments)
      .set({ endsOn, updatedAt: new Date() })
      .where(and(eq(rotationAssignments.id, id), isNull(rotationAssignments.endsOn)))
      .returning({ id: rotationAssignments.id });
    return rows.length > 0;
  }

  /** Cancel the drafts an assignment generated after a day; published shifts stay for a person to move. */
  async cancelGeneratedDraftsAfter(tx: Tx, assignmentId: string, afterDate: string, reason: string): Promise<number> {
    const rows = await tx
      .update(rosterEntries)
      .set({ status: 'cancelled', cancelReason: reason, updatedAt: new Date() })
      .where(
        and(
          eq(rosterEntries.rotationAssignmentId, assignmentId),
          eq(rosterEntries.status, 'scheduled'),
          isNull(rosterEntries.publishedAt),
          gt(rosterEntries.workDate, afterDate),
        ),
      )
      .returning({ id: rosterEntries.id });
    return rows.length;
  }

  /** Every assignment running on any day from `from` to `to`, for the generator. */
  async running(from: string, to: string): Promise<AssignmentRow[]> {
    return this.assignmentQuery().where(
      and(
        eq(rotationPatterns.status, 'active'),
        lte(rotationAssignments.startsOn, to),
        or(isNull(rotationAssignments.endsOn), gte(rotationAssignments.endsOn, from)),
      ),
    ) as Promise<AssignmentRow[]>;
  }

  /** The dates an assignment already wrote an entry for, cancelled ones included: never written twice. */
  async generatedDates(assignmentId: string, from: string, to: string): Promise<Set<string>> {
    const rows = await this.db
      .selectDistinct({ workDate: rosterEntries.workDate })
      .from(rosterEntries)
      .where(
        and(
          eq(rosterEntries.rotationAssignmentId, assignmentId),
          gte(rosterEntries.workDate, from),
          lte(rosterEntries.workDate, to),
        ),
      );
    return new Set(rows.map((r) => r.workDate));
  }

  /** Patterns with people on them, among these ids. */
  async patternsInUse(ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db
      .selectDistinct({ id: rotationAssignments.patternId })
      .from(rotationAssignments)
      .where(and(inArray(rotationAssignments.patternId, [...ids]), isNull(rotationAssignments.endsOn)));
    return new Set(rows.map((r) => r.id));
  }
}
