import {
  effectivePermissionsForRole,
  type LeaveApprovalStep,
  type LeaveApproverList,
  type MyDocumentList,
  type NextPublicHoliday,
  type OrgRole,
  parseRolePermissionOverride,
} from '@injishi/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

import { kigaliToday, yearOf } from '../domain/hr-calendar';
import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { HrRulesRepository } from '../infrastructure/hr-rules.repository';
import { MyStaffRepository } from '../infrastructure/my-staff.repository';
import { MyWorkRepository } from '../infrastructure/my-work.repository';

/** Who the office step goes to first, when several people hold `leave.approve`. */
const OFFICE_ORDER: readonly string[] = ['hr', 'manager', 'owner'];

/**
 * The staff phone's self reads (real-data 1.3.3): the person's own papers, and who will decide a leave
 * request before they ask. `SessionGuard` only, like every `me/work` route: the file must be the
 * caller's, and any other id is a 404 that says nothing about whether it exists.
 */
@Injectable()
export class MyStaffService {
  constructor(
    private readonly work: MyWorkRepository,
    private readonly employees: EmployeesRepository,
    private readonly staff: MyStaffRepository,
    private readonly rules: HrRulesRepository,
  ) {}

  async documents(userId: string, employeeId: string): Promise<MyDocumentList> {
    const employee = await this.mine(userId, employeeId);
    const [contracts, documents] = await Promise.all([
      this.staff.contracts(employee.id),
      this.staff.documents(employee.id),
    ]);
    return {
      documents: [
        ...contracts.map((c) => ({
          id: c.id,
          kind: 'contract' as const,
          title: 'Employment contract',
          status: c.status,
          contractType: c.contract_type,
          startsOn: c.starts_on,
          issuedOn: null,
          expiresOn: c.ends_on,
          checkedAt: null,
        })),
        ...documents.map((d) => ({
          id: d.id,
          kind: 'document' as const,
          title: d.title,
          status: d.status,
          contractType: null,
          startsOn: null,
          issuedOn: d.issued_on,
          expiresOn: d.expires_on,
          checkedAt: d.status === 'approved' ? d.updated_at : null,
        })),
      ],
    };
  }

  /**
   * The steps a request of this type (annual leave when none is named) would go through, and who
   * would decide each. Step one is the reporting manager; the office step is whoever else at the
   * branch holds `leave.approve`, HR first. It names people, and decides nothing: the decision is
   * `LeaveService.approve`'s, which re-reads all of this when it happens.
   */
  async leaveApprovers(userId: string, employeeId: string, leaveTypeId: string | null): Promise<LeaveApproverList> {
    const employee = await this.mine(userId, employeeId);
    const stepCount = await this.staff.leaveSteps(employee.orgId, leaveTypeId);
    if (stepCount === null) throw new NotFoundException('That leave type is not offered here.');
    if (stepCount === 0) return { steps: [] };

    const manager = await this.staff.manager(employee.id);
    const [members, overrideRows] = await Promise.all([
      this.staff.members(employee.orgId, employee.workPropertyId),
      this.staff.roleOverrides(employee.orgId),
    ]);
    const overrides = overrideRows
      .map((o) => parseRolePermissionOverride({ orgRole: o.org_role, permission: o.permission, granted: o.granted }))
      .filter((o): o is NonNullable<typeof o> => o !== null);
    const office = members
      .filter((m) => m.user_id !== employee.membershipUserId && m.employee_id !== manager?.id)
      .filter((m) => effectivePermissionsForRole(m.org_role as OrgRole, overrides).includes('leave.approve'))
      .sort((a, b) => rank(a.org_role) - rank(b.org_role))[0];

    const steps: LeaveApprovalStep[] = [];
    if (manager) steps.push({ order: 1, role: 'line_manager', name: manager.name, jobTitle: manager.job_title });
    if (office && (stepCount === 2 || !manager)) {
      steps.push({ order: steps.length + 1, role: 'office', name: office.name, jobTitle: office.job_title });
    }
    return { steps };
  }

  /** The next national public holiday from today (Kigali), this year's rule first, then next year's. */
  async nextHoliday(userId: string, employeeId: string): Promise<NextPublicHoliday> {
    await this.mine(userId, employeeId);
    const today = kigaliToday();
    for (const year of [yearOf(today), yearOf(today) + 1]) {
      const row = await this.rules.publicHolidays(year);
      const next = row?.value.dates
        .filter((d) => d.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      if (next) return { holiday: { date: next.date, name: next.name } };
    }
    return { holiday: null };
  }

  private async mine(userId: string, employeeId: string): Promise<EmployeeRow> {
    if (!(await this.work.owned(userId, employeeId))) throw new NotFoundException();
    const employee = await this.employees.find(employeeId);
    if (!employee) throw new NotFoundException();
    return employee;
  }
}

function rank(role: string): number {
  const i = OFFICE_ORDER.indexOf(role);
  return i === -1 ? OFFICE_ORDER.length : i;
}
