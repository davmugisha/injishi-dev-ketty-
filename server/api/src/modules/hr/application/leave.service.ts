import { BadRequestException, Injectable } from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

import { LeaveRepository } from '../infrastructure/leave.repository';

@Injectable()
export class LeaveService {
  constructor(private readonly leave: LeaveRepository) {}

  async list(ws: WorkspaceAccess) {
    return this.leave.listForWorkspace(ws.workspaceId);
  }

  /** Enforces applicableAfterDays, if the workspace has set one for this type. */
  async createRequest(
    ws: WorkspaceAccess,
    departmentMemberId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    startDate: string,
    endDate: string,
    reason?: string,
  ) {
    const settings = await this.leave.getTypeSettings(ws.workspaceId, leaveType);
    if (settings && settings.applicableAfterDays > 0) {
      const hireDate = await this.leave.getHireDate(departmentMemberId);
      if (hireDate) {
        const daysEmployed = Math.floor(
          (new Date(startDate).getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysEmployed < settings.applicableAfterDays) {
          throw new BadRequestException(
            `This leave type is only available after ${settings.applicableAfterDays} days of employment.`,
          );
        }
      }
    }

    return this.leave.createRequest(ws.workspaceId, departmentMemberId, leaveType, startDate, endDate, reason);
  }

  async decide(requestId: string, status: 'approved' | 'rejected', userId: string) {
    await this.leave.decide(requestId, status, userId);
  }

  async setBalance(
    ws: WorkspaceAccess,
    departmentMemberId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    year: number,
    allocatedDays: number,
  ) {
    await this.leave.setBalance(ws.workspaceId, departmentMemberId, leaveType, year, allocatedDays);
  }

  async getBalanceSummary(
    departmentMemberId: string,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    year: number,
  ) {
    const allocated = await this.leave.getBalance(departmentMemberId, leaveType, year);
    const used = await this.leave.getUsedDays(departmentMemberId, leaveType, year);
    return { allocated, used, remaining: allocated - used };
  }

  async listTypeSettings(ws: WorkspaceAccess) {
    return this.leave.listTypeSettings(ws.workspaceId);
  }

  async setTypeSettings(
    ws: WorkspaceAccess,
    leaveType: 'annual' | 'sick' | 'unpaid' | 'other',
    settings: {
      isUnpaid: boolean;
      carryForward: boolean;
      applicableAfterDays: number;
      maxConsecutiveDays?: number;
    },
  ) {
    await this.leave.setTypeSettings(ws.workspaceId, leaveType, settings);
  }
}
