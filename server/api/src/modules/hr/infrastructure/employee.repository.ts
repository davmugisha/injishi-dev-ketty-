import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { users } from '../../../database/drizzle/auth';
import { departmentMembers, departments } from '../../../database/drizzle/operations';
import { employmentHistory } from '../../../database/drizzle/schema';

/** One staff member's current HR-visible facts, resolved from their latest employment_history row. */
export interface EmployeeRow {
  departmentMemberId: string;
  userId: string;
  name: string | null;
  email: string | null;
  departmentId: string;
  departmentName: string | null;
  jobTitle: string | null;
  employmentType: string | null;
  effectiveFrom: Date | null;
}

/**
 * Who works here, with HR facts layered on top of `department_members`
 * (Phase 1, first pass — no ADR yet). "Employee" IS a `department_members`
 * row in this design — see `hr.ts`'s header — so there is no separate
 * roster to maintain; this reads the existing roster and joins in whatever
 * the latest `employment_history` event says.
 */
@Injectable()
export class EmployeeRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForWorkspace(workspaceId: string): Promise<EmployeeRow[]> {
    const members = await this.db
      .select({
        departmentMemberId: departmentMembers.id,
        userId: departmentMembers.userId,
        name: users.name,
        email: users.email,
        departmentId: departmentMembers.departmentId,
        departmentName: departments.name,
      })
      .from(departmentMembers)
      .innerJoin(users, eq(users.id, departmentMembers.userId))
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .where(
        and(
          eq(departmentMembers.workspaceId, workspaceId),
          eq(departmentMembers.status, 'active'),
        ),
      );

    const withHistory = await Promise.all(
      members.map(async (m) => {
        const [latest] = await this.db
          .select({
            jobTitle: employmentHistory.jobTitle,
            employmentType: employmentHistory.employmentType,
            effectiveFrom: employmentHistory.effectiveFrom,
          })
          .from(employmentHistory)
          .where(eq(employmentHistory.departmentMemberId, m.departmentMemberId))
          .orderBy(desc(employmentHistory.effectiveFrom))
          .limit(1);

        return {
          ...m,
          jobTitle: latest?.jobTitle ?? null,
          employmentType: latest?.employmentType ?? null,
          effectiveFrom: latest?.effectiveFrom ?? null,
        };
      }),
    );

    return withHistory;
  }


  /**
   * Records one employment fact — a title change, a department move, a
   * termination. Append-only: this always inserts, never updates a past
   * row, matching `staff_compensation`'s pattern.
   */
  async recordEvent(
    workspaceId: string,
    departmentMemberId: string,
    eventType: 'hired' | 'title_change' | 'department_change' | 'employment_type_change' | 'terminated',
    fields: {
      jobTitle?: string;
      employmentType?: 'full_time' | 'part_time' | 'contract' | 'casual';
      note?: string;
    },
    recordedByUserId: string,
  ): Promise<void> {
    await this.db.insert(employmentHistory).values({
      departmentMemberId,
      workspaceId,
      eventType,
      jobTitle: fields.jobTitle,
      employmentType: fields.employmentType,
      note: fields.note,
      effectiveFrom: new Date(),
      recordedByUserId,
    });
  }

}