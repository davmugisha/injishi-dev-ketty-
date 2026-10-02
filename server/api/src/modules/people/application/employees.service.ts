import type {
  CreateContractRequest,
  CreateContractResponse,
  CreateEmployeeRequest,
  Employee,
  EmployeeFile,
  EmployeeListQuery,
  EmployeePage,
  OffboardEmployeeRequest,
  UpdateEmployeeRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { isCalendarDate } from '../../booking/domain/pricing';
import { addDays, kigaliToday, lastOfMonth, monthOf } from '../domain/hr-calendar';
import {
  EmployeesRepository,
  violatedConstraint,
  type EmployeeRow,
  type EmployeeValues,
} from '../infrastructure/employees.repository';
import { auditDiff, writeHrAudit } from '../infrastructure/hr-audit';
import { TimeRepository } from '../infrastructure/time.repository';
import {
  detailsMissing,
  presentContract,
  presentContractFull,
  presentEmployee,
} from './employee-presenter';
import { assertPersonInReach, fileViewFor, orgOf } from './hr-access';
import { LeaveService } from './leave.service';

const DEFAULT_LIMIT = 50;

/**
 * HR files, contracts and offboarding (ADR-058, first thread).
 *
 * Commands follow the operator pattern: the guard proves the workspace, the
 * business is taken from it and never from the body (AC-U4), and a row of
 * another business answers 404. Every write lands with its audit row in the
 * same transaction (AC-U5).
 */
@Injectable()
export class EmployeesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly employees: EmployeesRepository,
    private readonly time: TimeRepository,
    private readonly leave: LeaveService,
  ) {}

  // --- Reads ---------------------------------------------------------------

  /** `GET /ops/employees`: a page, in the shape the caller may read (AC-P2). */
  async list(ws: ScopedWorkspace, query: EmployeeListQuery): Promise<EmployeePage> {
    const orgId = orgOf(ws);
    const limit = query.limit ?? DEFAULT_LIMIT;
    const rows = await this.employees.list({
      orgId,
      scope: ws.branchScope,
      status: query.status,
      propertyId: query.propertyId,
      departmentId: query.departmentId,
      after: query.cursor,
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    const contracts = await this.employees.currentContracts(page.map((r) => r.id));
    const view = fileViewFor(ws);
    return {
      items: page.map((r) => presentEmployee(r, contracts.get(r.id) ?? null, view)),
      nextCursor: rows.length > limit ? page[page.length - 1].employeeNumber : null,
    };
  }

  /** `GET /ops/employees/:id`: the file, its contracts and its departments. */
  async get(ws: ScopedWorkspace, id: string): Promise<EmployeeFile> {
    const row = this.own(ws, await this.employees.find(id));
    return this.file(row, fileViewFor(ws));
  }

  private async file(row: EmployeeRow, view: 'basic' | 'full'): Promise<EmployeeFile> {
    const contracts = await this.employees.contracts(row.id);
    const current =
      contracts.find((c) => c.status === 'active') ??
      [...contracts].reverse().find((c) => c.status === 'scheduled') ??
      null;
    return {
      employee: presentEmployee(row, current, view),
      contracts: contracts.map((c) => presentContract(c, view)),
      departments: await this.employees.departmentsOf(row.id),
    };
  }

  // --- Create and edit -----------------------------------------------------

  /** `POST /ops/employees` (AC-P1, AC-P3). */
  async create(ws: ScopedWorkspace, userId: string, body: CreateEmployeeRequest): Promise<Employee> {
    const orgId = orgOf(ws);
    this.assertDates({ dateOfBirth: body.dateOfBirth, hiredOn: body.hiredOn });
    await this.assertBranch(ws, orgId, body.workPropertyId);
    if (body.reportingManagerId) await this.assertManager(orgId, null, body.reportingManagerId);
    await this.assertIdFree(orgId, null, body.idDocumentType, body.idDocumentNumber);
    const typedNumber = body.employeeNumber?.trim();
    if (typedNumber && (await this.employees.numberTaken(orgId, typedNumber))) {
      throw new ConflictException(`Employee number ${typedNumber} is already on a file.`);
    }

    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        const employeeNumber = typedNumber || (await this.employees.mintEmployeeNumber(tx, orgId));
        const values = {
          employeeNumber,
          legalName: body.legalName.trim(),
          preferredName: body.preferredName?.trim() || null,
          phone: body.phone,
          email: body.email ?? null,
          dateOfBirth: body.dateOfBirth,
          sex: body.sex,
          idDocumentType: body.idDocumentType,
          idDocumentNumber: body.idDocumentNumber.trim(),
          rssbNumber: body.rssbNumber?.trim() || null,
          workPropertyId: body.workPropertyId,
          reportingManagerId: body.reportingManagerId ?? null,
          hiredOn: body.hiredOn,
        };
        const created = await this.employees.insert(tx, orgId, values);
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'employee',
          subjectId: created,
          eventType: 'hr.employee_created',
          orgId,
          diff: auditDiff(null, values),
        });
        return created;
      });
    } catch (error) {
      throw await this.translateUnique(error, orgId, body.idDocumentType, body.idDocumentNumber, typedNumber);
    }
    const row = await this.employees.find(id);
    if (!row) throw new NotFoundException();
    return presentEmployee(row, null, fileViewFor(ws));
  }

  /** `PATCH /ops/employees/:id` (AC-P3, AC-P6). */
  async update(ws: ScopedWorkspace, userId: string, id: string, body: UpdateEmployeeRequest): Promise<Employee> {
    const orgId = orgOf(ws);
    const row = this.own(ws, await this.employees.find(id));
    assertPersonInReach(ws, row.workPropertyId);
    this.assertDates({ dateOfBirth: body.dateOfBirth, hiredOn: body.hiredOn });
    if (body.workPropertyId && body.workPropertyId !== row.workPropertyId) {
      await this.assertBranch(ws, orgId, body.workPropertyId);
    }
    if (body.reportingManagerId) await this.assertManager(orgId, row.id, body.reportingManagerId);
    if (body.idDocumentType && body.idDocumentNumber) {
      await this.assertIdFree(orgId, row.id, body.idDocumentType, body.idDocumentNumber.trim());
    }
    const typedNumber = body.employeeNumber?.trim();
    if (typedNumber && typedNumber !== row.employeeNumber && (await this.employees.numberTaken(orgId, typedNumber))) {
      throw new ConflictException(`Employee number ${typedNumber} is already on a file.`);
    }

    const values: EmployeeValues = {};
    if (body.legalName !== undefined) values.legalName = body.legalName.trim();
    if (body.preferredName !== undefined) values.preferredName = body.preferredName?.trim() || null;
    if (body.phone !== undefined) values.phone = body.phone;
    if (body.email !== undefined) values.email = body.email;
    if (body.dateOfBirth !== undefined) values.dateOfBirth = body.dateOfBirth;
    if (body.sex !== undefined) values.sex = body.sex;
    if (body.idDocumentType !== undefined) values.idDocumentType = body.idDocumentType;
    if (body.idDocumentNumber !== undefined) values.idDocumentNumber = body.idDocumentNumber.trim();
    if (body.rssbNumber !== undefined) values.rssbNumber = body.rssbNumber?.trim() || null;
    if (body.workPropertyId !== undefined) values.workPropertyId = body.workPropertyId;
    if (body.reportingManagerId !== undefined) values.reportingManagerId = body.reportingManagerId;
    if (body.hiredOn !== undefined) values.hiredOn = body.hiredOn;
    if (typedNumber !== undefined) values.employeeNumber = typedNumber;

    try {
      const done = await this.employees.withEmployeeLock(row.id, async (tx, locked) => {
        if (values.hiredOn !== undefined && values.hiredOn !== locked.hiredOn) {
          // The hire date seeds accrual and prorates pay, so once either has
          // happened it is history (AC-P6).
          if (await this.employees.hireDateLocked(locked.id, tx)) {
            throw new ConflictException(
              'The hire date cannot change once leave has been earned or pay has been computed from it.',
            );
          }
        }
        if (values.reportingManagerId && (await this.employees.wouldLoop(locked.id, values.reportingManagerId, tx))) {
          throw new ConflictException('That would make someone their own manager, through the chain.');
        }
        await this.employees.update(tx, locked.id, values);
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'employee',
          subjectId: locked.id,
          eventType: 'hr.employee_updated',
          orgId,
          diff: auditDiff(locked as unknown as Record<string, unknown>, values as Record<string, unknown>),
        });
        return true;
      });
      if (!done) throw new NotFoundException();
    } catch (error) {
      throw await this.translateUnique(error, orgId, body.idDocumentType, body.idDocumentNumber, typedNumber);
    }
    const updated = await this.employees.find(row.id);
    if (!updated) throw new NotFoundException();
    const contracts = await this.employees.currentContracts([updated.id]);
    return presentEmployee(updated, contracts.get(updated.id) ?? null, fileViewFor(ws));
  }

  // --- Contracts -----------------------------------------------------------

  /** `POST /ops/employees/:id/contracts` (AC-P4). */
  async createContract(
    ws: ScopedWorkspace,
    userId: string,
    id: string,
    body: CreateContractRequest,
  ): Promise<CreateContractResponse> {
    const orgId = orgOf(ws);
    const row = this.own(ws, await this.employees.find(id));
    assertPersonInReach(ws, row.workPropertyId);
    if (row.status !== 'active') {
      throw new ConflictException(`${row.legalName} has left, so they cannot start a new contract.`);
    }
    const missing = detailsMissing(row).filter((d) => d !== 'phone');
    if (missing.length > 0) {
      throw new UnprocessableEntityException(
        `Add ${missing.map((m) => MISSING_WORDS[m]).join(', ')} to the file before a contract can start.`,
      );
    }
    if (body.wageBasis !== 'monthly') {
      throw new UnprocessableEntityException(
        'Only monthly wages can be paid so far. Daily and hourly pay comes with the next payroll release.',
      );
    }
    if (!isCalendarDate(body.startsOn) || (body.endsOn && !isCalendarDate(body.endsOn))) {
      throw new UnprocessableEntityException('Those are not real dates.');
    }
    const endsOn = body.endsOn ?? null;
    if (body.contractType === 'fixed_term' && !endsOn) {
      throw new UnprocessableEntityException('A fixed term contract needs an end date.');
    }
    if (endsOn && endsOn < body.startsOn) {
      throw new UnprocessableEntityException('The contract ends before it starts.');
    }
    if (body.startsOn < row.hiredOn) {
      throw new UnprocessableEntityException(`A contract cannot start before the hire date, ${row.hiredOn}.`);
    }
    if (row.offboardedOn && body.startsOn > row.offboardedOn) {
      throw new UnprocessableEntityException('That contract starts after their last day.');
    }

    const today = kigaliToday();
    const result = await this.employees.withEmployeeLock(row.id, async (tx, locked) => {
      const contracts = await this.employees.contracts(locked.id, tx);
      const latest = contracts[0] ?? null;
      if (latest && body.startsOn <= latest.startsOn) {
        throw new UnprocessableEntityException(
          `A new contract must start after the current one, which starts on ${latest.startsOn}.`,
        );
      }
      // The contract it replaces ends the day before, in the same transaction.
      let shortened: string | null = null;
      if (latest && (latest.endsOn === null || latest.endsOn >= body.startsOn)) {
        const newEnd = addDays(body.startsOn, -1);
        await this.employees.updateContract(tx, latest.id, {
          endsOn: newEnd,
          status: newEnd < today ? 'ended' : latest.status,
          endReason: 'Replaced by a new contract',
        });
        shortened = latest.id;
      }
      const status = body.startsOn <= today ? (endsOn && endsOn < today ? 'ended' : 'active') : 'scheduled';
      const created = await this.employees.insertContract(tx, {
        orgId,
        employeeId: locked.id,
        contractType: body.contractType,
        startsOn: body.startsOn,
        endsOn,
        wageBasis: body.wageBasis,
        wageRwf: body.wageRwf,
        status,
        createdByUserId: userId,
      });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: locked.id,
        eventType: 'hr.contract_created',
        orgId,
        diff: {
          contractId: created,
          contractType: body.contractType,
          startsOn: body.startsOn,
          endsOn,
          wageBasis: body.wageBasis,
          wageRwf: 'changed',
          shortened,
        },
      });
      return { created, shortened };
    });
    if (!result) throw new NotFoundException();
    const contract = await this.employees.findContract(result.created);
    const previous = result.shortened ? await this.employees.findContract(result.shortened) : null;
    if (!contract) throw new NotFoundException();
    return {
      contract: presentContractFull(contract),
      shortened: previous ? presentContractFull(previous) : null,
    };
  }

  // --- Offboarding ---------------------------------------------------------

  /**
   * `POST /ops/employees/:id/offboard` (AC-O1, AC-O2): one transaction under
   * the file's lock ends the contract, marks the file, removes the membership
   * and the department rows, clears the roster and leave after the last day,
   * and unhooks anyone who reported to them.
   *
   * Their sessions are NOT deleted. `WorkspaceService` reads the membership as
   * `active` on every request, so removing it ends business access at once;
   * deleting sessions would also sign them out of their guest account and any
   * other employer.
   */
  async offboard(ws: ScopedWorkspace, userId: string, id: string, body: OffboardEmployeeRequest): Promise<Employee> {
    const orgId = orgOf(ws);
    const row = this.own(ws, await this.employees.find(id));
    assertPersonInReach(ws, row.workPropertyId);
    if (!isCalendarDate(body.lastDay)) throw new UnprocessableEntityException('That is not a real date.');
    if (row.orgMembershipId && row.membershipStatus === 'active') {
      if (row.membershipRole === 'owner') {
        throw new UnprocessableEntityException('An owner cannot be offboarded here.');
      }
      // Removing somebody's access is staffing the business, which is the
      // owner's alone (AC-O2).
      if (!ws.permissions.includes('team.manage')) {
        throw new ForbiddenException(
          'This person has an account here, and taking it away needs the power to manage the team.',
        );
      }
    }
    if (body.lastDay < row.hiredOn) {
      throw new UnprocessableEntityException(`The last day cannot be before the hire date, ${row.hiredOn}.`);
    }

    const done = await this.employees.withEmployeeLock(row.id, async (tx, locked) => {
      if (locked.status !== 'active') {
        throw new ConflictException(`${locked.legalName} has already been offboarded.`);
      }
      const frozen = await this.employees.latestConfirmedPeriod(orgId, tx);
      if (frozen && body.lastDay <= lastOfMonth(monthOf(frozen))) {
        throw new ConflictException(
          `Pay for ${monthOf(frozen)} is confirmed, so the last day must fall after it.`,
        );
      }
      const today = kigaliToday();
      const contracts = await this.employees.contracts(locked.id, tx);
      const later = contracts.find((c) => c.startsOn > body.lastDay && c.status !== 'ended');
      if (later) {
        // Pay reads contract dates, and a contract cannot end before it starts,
        // so a scheduled contract after the last day has no honest end date.
        throw new ConflictException(
          `A contract is scheduled to start on ${later.startsOn}, after that last day. Choose a last day on or after it.`,
        );
      }
      let endedContract: string | null = null;
      for (const c of contracts) {
        if (c.status === 'ended') continue;
        if (c.endsOn === null || c.endsOn > body.lastDay) {
          await this.employees.updateContract(tx, c.id, {
            endsOn: body.lastDay,
            status: body.lastDay < today ? 'ended' : c.status,
            endReason: body.reason.trim(),
          });
          endedContract = c.id;
        }
      }
      // Leave first: counting what to reverse reads the roster.
      const leave = await this.leave.closeAfterLastDay(tx, locked, body.lastDay, userId);
      const shifts = await this.time.cancelScheduledBetween(
        tx,
        locked.id,
        addDays(body.lastDay, 1),
        null,
        'Left the business',
      );
      await this.employees.markOffboarded(tx, locked.id, body.lastDay, body.reason.trim());
      if (locked.orgMembershipId) await this.employees.removeMembership(tx, locked.orgMembershipId);
      const departments = await this.employees.removeDepartmentRows(tx, locked.id, locked.orgMembershipId);
      const reports = await this.employees.clearReports(tx, locked.id);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: locked.id,
        eventType: 'hr.employee_offboarded',
        orgId,
        diff: {
          lastDay: body.lastDay,
          contractEnded: endedContract,
          membershipRemoved: locked.orgMembershipId !== null,
          departmentRowsRemoved: departments,
          shiftsCancelled: shifts,
          leaveCancelled: leave.cancelled,
          leaveRowsReversed: leave.reversed,
          reportsCleared: reports,
        },
        reason: body.reason.trim(),
      });
      return true;
    });
    if (!done) throw new NotFoundException();
    const updated = await this.employees.find(row.id);
    if (!updated) throw new NotFoundException();
    return presentEmployee(updated, null, fileViewFor(ws));
  }

  // --- Helpers -------------------------------------------------------------

  /** The file, proved to be this business's and inside the caller's branches. */
  private own(ws: ScopedWorkspace, row: EmployeeRow | null): EmployeeRow {
    const file = assertOwnedByOrg(row, ws);
    assertInBranchScope(ws, file.workPropertyId);
    return file;
  }

  private assertDates(dates: { dateOfBirth?: string; hiredOn?: string }): void {
    for (const [field, value] of Object.entries(dates)) {
      if (value !== undefined && !isCalendarDate(value)) {
        throw new UnprocessableEntityException(`${field === 'hiredOn' ? 'The hire date' : 'The date of birth'} is not a real date.`);
      }
    }
    if (dates.dateOfBirth && dates.dateOfBirth > kigaliToday()) {
      throw new UnprocessableEntityException('The date of birth is in the future.');
    }
  }

  private async assertBranch(ws: ScopedWorkspace, orgId: string, propertyId: string): Promise<void> {
    const property = await this.employees.findProperty(propertyId);
    if (!property || property.orgId !== orgId) {
      throw new UnprocessableEntityException('That branch is not part of this business.');
    }
    assertPersonInReach(ws, propertyId);
  }

  private async assertManager(orgId: string, selfId: string | null, managerId: string): Promise<void> {
    if (managerId === selfId) throw new ConflictException('Nobody reports to themselves.');
    const manager = await this.employees.find(managerId);
    if (!manager || manager.orgId !== orgId || manager.status !== 'active') {
      throw new UnprocessableEntityException('The reporting manager must be someone working here now.');
    }
  }

  /** One file per person per employer, whenever the ID is known (AC-P3). */
  private async assertIdFree(
    orgId: string,
    selfId: string | null,
    type: 'national_id' | 'passport',
    number: string,
  ): Promise<void> {
    const existing = await this.employees.findByIdDocument(orgId, type, number.trim());
    if (existing && existing.id !== selfId) {
      throw new ConflictException(
        `That ID is already on file as employee ${existing.employeeNumber}.`,
      );
    }
  }

  /** A unique violation that raced past the checks above, in the same words. */
  private async translateUnique(
    error: unknown,
    orgId: string,
    idType: 'national_id' | 'passport' | undefined,
    idNumber: string | undefined,
    typedNumber: string | undefined,
  ): Promise<unknown> {
    const constraint = violatedConstraint(error);
    if (constraint === 'employees_id_document_uk' && idType && idNumber) {
      const existing = await this.employees.findByIdDocument(orgId, idType, idNumber.trim());
      return new ConflictException(
        `That ID is already on file as employee ${existing?.employeeNumber ?? 'another'}.`,
      );
    }
    if (constraint === 'employees_number_uk') {
      return new ConflictException(`Employee number ${typedNumber ?? ''} is already on a file.`.trim());
    }
    return error;
  }
}

const MISSING_WORDS: Record<string, string> = {
  dateOfBirth: 'the date of birth',
  sex: 'sex',
  idDocument: 'the ID document',
};
