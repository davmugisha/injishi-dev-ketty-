import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { users } from '../../../database/drizzle/auth';
import { departmentMembers, departments } from '../../../database/drizzle/operations';
import { employmentHistory } from '../../../database/drizzle/schema';

type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'casual';

/** One staff member's current HR-visible facts, resolved from their employment_history rows. */
export interface EmployeeRow {
  departmentMemberId: string;
  /** Null for a staffer with no account: an HR record, not a member. */
  userId: string | null;
  name: string | null;
  email: string | null;
  departmentId: string;
  departmentName: string | null;
  jobTitle: string | null;
  employmentType: string | null;
  /** When they were first recorded as hired here. */
  hiredOn: Date | null;
  effectiveFrom: Date | null;
}

/** Somebody whose employment was ended: still on record, no longer on the roster. */
export interface FormerEmployeeRow {
  departmentMemberId: string;
  userId: string | null;
  name: string | null;
  departmentName: string | null;
  jobTitle: string | null;
  hiredOn: Date | null;
  endedOn: Date | null;
  reason: string | null;
  /** Offboarding tasks not yet done — the reason they may still need looking at. */
  openTasks: number;
}

export interface EmploymentEventRow {
  id: string;
  eventType: string;
  jobTitle: string | null;
  employmentType: string | null;
  note: string | null;
  effectiveFrom: Date;
}

/**
 * The newest employment fact that actually NAMES a value. A job title is set
 * by some events and left blank by others (changing the employment type says
 * nothing about the title), so "the latest row's title" would blank it the
 * moment any other fact was recorded.
 */
const latestJobTitle = sql<string | null>`(
  select h.job_title from employment_history h
  where h.department_member_id = ${departmentMembers.id} and h.job_title is not null
  order by h.effective_from desc limit 1
)`;
const latestEmploymentType = sql<string | null>`(
  select h.employment_type::text from employment_history h
  where h.department_member_id = ${departmentMembers.id} and h.employment_type is not null
  order by h.effective_from desc limit 1
)`;
const firstHiredOn = sql<Date | null>`(
  select min(h.effective_from) from employment_history h
  where h.department_member_id = ${departmentMembers.id} and h.event_type = 'hired'
)`.mapWith((value) => (value ? new Date(value as string) : null));
const latestFactOn = sql<Date | null>`(
  select max(h.effective_from) from employment_history h
  where h.department_member_id = ${departmentMembers.id}
)`.mapWith((value) => (value ? new Date(value as string) : null));

/**
 * Who works here, with HR facts layered on top of `department_members`
 * (Phase 1, first pass — no ADR yet). "Employee" IS a `department_members`
 * row in this design — see `hr.ts`'s header — so there is no separate
 * roster to maintain; this reads the existing roster and joins in what
 * `employment_history` says.
 *
 * LEAVING IS THE ROSTER'S OWN SOFT REMOVAL. Ending somebody's employment sets
 * `status = 'removed'`, the state every roster, payroll and task query already
 * filters on, so a leaver drops out of all of them at once with no second
 * flag to keep in step. The row and its history stay.
 */
@Injectable()
export class EmployeeRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForWorkspace(workspaceId: string): Promise<EmployeeRow[]> {
    return this.db
      .select({
        departmentMemberId: departmentMembers.id,
        userId: departmentMembers.userId,
        name: sql<string | null>`coalesce(${users.name}, ${departmentMembers.displayName})`,
        email: users.email,
        departmentId: departmentMembers.departmentId,
        departmentName: departments.name,
        jobTitle: latestJobTitle,
        employmentType: latestEmploymentType,
        hiredOn: firstHiredOn,
        effectiveFrom: latestFactOn,
      })
      .from(departmentMembers)
      // LEFT, not inner: a staffer with no account has no `users` row.
      .leftJoin(users, eq(users.id, departmentMembers.userId))
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .where(
        and(
          eq(departmentMembers.workspaceId, workspaceId),
          eq(departmentMembers.status, 'active'),
        ),
      );
  }

  /** People whose employment here was ended, newest leaver first. */
  async listFormer(workspaceId: string): Promise<FormerEmployeeRow[]> {
    const endedOn = sql<Date | null>`(
      select max(h.effective_from) from employment_history h
      where h.department_member_id = ${departmentMembers.id} and h.event_type = 'terminated'
    )`.mapWith((value) => (value ? new Date(value as string) : null));

    return this.db
      .select({
        departmentMemberId: departmentMembers.id,
        userId: departmentMembers.userId,
        name: sql<string | null>`coalesce(${users.name}, ${departmentMembers.displayName})`,
        departmentName: departments.name,
        jobTitle: latestJobTitle,
        hiredOn: firstHiredOn,
        endedOn,
        reason: sql<string | null>`(
          select h.note from employment_history h
          where h.department_member_id = ${departmentMembers.id} and h.event_type = 'terminated'
          order by h.effective_from desc limit 1
        )`,
        openTasks: sql<number>`(
          select count(*)::int from checklist_items c
          where c.department_member_id = ${departmentMembers.id}
            and c.kind = 'offboarding' and not c.done
        )`,
      })
      .from(departmentMembers)
      .leftJoin(users, eq(users.id, departmentMembers.userId))
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .where(
        and(
          eq(departmentMembers.workspaceId, workspaceId),
          eq(departmentMembers.status, 'removed'),
          // Only people HR ended. A member removed from a department some
          // other way is not a former employee, just a changed roster.
          sql`exists (
            select 1 from employment_history h
            where h.department_member_id = ${departmentMembers.id} and h.event_type = 'terminated'
          )`,
        ),
      )
      .orderBy(desc(endedOn));
  }

  /** This workspace's own record for that id, or null when it is not theirs. */
  async findMember(
    workspaceId: string,
    departmentMemberId: string,
  ): Promise<{ id: string; status: 'active' | 'removed' } | null> {
    const [row] = await this.db
      .select({ id: departmentMembers.id, status: departmentMembers.status })
      .from(departmentMembers)
      .where(
        and(
          eq(departmentMembers.id, departmentMemberId),
          eq(departmentMembers.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async setStatus(departmentMemberId: string, status: 'active' | 'removed'): Promise<void> {
    await this.db
      .update(departmentMembers)
      .set({ status, updatedAt: new Date() })
      .where(eq(departmentMembers.id, departmentMemberId));
  }

  /** Every employment fact about one person, newest first. */
  async history(departmentMemberId: string): Promise<EmploymentEventRow[]> {
    return this.db
      .select({
        id: employmentHistory.id,
        eventType: employmentHistory.eventType,
        jobTitle: employmentHistory.jobTitle,
        employmentType: employmentHistory.employmentType,
        note: employmentHistory.note,
        effectiveFrom: employmentHistory.effectiveFrom,
      })
      .from(employmentHistory)
      .where(eq(employmentHistory.departmentMemberId, departmentMemberId))
      .orderBy(desc(employmentHistory.effectiveFrom));
  }

  /**
   * Put somebody with NO ACCOUNT on a department's roster as an HR record.
   *
   * The department is looked up inside the caller's workspace rather than
   * trusted from the request, so nobody can file a person under another
   * business's department. Answers null when it is not theirs.
   */
  async createWithoutAccount(
    workspaceId: string,
    departmentId: string,
    name: string,
  ): Promise<string | null> {
    const [department] = await this.db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.workspaceId, workspaceId)))
      .limit(1);
    if (!department) return null;

    const [row] = await this.db
      .insert(departmentMembers)
      .values({ departmentId, workspaceId, displayName: name })
      .returning({ id: departmentMembers.id });
    return row?.id ?? null;
  }

  /**
   * Record the day somebody really started.
   *
   * THE ONE PLACE A PAST ROW IS EDITED, AND ON PURPOSE. Every other fact here
   * is appended, because it was true when it was written. The date on the
   * first 'hired' row never was: nobody entered it. It is the moment HR set
   * the person up in this module, which for anybody already employed is years
   * after they started. Leave is worked out from this date (a share of the
   * first year, more days for long service), so it has to be correctable, and
   * appending a second 'hired' row could only ever move it earlier.
   *
   * Somebody with no 'hired' row at all is given one, on that date.
   */
  async setStartDate(
    workspaceId: string,
    departmentMemberId: string,
    startedAt: Date,
    recordedByUserId: string,
  ): Promise<void> {
    const [first] = await this.db
      .select({ id: employmentHistory.id })
      .from(employmentHistory)
      .where(
        and(
          eq(employmentHistory.departmentMemberId, departmentMemberId),
          eq(employmentHistory.workspaceId, workspaceId),
          eq(employmentHistory.eventType, 'hired'),
        ),
      )
      .orderBy(asc(employmentHistory.effectiveFrom))
      .limit(1);
    if (first) {
      await this.db
        .update(employmentHistory)
        .set({ effectiveFrom: startedAt, updatedAt: new Date() })
        .where(eq(employmentHistory.id, first.id));
      return;
    }
    await this.db.insert(employmentHistory).values({
      departmentMemberId,
      workspaceId,
      eventType: 'hired',
      effectiveFrom: startedAt,
      recordedByUserId,
    });
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
      employmentType?: EmploymentType;
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
