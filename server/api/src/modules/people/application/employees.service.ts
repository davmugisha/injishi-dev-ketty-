import type {
  CreateContractRequest,
  CreateContractResponse,
  CreateEmployeeRequest,
  Employee,
  EmployeeFile,
  EmployeePage,
  ListIds,
  ListQuery,
  OffboardEmployeeRequest,
  UpdateEmployeeRequest,
} from '@injishi/contracts';
import { EMPLOYEE_LIST } from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { StorageService, hrFileKind } from '../../storage/application/storage.service';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { toCsv, type CsvColumn } from '../../../shared/lists/csv';
import { pageOf } from '../../../shared/lists/list-query';
import { ListExportService } from '../../lists/application/list-export.service';
import { isCalendarDate } from '../../booking/domain/pricing';
import { addDays, kigaliToday, lastOfMonth, monthOf } from '../domain/hr-calendar';
import {
  EmployeesRepository,
  violatedConstraint,
  type EmployeeRow,
  type EmployeeTagRow,
  type EmployeeValues,
} from '../infrastructure/employees.repository';
import { auditDiff, writeHrAudit } from '../infrastructure/hr-audit';
import { TimeRepository } from '../infrastructure/time.repository';
import {
  detailsMissing,
  displayNameOf,
  presentContract,
  presentContractFull,
  presentEmployee,
} from './employee-presenter';
import { assertPersonInReach, fileViewFor, orgOf } from './hr-access';
import { LeaveService } from './leave.service';


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
    private readonly exports: ListExportService,
    private readonly storage: StorageService,
  ) {}

  // --- Reads ---------------------------------------------------------------

  /**
   * `GET /ops/employees`: one page through the list contract, in the shape the
   * caller may read (AC-P2, AC-LF3, AC-LF4).
   */
  async list(ws: ScopedWorkspace, query: ListQuery): Promise<EmployeePage> {
    const orgId = orgOf(ws);
    const view = fileViewFor(ws);
    const page = await this.employees.listPage({ orgId, scope: ws.branchScope, view, query });
    const ids = page.rows.map((r) => r.id);
    const [contracts, tags] = await Promise.all([this.employees.currentContracts(ids), this.employees.tagsOf(ids)]);
    return pageOf(
      page.rows.map((r) => presentEmployee(r, contracts.get(r.id) ?? null, view, tags.get(r.id))),
      page.total,
      query,
      { groups: page.groups, statusCounts: page.statusCounts },
    );
  }

  /** `GET /ops/employees/ids`: select all, under the same view rule as the list (AC-LF15). */
  ids(ws: ScopedWorkspace, query: ListQuery): Promise<ListIds> {
    return this.employees.listIds({ orgId: orgOf(ws), scope: ws.branchScope, view: fileViewFor(ws), query });
  }

  /**
   * `GET /ops/employees/export.csv`: the current view as CSV (AC-LF7). The same
   * query and the same view rule as the list, every page of it up to the cap,
   * the personal columns only for a `full` view, and one `report_runs` row.
   */
  async exportCsv(
    ws: ScopedWorkspace,
    userId: string,
    query: ListQuery,
    columnKeys: readonly string[] | null,
  ): Promise<{ filename: string; body: string }> {
    const orgId = orgOf(ws);
    const view = fileViewFor(ws);
    const rows: EmployeeRow[] = [];
    let total = 0;
    for (let page = 1; ; page += 1) {
      const chunk = await this.employees.listPage({
        orgId,
        scope: ws.branchScope,
        view,
        query: { ...query, page, pageSize: 100, groupBy: undefined },
      });
      if (page === 1) {
        total = chunk.total;
        this.exports.assertExportable(total);
      }
      rows.push(...chunk.rows);
      if (chunk.rows.length < 100 || rows.length >= total) break;
    }
    const tags = await this.employees.tagsOf(rows.map((r) => r.id));
    const columns = employeeCsvColumns(view, tags).filter((c) => !columnKeys || columnKeys.includes(c.key));
    await this.exports.log(ws, userId, EMPLOYEE_LIST.key, query, rows.length);
    return {
      filename: `staff-employees-${kigaliToday()}.csv`,
      body: toCsv(columns, rows),
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
    const tags = await this.employees.tagsOf([row.id]);
    return {
      employee: presentEmployee(row, current, view, tags.get(row.id)),
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
    await this.assertPeopleFileFields(orgId, { jobPositionId: body.jobPositionId }, null);
    const previousEmployeeId = await this.rehireCheck(orgId, body);
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
          jobPositionId: body.jobPositionId ?? null,
          hiredOn: body.hiredOn,
          // A rehire starts a new service unless people.manage credits the old
          // one later (AC-PF14); either way the new file names the old.
          serviceFrom: body.hiredOn,
          previousEmployeeId,
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
    return presentEmployee(row, null, fileViewFor(ws), []);
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
    const carried = body.tagIds !== undefined ? (await this.employees.tagsOf([row.id])).get(row.id) ?? [] : [];
    await this.assertPeopleFileFields(orgId, body, {
      jobPositionId: row.jobPositionId,
      employeeTypeId: row.employeeTypeId,
      tagIds: carried.map((t) => t.id),
    });

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
    if (body.maritalStatus !== undefined) values.maritalStatus = body.maritalStatus;
    if (body.childrenCount !== undefined) values.childrenCount = body.childrenCount;
    if (body.villageId !== undefined) values.villageId = body.villageId;
    if (body.street !== undefined) values.street = body.street?.trim() || null;
    if (body.emergencyName !== undefined) values.emergencyName = body.emergencyName?.trim() || null;
    if (body.emergencyPhone !== undefined) values.emergencyPhone = body.emergencyPhone;
    if (body.emergencyRelation !== undefined) values.emergencyRelation = body.emergencyRelation?.trim() || null;
    if (body.qualification !== undefined) values.qualification = body.qualification?.trim() || null;
    if (body.priorExperienceYears !== undefined) values.priorExperienceYears = body.priorExperienceYears;
    if (body.employeeTypeId !== undefined) values.employeeTypeId = body.employeeTypeId;
    if (body.jobPositionId !== undefined) values.jobPositionId = body.jobPositionId;
    if (body.serviceFrom !== undefined) values.serviceFrom = body.serviceFrom;

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
        // Service counts from the hire date unless a rehire was credited, so a
        // moved hire date carries an uncredited start with it (AC-PF14).
        const hiredOn = values.hiredOn ?? locked.hiredOn;
        if (values.hiredOn !== undefined && values.serviceFrom === undefined && locked.serviceFrom === locked.hiredOn) {
          values.serviceFrom = values.hiredOn;
        }
        if ((values.serviceFrom ?? locked.serviceFrom) > hiredOn) {
          throw new UnprocessableEntityException('Service cannot start after the hire date.');
        }
        await this.employees.update(tx, locked.id, values);
        if (body.tagIds !== undefined) await this.employees.setTags(tx, orgId, locked.id, body.tagIds);
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'employee',
          subjectId: locked.id,
          eventType: 'hr.employee_updated',
          orgId,
          diff: {
            ...auditDiff(locked as unknown as Record<string, unknown>, values as Record<string, unknown>),
            ...(body.tagIds !== undefined ? { tagIds: { to: [...new Set(body.tagIds)] } } : {}),
          },
        });
        return true;
      });
      if (!done) throw new NotFoundException();
    } catch (error) {
      throw await this.translateUnique(error, orgId, body.idDocumentType, body.idDocumentNumber, typedNumber);
    }
    const updated = await this.employees.find(row.id);
    if (!updated) throw new NotFoundException();
    const [contracts, tags] = await Promise.all([
      this.employees.currentContracts([updated.id]),
      this.employees.tagsOf([updated.id]),
    ]);
    return presentEmployee(updated, contracts.get(updated.id) ?? null, fileViewFor(ws), tags.get(updated.id));
  }

  // --- The photo (058-people-file AC-PF1) ------------------------------------------

  /**
   * `PUT /ops/employees/:id/photo`: hang an uploaded `staff_photo` on the file,
   * or take it off. The object must be this workspace's and a photo: a key is
   * the only thing between a stranger and a file, so it is checked, not trusted.
   */
  async setPhoto(ws: ScopedWorkspace, userId: string, id: string, objectKey: string | null): Promise<Employee> {
    const orgId = orgOf(ws);
    const row = this.own(ws, await this.employees.find(id));
    assertPersonInReach(ws, row.workPropertyId);
    if (objectKey !== null) {
      const object = await this.storage.describe(objectKey);
      if (!object || object.kind !== hrFileKind('photo') || object.workspaceId !== ws.workspaceId) {
        throw new UnprocessableEntityException('That is not a photo uploaded here.');
      }
    }
    await this.db.transaction(async (tx) => {
      await this.employees.update(tx, row.id, { photoKey: objectKey });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: row.id,
        eventType: objectKey ? 'hr.employee_photo_set' : 'hr.employee_photo_removed',
        orgId,
        diff: { photoKey: 'changed' },
      });
    });
    const updated = await this.employees.find(row.id);
    if (!updated) throw new NotFoundException();
    const [contracts, tags] = await Promise.all([
      this.employees.currentContracts([updated.id]),
      this.employees.tagsOf([updated.id]),
    ]);
    return presentEmployee(updated, contracts.get(updated.id) ?? null, fileViewFor(ws), tags.get(updated.id));
  }

  /** `GET /ops/employees/:id/photo`: a five minute link to the photo, a work field (AC-PF2). */
  async photoLink(ws: ScopedWorkspace, id: string): Promise<{ url: string; expiresInSeconds: number }> {
    // `own` answers 404 for a file outside the caller's branches (AC-PF15).
    const row = this.own(ws, await this.employees.find(id));
    if (!row.photoKey) throw new NotFoundException('There is no photo on this file.');
    return { url: await this.storage.signedUrl(row.photoKey, 300), expiresInSeconds: 300 };
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
    if (body.payStructureId && !(await this.employees.ownActiveStructure(orgId, body.payStructureId))) {
      throw new UnprocessableEntityException('That pay structure is not one of this business\'s.');
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
        payStructureId: body.payStructureId ?? null,
        noticeDays: body.noticeDays ?? null,
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
  /**
   * One ACTIVE file per ID per business (AC-P3). A leaver's file with the same
   * ID does not block an edit: the database index is on active files only.
   */
  private async assertIdFree(
    orgId: string,
    selfId: string | null,
    type: 'national_id' | 'passport',
    number: string,
  ): Promise<void> {
    const existing = await this.employees.findByIdDocument(orgId, type, number.trim());
    if (existing && existing.status === 'active' && existing.id !== selfId) {
      throw new ConflictException(
        `That ID is already on file as employee ${existing.employeeNumber}.`,
      );
    }
  }

  /**
   * Creating a file whose ID a leaver's file carries is a rehire (AC-PF14): the
   * first create answers 409 `rehire_available` naming the old file, and the
   * same request sent again with `rehireOf` set to it creates the new file,
   * which names the old one. An active file with the ID is a plain 409.
   */
  private async rehireCheck(orgId: string, body: CreateEmployeeRequest): Promise<string | null> {
    const existing = await this.employees.findByIdDocument(orgId, body.idDocumentType, body.idDocumentNumber.trim());
    if (existing?.status === 'active') {
      throw new ConflictException(`That ID is already on file as employee ${existing.employeeNumber}.`);
    }
    if (existing && body.rehireOf === existing.id) return existing.id;
    if (existing) {
      throw new ConflictException({
        code: 'rehire_available',
        message: `Employee ${existing.employeeNumber} with this ID has left. Rehire them as a new file?`,
        employeeId: existing.id,
        employeeNumber: existing.employeeNumber,
      });
    }
    if (body.rehireOf) {
      throw new UnprocessableEntityException('No one who has left carries that ID here, so there is no one to rehire.');
    }
    return null;
  }

  /**
   * The people file's references must be this business's and live: an employee
   * type or a tag that is archived is not offered for new files (AC-PF11), but
   * stays on a file that already carries it, so resending it is no change; and
   * a village must exist (AC-PF1).
   */
  private async assertPeopleFileFields(
    orgId: string,
    body: Pick<UpdateEmployeeRequest, 'employeeTypeId' | 'tagIds' | 'villageId' | 'serviceFrom' | 'jobPositionId'>,
    current: { jobPositionId: string | null; employeeTypeId: string | null; tagIds: readonly string[] } | null,
  ): Promise<void> {
    if (body.jobPositionId && body.jobPositionId !== current?.jobPositionId) {
      const live = await this.employees.activeCatalogIds('job-positions', orgId, [body.jobPositionId]);
      if (!live.has(body.jobPositionId)) throw new UnprocessableEntityException('That job position is not available here.');
    }
    if (body.employeeTypeId && body.employeeTypeId !== current?.employeeTypeId) {
      const live = await this.employees.activeCatalogIds('employee-types', orgId, [body.employeeTypeId]);
      if (!live.has(body.employeeTypeId)) throw new UnprocessableEntityException('That employee type is not available here.');
    }
    const freshTags = (body.tagIds ?? []).filter((t) => !current?.tagIds.includes(t));
    if (freshTags.length > 0) {
      const live = await this.employees.activeCatalogIds('tags', orgId, freshTags);
      if (freshTags.some((t) => !live.has(t))) throw new UnprocessableEntityException('A tag is not available here.');
    }
    if (body.villageId && !(await this.employees.villageExists(body.villageId))) {
      throw new UnprocessableEntityException('That village is not in the address book.');
    }
    if (body.serviceFrom !== undefined && !isCalendarDate(body.serviceFrom)) {
      throw new UnprocessableEntityException('That is not a real date.');
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
      // The index is on active files only, so a race lost here is to an active one.
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

/**
 * The employee export's columns (AC-LF7). The personal ones exist only for a
 * `full` view, the same split as the presenter's two file shapes (AC-P2), so a
 * `people.view` holder's export carries no date of birth, ID or RSSB number.
 */
type EmployeeCsvColumn = CsvColumn<EmployeeRow> & { key: string };
function employeeCsvColumns(view: 'basic' | 'full', tags: Map<string, EmployeeTagRow[]>): EmployeeCsvColumn[] {
  const common: EmployeeCsvColumn[] = [
    { key: 'employeeNumber', header: 'Number', value: (r) => r.employeeNumber },
    { key: 'name', header: 'Name', value: (r) => displayNameOf(r) },
    { key: 'legalName', header: 'Legal name', value: (r) => r.legalName },
    { key: 'status', header: 'Status', value: (r) => (r.status === 'active' ? 'Working' : 'Left') },
    { key: 'branch', header: 'Branch', value: (r) => r.workPropertyName },
    { key: 'jobPosition', header: 'Job position', value: (r) => r.jobPositionTitle },
    { key: 'hiredOn', header: 'Hired on', value: (r) => r.hiredOn },
    { key: 'offboardedOn', header: 'Last day', value: (r) => r.offboardedOn },
    { key: 'phone', header: 'Phone', value: (r) => r.phone },
    { key: 'email', header: 'Email', value: (r) => r.email },
    {
      key: 'hasAccount',
      header: 'Has an account',
      value: (r) => r.orgMembershipId !== null && r.membershipStatus === 'active',
    },
    { key: 'detailsMissing', header: 'Details missing', value: (r) => detailsMissing(r).join(' ') },
    // 058-people-file AC-PF2: these are work fields, in both views.
    { key: 'employeeType', header: 'Employee type', value: (r) => r.employeeTypeTitle },
    { key: 'tags', header: 'Tags', value: (r) => (tags.get(r.id) ?? []).map((t) => t.title).join(', ') },
    { key: 'qualification', header: 'Qualification', value: (r) => r.qualification },
    { key: 'priorExperienceYears', header: 'Years of experience before joining', value: (r) => r.priorExperienceYears },
  ];
  if (view === 'basic') return common;
  return [
    ...common,
    { key: 'dateOfBirth', header: 'Date of birth', value: (r) => r.dateOfBirth },
    { key: 'sex', header: 'Sex', value: (r) => r.sex },
    { key: 'idDocumentType', header: 'ID type', value: (r) => r.idDocumentType },
    { key: 'idDocumentNumber', header: 'ID number', value: (r) => r.idDocumentNumber },
    { key: 'rssbNumber', header: 'RSSB number', value: (r) => r.rssbNumber },
    // The personal fields of 058-people-file AC-PF2, full view only.
    { key: 'maritalStatus', header: 'Marital status', value: (r) => r.maritalStatus },
    { key: 'childrenCount', header: 'Children', value: (r) => r.childrenCount },
    { key: 'address', header: 'Address', value: (r) => addressLine(r) },
    { key: 'emergencyName', header: 'Emergency contact', value: (r) => r.emergencyName },
    { key: 'emergencyPhone', header: 'Emergency phone', value: (r) => r.emergencyPhone },
    { key: 'emergencyRelation', header: 'Emergency relation', value: (r) => r.emergencyRelation },
    { key: 'serviceFrom', header: 'Service counts from', value: (r) => r.serviceFrom },
    { key: 'offboardReason', header: 'Leaving reason', value: (r) => r.offboardReason },
  ];
}

/** Street, village, cell, sector and district, as one line. */
function addressLine(r: EmployeeRow): string {
  return [r.street, r.villageName, r.cellName, r.sectorName, r.districtName].filter(Boolean).join(', ');
}

const MISSING_WORDS: Record<string, string> = {
  dateOfBirth: 'the date of birth',
  sex: 'sex',
  idDocument: 'the ID document',
};
