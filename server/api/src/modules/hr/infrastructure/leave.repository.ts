import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { users } from '../../../database/drizzle/auth';
import { departmentMembers } from '../../../database/drizzle/operations';
import { employmentHistory } from '../../../database/drizzle/hr';
import {
  leaveBalances,
  leaveRequests,
  leaveTypeSettings,
} from '../../../database/drizzle/hr-lifecycle';

export interface LeaveRequestRow {
  id: string;
  departmentMemberId: string;
  name: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
}

export interface LeaveTypeSettingsRow {
  leaveType: string;
  isUnpaid: boolean;
  carryForward: boolean;
  applicableAfterDays: number;
  maxConsecutiveDays: number | null;
  /** Null on each of these is "the default for this type", not "none". */
  yearlyDays: number | null;
  seniorityEveryYears: number | null;
  seniorityExtraDays: number | null;
  seniorityCapDays: number | null;
}

/** The columns of a leave rule, read the same way everywhere. */
const settingsColumns = {
  leaveType: leaveTypeSettings.leaveType,
  isUnpaid: leaveTypeSettings.isUnpaid,
  carryForward: leaveTypeSettings.carryForward,
  applicableAfterDays: leaveTypeSettings.applicableAfterDays,
  maxConsecutiveDays: leaveTypeSettings.maxConsecutiveDays,
  yearlyDays: leaveTypeSettings.yearlyDays,
  seniorityEveryYears: leaveTypeSettings.seniorityEveryYears,
  seniorityExtraDays: leaveTypeSettings.seniorityExtraDays,
  seniorityCapDays: leaveTypeSettings.seniorityCapDays,
};

/**
 * Leave requests, balances, and per-type settings (HR module, Phase 4).
 * A balance is an allocation; days used are computed here from approved
 * requests, never stored, so the two can't drift apart.
 */
@Injectable()
export class LeaveRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForWorkspace(workspaceId: string): Promise<LeaveRequestRow[]> {
    return this.db
      .select({
        id: leaveRequests.id,
        departmentMemberId: leaveRequests.departmentMemberId,
        name: sql<string | null>`coalesce(${users.name}, ${departmentMembers.displayName})`,
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
      })
      .from(leaveRequests)
      .innerJoin(departmentMembers, eq(departmentMembers.id, leaveRequests.departmentMemberId))
      .leftJoin(users, eq(users.id, departmentMembers.userId))
      .where(eq(leaveRequests.workspaceId, workspaceId));
  }

  async createRequest(
    workspaceId: string,
    departmentMemberId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    startDate: string,
    endDate: string,
    reason: string | undefined,
  ): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(leaveRequests)
      .values({ workspaceId, departmentMemberId, leaveType, startDate, endDate, reason })
      .returning({ id: leaveRequests.id });
    return row;
  }

  /**
   * Record a decision on a request of THIS workspace. A request id from
   * another business matches no row and answers false, rather than being
   * decided by somebody with no say over it.
   */
  async decide(
    workspaceId: string,
    requestId: string,
    status: 'approved' | 'rejected',
    decidedByUserId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .update(leaveRequests)
      .set({ status, decidedByUserId, decidedAt: new Date() })
      .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.workspaceId, workspaceId)))
      .returning({ id: leaveRequests.id });
    return rows.length > 0;
  }

  async setBalance(
    workspaceId: string,
    departmentMemberId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    year: number,
    allocatedDays: number,
  ): Promise<void> {
    await this.db
      .insert(leaveBalances)
      .values({ workspaceId, departmentMemberId, leaveType, year, allocatedDays })
      .onConflictDoUpdate({
        target: [leaveBalances.departmentMemberId, leaveBalances.leaveType, leaveBalances.year],
        set: { allocatedDays },
      });
  }

  async getBalance(
    departmentMemberId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    year: number,
  ): Promise<number> {
    const [row] = await this.db
      .select({ allocatedDays: leaveBalances.allocatedDays })
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.departmentMemberId, departmentMemberId),
          eq(leaveBalances.leaveType, leaveType),
          eq(leaveBalances.year, year),
        ),
      )
      .limit(1);
    return row?.allocatedDays ?? 0;
  }

  async getUsedDays(
    departmentMemberId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    year: number,
  ): Promise<number> {
    const rows = await this.db
      .select({ startDate: leaveRequests.startDate, endDate: leaveRequests.endDate })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.departmentMemberId, departmentMemberId),
          eq(leaveRequests.leaveType, leaveType),
          eq(leaveRequests.status, 'approved'),
          gte(leaveRequests.startDate, `${year}-01-01`),
          lte(leaveRequests.endDate, `${year}-12-31`),
        ),
      );

    return rows.reduce((sum, r) => {
      const days =
        (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1;
      return sum + days;
    }, 0);
  }

  /** The earliest 'hired' event for this person, used to enforce applicableAfterDays. */
  async getHireDate(departmentMemberId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ effectiveFrom: employmentHistory.effectiveFrom })
      .from(employmentHistory)
      .where(
        and(
          eq(employmentHistory.departmentMemberId, departmentMemberId),
          eq(employmentHistory.eventType, 'hired'),
        ),
      )
      .orderBy(asc(employmentHistory.effectiveFrom))
      .limit(1);
    return row?.effectiveFrom ?? null;
  }

  async listTypeSettings(workspaceId: string): Promise<LeaveTypeSettingsRow[]> {
    return this.db
      .select(settingsColumns)
      .from(leaveTypeSettings)
      .where(eq(leaveTypeSettings.workspaceId, workspaceId));
  }

  async getTypeSettings(
    workspaceId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
  ): Promise<LeaveTypeSettingsRow | null> {
    const [row] = await this.db
      .select(settingsColumns)
      .from(leaveTypeSettings)
      .where(
        and(eq(leaveTypeSettings.workspaceId, workspaceId), eq(leaveTypeSettings.leaveType, leaveType)),
      )
      .limit(1);
    return row ?? null;
  }

  async setTypeSettings(
    workspaceId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    settings: {
      isUnpaid: boolean;
      carryForward: boolean;
      applicableAfterDays: number;
      maxConsecutiveDays?: number;
      yearlyDays?: number | null;
      seniorityEveryYears?: number | null;
      seniorityExtraDays?: number | null;
      seniorityCapDays?: number | null;
    },
  ): Promise<void> {
    await this.db
      .insert(leaveTypeSettings)
      .values({ workspaceId, leaveType, ...settings })
      .onConflictDoUpdate({
        target: [leaveTypeSettings.workspaceId, leaveTypeSettings.leaveType],
        set: settings,
      });
  }

  // --- The whole workspace at once -----------------------------------------

  /** Everybody who works here now, with what tells one person's records apart. */
  async listActiveMembers(
    workspaceId: string,
  ): Promise<{ id: string; userId: string | null; isPrimary: boolean }[]> {
    return this.db
      .select({ id: departmentMembers.id, userId: departmentMembers.userId, isPrimary: departmentMembers.isPrimary })
      .from(departmentMembers)
      .where(and(eq(departmentMembers.workspaceId, workspaceId), eq(departmentMembers.status, 'active')));
  }

  /** When each employee record was first recorded as hired. A record with no such fact is absent. */
  async listHireDates(workspaceId: string): Promise<Map<string, Date>> {
    const rows = await this.db
      .select({
        departmentMemberId: employmentHistory.departmentMemberId,
        hiredOn: sql<string>`min(${employmentHistory.effectiveFrom})`,
      })
      .from(employmentHistory)
      .where(and(eq(employmentHistory.workspaceId, workspaceId), eq(employmentHistory.eventType, 'hired')))
      .groupBy(employmentHistory.departmentMemberId);
    return new Map(rows.map((row) => [row.departmentMemberId, new Date(row.hiredOn)]));
  }

  /**
   * Hand allowances back to the rule: delete the figures set by hand for a
   * year. Narrowed to some records, or to one leave type, when either is
   * given. The workspace is always in the `where`.
   */
  async deleteBalances(
    workspaceId: string,
    year: number,
    only: { departmentMemberIds?: readonly string[]; leaveType?: 'annual' | 'sick' | 'unpaid' | 'other' },
  ): Promise<number> {
    if (only.departmentMemberIds && only.departmentMemberIds.length === 0) return 0;
    const rows = await this.db
      .delete(leaveBalances)
      .where(
        and(
          eq(leaveBalances.workspaceId, workspaceId),
          eq(leaveBalances.year, year),
          only.leaveType ? eq(leaveBalances.leaveType, only.leaveType) : undefined,
          only.departmentMemberIds ? inArray(leaveBalances.departmentMemberId, [...only.departmentMemberIds]) : undefined,
        ),
      )
      .returning({ id: leaveBalances.id });
    return rows.length;
  }

  /** Every allowance set for a year. */
  async listBalances(
    workspaceId: string,
    year: number,
  ): Promise<{ departmentMemberId: string; leaveType: string; allocatedDays: number }[]> {
    return this.db
      .select({
        departmentMemberId: leaveBalances.departmentMemberId,
        leaveType: leaveBalances.leaveType,
        allocatedDays: leaveBalances.allocatedDays,
      })
      .from(leaveBalances)
      .where(and(eq(leaveBalances.workspaceId, workspaceId), eq(leaveBalances.year, year)));
  }

  /** Approved leave falling in a year, for counting days used across everybody. */
  async listApproved(
    workspaceId: string,
    year: number,
  ): Promise<{ departmentMemberId: string; leaveType: string; startDate: string; endDate: string }[]> {
    return this.db
      .select({
        departmentMemberId: leaveRequests.departmentMemberId,
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.workspaceId, workspaceId),
          eq(leaveRequests.status, 'approved'),
          gte(leaveRequests.startDate, `${year}-01-01`),
          lte(leaveRequests.endDate, `${year}-12-31`),
        ),
      );
  }

  /**
   * Give every employee the same allowance for a year.
   *
   * ONE ALLOWANCE PER PERSON, not per department record. Somebody who works in
   * two departments has two records, and an allowance on each would be read
   * back as double. So the allowance goes on their primary record (or their
   * first, when none is marked) and their other records are set to zero.
   * Answers how many people were given it.
   */
  async setBalanceForEveryone(
    workspaceId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    year: number,
    allocatedDays: number,
  ): Promise<number> {
    const members = await this.db
      .select({
        id: departmentMembers.id,
        userId: departmentMembers.userId,
        isPrimary: departmentMembers.isPrimary,
      })
      .from(departmentMembers)
      .where(
        and(eq(departmentMembers.workspaceId, workspaceId), eq(departmentMembers.status, 'active')),
      );

    // A person is their account; somebody with no account is their own record.
    const people = new Map<string, typeof members>();
    for (const m of members) {
      const key = m.userId ?? m.id;
      people.set(key, [...(people.get(key) ?? []), m]);
    }

    const rows: { departmentMemberId: string; days: number }[] = [];
    for (const records of people.values()) {
      const holder = records.find((r) => r.isPrimary) ?? records[0];
      for (const r of records) rows.push({ departmentMemberId: r.id, days: r.id === holder.id ? allocatedDays : 0 });
    }
    if (rows.length === 0) return 0;

    await this.db
      .insert(leaveBalances)
      .values(
        rows.map((r) => ({
          workspaceId,
          departmentMemberId: r.departmentMemberId,
          leaveType,
          year,
          allocatedDays: r.days,
        })),
      )
      .onConflictDoUpdate({
        target: [leaveBalances.departmentMemberId, leaveBalances.leaveType, leaveBalances.year],
        set: { allocatedDays: sql`excluded.allocated_days` },
      });
    return people.size;
  }

  /**
   * A request by the same PERSON, waiting or approved, that shares a day with
   * these dates — on any of their department records, since a person in two
   * departments cannot be away from one and at work in the other.
   */
  async findOverlap(
    workspaceId: string,
    departmentMemberId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ startDate: string; endDate: string; status: string } | null> {
    const [self] = await this.db
      .select({ userId: departmentMembers.userId })
      .from(departmentMembers)
      .where(
        and(eq(departmentMembers.id, departmentMemberId), eq(departmentMembers.workspaceId, workspaceId)),
      )
      .limit(1);
    if (!self) return null;

    const records = self.userId
      ? await this.db
          .select({ id: departmentMembers.id })
          .from(departmentMembers)
          .where(
            and(eq(departmentMembers.workspaceId, workspaceId), eq(departmentMembers.userId, self.userId)),
          )
      : [{ id: departmentMemberId }];

    const [row] = await this.db
      .select({
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        status: leaveRequests.status,
      })
      .from(leaveRequests)
      .where(
        and(
          inArray(
            leaveRequests.departmentMemberId,
            records.map((r) => r.id),
          ),
          or(eq(leaveRequests.status, 'pending'), eq(leaveRequests.status, 'approved')),
          lte(leaveRequests.startDate, endDate),
          gte(leaveRequests.endDate, startDate),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Whether this id is one of the workspace's own employee records. */
  async memberInWorkspace(workspaceId: string, departmentMemberId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: departmentMembers.id })
      .from(departmentMembers)
      .where(
        and(eq(departmentMembers.id, departmentMemberId), eq(departmentMembers.workspaceId, workspaceId)),
      )
      .limit(1);
    return row !== undefined;
  }
}
