import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte } from 'drizzle-orm';

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
}

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
        name: users.name,
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
      })
      .from(leaveRequests)
      .innerJoin(departmentMembers, eq(departmentMembers.id, leaveRequests.departmentMemberId))
      .innerJoin(users, eq(users.id, departmentMembers.userId))
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

  async decide(
    requestId: string,
    status: 'approved' | 'rejected',
    decidedByUserId: string,
  ): Promise<void> {
    await this.db
      .update(leaveRequests)
      .set({ status, decidedByUserId, decidedAt: new Date() })
      .where(eq(leaveRequests.id, requestId));
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
      .select({
        leaveType: leaveTypeSettings.leaveType,
        isUnpaid: leaveTypeSettings.isUnpaid,
        carryForward: leaveTypeSettings.carryForward,
        applicableAfterDays: leaveTypeSettings.applicableAfterDays,
        maxConsecutiveDays: leaveTypeSettings.maxConsecutiveDays,
      })
      .from(leaveTypeSettings)
      .where(eq(leaveTypeSettings.workspaceId, workspaceId));
  }

  async getTypeSettings(
    workspaceId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
  ): Promise<LeaveTypeSettingsRow | null> {
    const [row] = await this.db
      .select({
        leaveType: leaveTypeSettings.leaveType,
        isUnpaid: leaveTypeSettings.isUnpaid,
        carryForward: leaveTypeSettings.carryForward,
        applicableAfterDays: leaveTypeSettings.applicableAfterDays,
        maxConsecutiveDays: leaveTypeSettings.maxConsecutiveDays,
      })
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
}
