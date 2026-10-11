import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

import { EmployeeRepository } from '../infrastructure/employee.repository';
import { ChecklistService } from './checklist.service';

type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'casual';
type EventType = 'hired' | 'title_change' | 'department_change' | 'employment_type_change' | 'terminated';

const EMPLOYMENT_TYPES: readonly EmploymentType[] = ['full_time', 'part_time', 'contract', 'casual'];

/**
 * A start date HR typed, as the instant to store: noon UTC of that day, so the
 * day reads the same in Kigali and in UTC, whichever a reader takes it in.
 * Refused, in words, when it is not a real day or is nowhere near a working life.
 */
function startInstant(startedOn: unknown): Date {
  const day = typeof startedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startedOn) ? startedOn : null;
  const at = day ? new Date(`${day}T12:00:00Z`) : null;
  if (!day || !at || Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== day) {
    throw new BadRequestException('Choose the day they started.');
  }
  const nextYear = Date.now() + 366 * 24 * 60 * 60 * 1000;
  if (day < '1950-01-01' || at.getTime() > nextYear) {
    throw new BadRequestException('That start date is too far away to be right.');
  }
  return at;
}

/**
 * The employee roster (HR module, Phase 1, first pass — no ADR yet).
 *
 * No PII access logging here: this design carries no field as sensitive as
 * a national ID (see `hr.ts`) — it is job title, employment type and
 * dates, the same class of fact `team.manage` already discloses.
 */
@Injectable()
export class EmployeeService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly checklists: ChecklistService,
  ) {}

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
        hiredOn: row.hiredOn?.toISOString() ?? null,
        effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      })),
    };
  }

  /** People whose employment here was ended. */
  async former(ws: WorkspaceAccess) {
    const rows = await this.employees.listFormer(ws.workspaceId);
    return rows.map((row) => ({
      ...row,
      hiredOn: row.hiredOn?.toISOString() ?? null,
      endedOn: row.endedOn?.toISOString() ?? null,
    }));
  }

  /** The id must be one of this workspace's own records, whatever its state. */
  private async own(ws: WorkspaceAccess, departmentMemberId: string) {
    const member = await this.employees.findMember(ws.workspaceId, departmentMemberId);
    if (!member) throw new NotFoundException('That employee is not in this workspace.');
    return member;
  }

  /** Every recorded fact about one person's employment, newest first. */
  async history(ws: WorkspaceAccess, departmentMemberId: string) {
    await this.own(ws, departmentMemberId);
    return this.employees.history(departmentMemberId);
  }

  /**
   * Add a staffer who will never sign in: a name, a department and a job
   * title. No login is created and no permission is granted — this is a
   * record for HR, leave and payroll, nothing more.
   */
  async addWithoutAccount(
    ws: WorkspaceAccess,
    input: {
      name: string;
      departmentId: string;
      jobTitle?: string;
      employmentType?: EmploymentType;
      note?: string;
      /** The day they really started, `YYYY-MM-DD`. Left out, it is today. */
      startedOn?: string;
    },
    recordedByUserId: string,
  ): Promise<{ departmentMemberId: string }> {
    const name = (input.name ?? '').trim();
    if (name.length < 2) {
      throw new BadRequestException("Enter the person's name.");
    }
    // Read before anything is written, so a bad date does not leave half a person behind.
    const startedAt = input.startedOn ? startInstant(input.startedOn) : null;
    const departmentMemberId = await this.employees.createWithoutAccount(
      ws.workspaceId,
      input.departmentId,
      name,
    );
    if (!departmentMemberId) {
      throw new NotFoundException('That department is not part of this workspace.');
    }
    await this.recordEvent(
      ws,
      departmentMemberId,
      'hired',
      { jobTitle: input.jobTitle, employmentType: input.employmentType, note: input.note },
      recordedByUserId,
    );
    if (startedAt) {
      await this.employees.setStartDate(ws.workspaceId, departmentMemberId, startedAt, recordedByUserId);
    }
    return { departmentMemberId };
  }

  /**
   * Record the day somebody really started. Their leave is worked out from it:
   * a share of the year they joined in, and more days once they have been
   * here long enough. Until HR sets it, it is the day they were added here.
   */
  async setStartDate(
    ws: WorkspaceAccess,
    departmentMemberId: string,
    startedOn: string,
    recordedByUserId: string,
  ): Promise<void> {
    await this.own(ws, departmentMemberId);
    await this.employees.setStartDate(ws.workspaceId, departmentMemberId, startInstant(startedOn), recordedByUserId);
  }

  /**
   * Record one employment fact, and do what follows from it.
   *
   * `hired` hands over the onboarding tasks. `terminated` ENDS THE EMPLOYMENT:
   * the offboarding tasks are handed over and the person leaves the roster —
   * and with it payroll, leave and every new task — while their record,
   * history and past payslips stay. It is undone with `reinstate`.
   */
  async recordEvent(
    ws: WorkspaceAccess,
    departmentMemberId: string,
    eventType: EventType,
    fields: { jobTitle?: string; employmentType?: EmploymentType; note?: string },
    recordedByUserId: string,
  ) {
    const member = await this.own(ws, departmentMemberId);

    if (fields.employmentType !== undefined && !EMPLOYMENT_TYPES.includes(fields.employmentType)) {
      throw new BadRequestException('Choose full time, part time, contract or casual.');
    }
    if (eventType === 'employment_type_change' && !fields.employmentType) {
      throw new BadRequestException('Choose the employment type.');
    }
    if (eventType === 'title_change' && !(fields.jobTitle ?? '').trim()) {
      throw new BadRequestException('Enter the job title.');
    }
    if (eventType === 'terminated' && member.status === 'removed') {
      throw new ConflictException("This person's employment has already ended.");
    }
    if (eventType !== 'terminated' && eventType !== 'hired' && member.status === 'removed') {
      throw new ConflictException('This person no longer works here. Bring them back first.');
    }

    await this.employees.recordEvent(
      ws.workspaceId,
      departmentMemberId,
      eventType,
      {
        jobTitle: fields.jobTitle?.trim() || undefined,
        employmentType: fields.employmentType,
        note: fields.note?.trim() || undefined,
      },
      recordedByUserId,
    );

    if (eventType === 'hired') {
      await this.checklists.applyForLifecycleEvent(ws.workspaceId, departmentMemberId, 'onboarding');
    } else if (eventType === 'terminated') {
      // The tasks first, while they are still on the roster the tasks are for.
      await this.checklists.applyForLifecycleEvent(ws.workspaceId, departmentMemberId, 'offboarding');
      await this.employees.setStatus(departmentMemberId, 'removed');
    }
  }

  /**
   * Bring back somebody whose employment was ended — a mistake, or a return.
   * They rejoin the roster in the department they left, with their history.
   */
  async reinstate(ws: WorkspaceAccess, departmentMemberId: string, recordedByUserId: string) {
    const member = await this.own(ws, departmentMemberId);
    if (member.status === 'active') {
      throw new ConflictException('This person is already on the roster.');
    }
    try {
      await this.employees.setStatus(departmentMemberId, 'active');
    } catch {
      // The roster allows one active record per person per department, so this
      // is somebody who was added to that department again after they left.
      throw new ConflictException('This person is already back in that department.');
    }
    await this.employees.recordEvent(
      ws.workspaceId,
      departmentMemberId,
      'hired',
      { note: 'Brought back' },
      recordedByUserId,
    );
    await this.checklists.applyForLifecycleEvent(ws.workspaceId, departmentMemberId, 'onboarding');
  }
}
