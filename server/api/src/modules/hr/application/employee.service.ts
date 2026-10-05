import { Injectable } from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

import { EmployeeRepository } from '../infrastructure/employee.repository';

/**
 * The employee roster (HR module, Phase 1, first pass — no ADR yet).
 *
 * No PII access logging here: this design carries no field as sensitive as
 * a national ID (see `hr.ts`) — it is job title, employment type and
 * dates, the same class of fact `team.manage` already discloses.
 */
@Injectable()
export class EmployeeService {
  constructor(private readonly employees: EmployeeRepository) {}

  async list(ws: WorkspaceAccess) {
    const rows = await this.employees.listForWorkspace(ws.workspaceId);
    return {
      employees: rows.map((row) => ({
        departmentMemberId: row.departmentMemberId,
        userId: row.userId,
        name: row.name,
        email: row.email,
        departmentId: row.departmentId,
        departmentName: row.departmentName,
        jobTitle: row.jobTitle,
        employmentType: row.employmentType,
        effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      })),
    };
  }


  async recordEvent(
    ws: WorkspaceAccess,
    departmentMemberId: string,
    eventType: 'hired' | 'title_change' | 'department_change' | 'employment_type_change' | 'terminated',
    fields: { jobTitle?: string; employmentType?: 'full_time' | 'part_time' | 'contract' | 'casual'; note?: string },
    recordedByUserId: string,
  ) {
    await this.employees.recordEvent(
      ws.workspaceId,
      departmentMemberId,
      eventType,
      fields,
      recordedByUserId,
    );
  }
}