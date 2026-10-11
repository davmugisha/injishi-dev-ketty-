import type {
  CreateRotationAssignmentRequest,
  CreateRotationPatternRequest,
  EndRotationAssignmentRequest,
  RotationAssignment,
  RotationAssignmentList,
  RotationPattern,
  RotationPatternList,
  UpdateRotationPatternRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { isCalendarDate } from '../../booking/domain/pricing';
import { addDays, eachDate, kigaliToday, shiftInstants } from '../domain/hr-calendar';
import { rotationStepOn } from '../domain/time-rules';
import { EmployeesRepository, violatedConstraint } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { LeaveRepository } from '../infrastructure/leave.repository';
import { RotationRepository, type AssignmentRow, type PatternRow } from '../infrastructure/rotation.repository';
import { TimeRepository, type ShiftTemplateRow } from '../infrastructure/time.repository';
import { rosterCard } from './employee-presenter';
import { assertBranchInReach, assertPersonInReach, orgOf } from './hr-access';

/** How far ahead the daily job keeps drafts written (058-time AC-TM3). */
export const ROTATION_HORIZON_DAYS = 28;

/**
 * Rotations (ADR-058, 058-time AC-TM3): a pattern of shifts and days off at a
 * branch, the people on it, and the generator that keeps their drafts written
 * 28 days ahead.
 *
 * A rotation WRITES roster rows (index contract 2) rather than being read at
 * clock in time, so there is one answer to "who works when" and a manager fixes
 * an exception in the grid. The generator never writes on an `off` step, a day
 * of approved leave, a day the person already has an overlapping shift, or a
 * day the assignment already wrote, even one a manager cancelled: a cancelled
 * shift is never recreated.
 */
@Injectable()
export class RotationService {
  private readonly logger = new Logger(RotationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly rotations: RotationRepository,
    private readonly employees: EmployeesRepository,
    private readonly time: TimeRepository,
    private readonly leave: LeaveRepository,
  ) {}

  // --- Patterns ------------------------------------------------------------------

  async patterns(ws: ScopedWorkspace, propertyId?: string): Promise<RotationPatternList> {
    const rows = await this.rotations.patterns(orgOf(ws), ws.branchScope, propertyId);
    return { patterns: await this.presentPatterns(rows) };
  }

  async createPattern(ws: ScopedWorkspace, userId: string, body: CreateRotationPatternRequest): Promise<RotationPattern> {
    const orgId = orgOf(ws);
    const property = assertOwnedByOrg(await this.employees.findProperty(body.propertyId), ws);
    assertBranchInReach(ws, property.id);
    const templateIds = [...new Set(body.steps.filter((s) => s !== 'off'))];
    if (templateIds.length === 0) throw new UnprocessableEntityException('A rotation needs at least one shift among its steps.');
    const templates = await this.time.findTemplates(templateIds);
    for (const id of templateIds) {
      const t = templates.find((x) => x.id === id);
      if (!t || t.orgId !== orgId || t.propertyId !== property.id || t.status !== 'active') {
        throw new UnprocessableEntityException('Every shift in a rotation must be an active shift of its branch.');
      }
    }
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        const created = await this.rotations.insertPattern(tx, {
          orgId,
          propertyId: property.id,
          name: body.name.trim(),
          steps: body.steps,
          rule: body.rule,
          ruleValue: body.ruleValue,
          createdByUserId: userId,
        });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'org',
          subjectId: orgId,
          eventType: 'hr.rotation_pattern_created',
          orgId,
          diff: { patternId: created, propertyId: property.id, steps: body.steps.length },
        });
        return created;
      });
    } catch (error) {
      if (violatedConstraint(error) === 'rotation_patterns_name_uk') {
        throw new ConflictException(`This branch already has a rotation called "${body.name.trim()}".`);
      }
      throw error;
    }
    return this.pattern(ws, id);
  }

  /**
   * Rename or archive. The steps and rule never change once written: people's
   * drafts follow them, so a different rotation is a new pattern. A pattern
   * somebody is on is not archived until their assignments end.
   */
  async updatePattern(ws: ScopedWorkspace, userId: string, id: string, body: UpdateRotationPatternRequest): Promise<RotationPattern> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.rotations.findPattern(id), ws);
    assertBranchInReach(ws, row.propertyId);
    if (body.status === 'archived' && row.openAssignments > 0) {
      throw new ConflictException(`${row.openAssignments} people are on this rotation. End their assignments first.`);
    }
    try {
      await this.db.transaction(async (tx) => {
        await this.rotations.updatePattern(tx, row.id, { name: body.name?.trim(), status: body.status });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'org',
          subjectId: orgId,
          eventType: body.status === 'archived' ? 'hr.rotation_pattern_archived' : 'hr.rotation_pattern_changed',
          orgId,
          diff: { patternId: row.id, fields: Object.keys(body) },
        });
      });
    } catch (error) {
      if (violatedConstraint(error) === 'rotation_patterns_name_uk') {
        throw new ConflictException(`This branch already has a rotation called "${body.name?.trim()}".`);
      }
      throw error;
    }
    return this.pattern(ws, row.id);
  }

  // --- Assignments ---------------------------------------------------------------

  async assignments(ws: ScopedWorkspace, query: { patternId?: string; includeEnded?: boolean }): Promise<RotationAssignmentList> {
    const rows = await this.rotations.assignments({
      orgId: orgOf(ws),
      scope: ws.branchScope,
      patternId: query.patternId,
      includeEnded: query.includeEnded ?? false,
    });
    return { assignments: rows.map(presentAssignment) };
  }

  /**
   * Put a person on a rotation from a date at a step, and write their drafts
   * at once, so the week grid fills now rather than after tonight's job. A
   * person is on one rotation at a time.
   */
  async assign(ws: ScopedWorkspace, userId: string, body: CreateRotationAssignmentRequest): Promise<RotationAssignment> {
    const orgId = orgOf(ws);
    if (!isCalendarDate(body.startsOn)) throw new UnprocessableEntityException('That is not a real date.');
    const employee = assertOwnedByOrg(await this.employees.find(body.employeeId), ws);
    assertPersonInReach(ws, employee.workPropertyId);
    if (employee.status !== 'active') throw new ConflictException(`${employee.legalName} has left.`);
    const pattern = assertOwnedByOrg(await this.rotations.findPattern(body.patternId), ws);
    if (pattern.status !== 'active') throw new UnprocessableEntityException('That rotation is archived.');
    if (pattern.propertyId !== employee.workPropertyId) {
      throw new UnprocessableEntityException('A person rotates at the branch they work at; that rotation is at another.');
    }
    const startStep = body.startStep ?? 0;
    if (startStep >= pattern.steps.length) {
      throw new UnprocessableEntityException(`That rotation has ${pattern.steps.length} steps; choose one from 1 to ${pattern.steps.length}.`);
    }
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        const created = await this.rotations.insertAssignment(tx, {
          orgId,
          employeeId: employee.id,
          patternId: pattern.id,
          startsOn: body.startsOn,
          startStep,
          createdByUserId: userId,
        });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'employee',
          subjectId: employee.id,
          eventType: 'hr.rotation_assigned',
          orgId,
          diff: { assignmentId: created, patternId: pattern.id, startsOn: body.startsOn, startStep },
        });
        return created;
      });
    } catch (error) {
      if (violatedConstraint(error) === 'rotation_assignments_open_uk') {
        throw new ConflictException(`${employee.legalName} is already on a rotation. End it first.`);
      }
      throw error;
    }
    const row = await this.rotations.findAssignment(id);
    if (!row) throw new NotFoundException();
    await this.generateFor(row, kigaliToday(), ws.workspaceId);
    return presentAssignment(row);
  }

  /** End an assignment on a day: its drafts after it are cancelled; a published shift stays for a person to move. */
  async end(ws: ScopedWorkspace, userId: string, id: string, body: EndRotationAssignmentRequest): Promise<RotationAssignment> {
    const orgId = orgOf(ws);
    if (!isCalendarDate(body.endsOn)) throw new UnprocessableEntityException('That is not a real date.');
    const row = assertOwnedByOrg(await this.rotations.findAssignment(id), ws);
    assertPersonInReach(ws, row.workPropertyId);
    if (body.endsOn < row.startsOn) throw new UnprocessableEntityException('It cannot end before it started.');
    await this.db.transaction(async (tx) => {
      if (!(await this.rotations.endAssignment(tx, row.id, body.endsOn))) {
        throw new ConflictException('That rotation has already ended.');
      }
      const cancelled = await this.rotations.cancelGeneratedDraftsAfter(tx, row.id, body.endsOn, 'The rotation ended.');
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: row.employeeId,
        eventType: 'hr.rotation_ended',
        orgId,
        diff: { assignmentId: row.id, endsOn: body.endsOn, draftsCancelled: cancelled },
      });
    });
    const updated = await this.rotations.findAssignment(row.id);
    if (!updated) throw new NotFoundException();
    return presentAssignment(updated);
  }

  // --- The generator (the daily job) ----------------------------------------------------

  /** Keep every running assignment's drafts written 28 days ahead. Idempotent: a rerun writes nothing. */
  async generateAll(today: string = kigaliToday()): Promise<number> {
    const horizon = addDays(today, ROTATION_HORIZON_DAYS - 1);
    let written = 0;
    for (const assignment of await this.rotations.running(today, horizon)) {
      try {
        written += await this.generateFor(assignment, today, null);
      } catch (error) {
        // One person's rotation must not stop everyone else's.
        this.logger.warn(`Rotation ${assignment.id}: ${(error as Error).message}`);
      }
    }
    return written;
  }

  /**
   * Write one assignment's missing drafts from today to the horizon. Each entry
   * goes in its own savepoint, so a shift a manager placed a moment ago (the
   * overlap constraint) costs that one day, not the run.
   */
  private async generateFor(assignment: AssignmentRow, today: string, workspaceId: string | null): Promise<number> {
    if (assignment.employeeStatus !== 'active') return 0;
    const from = assignment.startsOn > today ? assignment.startsOn : today;
    let to = addDays(today, ROTATION_HORIZON_DAYS - 1);
    if (assignment.endsOn && assignment.endsOn < to) to = assignment.endsOn;
    if (to < from) return 0;

    const templateIds = [...new Set(assignment.steps.filter((s) => s !== 'off'))];
    const [templates, written, leave, scheduled] = await Promise.all([
      this.time.findTemplates(templateIds),
      this.rotations.generatedDates(assignment.id, from, to),
      this.leave.approvedBetween(assignment.employeeId, from, to),
      this.time.scheduledOn([assignment.employeeId], addDays(from, -1), addDays(to, 1)),
    ]);
    const byId = new Map<string, ShiftTemplateRow>(templates.map((t) => [t.id, t]));
    const onLeave = (date: string): boolean => leave.some((l) => l.startsOn <= date && l.endsOn >= date);
    // The person's shifts as time spans, growing as this run writes, so two generated days never overlap either.
    const taken = scheduled.map((e) => ({ from: e.startsAt.getTime(), to: e.endsAt.getTime() }));

    let count = 0;
    for (const date of eachDate(from, to)) {
      if (written.has(date) || onLeave(date)) continue;
      const step = assignment.steps[rotationStepOn(date, assignment, { rule: assignment.rule, ruleValue: assignment.ruleValue, stepCount: assignment.steps.length })];
      if (step === 'off') continue;
      const template = byId.get(step);
      if (!template || template.status !== 'active') continue;
      const instants = shiftInstants(date, template.startsAt, template.endsAt);
      const span = { from: instants.startsAt.getTime(), to: instants.endsAt.getTime() };
      const overlaps = taken.some((s) => s.from < span.to && s.to > span.from);
      if (overlaps) continue;
      try {
        await this.db.transaction(async (tx) => {
          const published = await this.time.isPublishedDate(
            { orgId: assignment.orgId, propertyId: template.propertyId, departmentId: template.departmentId, date },
            tx,
          );
          const created = await this.time.insertEntry(tx, {
            orgId: assignment.orgId,
            employeeId: assignment.employeeId,
            shiftTemplateId: template.id,
            propertyId: template.propertyId,
            departmentId: template.departmentId,
            workDate: date,
            startsAt: instants.startsAt,
            endsAt: instants.endsAt,
            createdByUserId: null,
            publishedAt: published ? new Date() : null,
            rotationAssignmentId: assignment.id,
          });
          if (published) {
            await writeHrEvent(tx, {
              trigger: 'roster.changed',
              aggregateType: 'employee',
              aggregateId: assignment.employeeId,
              change: `entry:${created}`,
              workspaceId,
              payload: { employeeId: assignment.employeeId, rosterEntryId: created },
            });
          }
        });
        taken.push(span);
        count += 1;
      } catch (error) {
        if (violatedConstraint(error, '23P01') === 'roster_entries_no_overlap') continue;
        throw error;
      }
    }
    return count;
  }

  // --- Presenting ---------------------------------------------------------------------

  private async pattern(ws: ScopedWorkspace, id: string): Promise<RotationPattern> {
    const row = assertOwnedByOrg(await this.rotations.findPattern(id), ws);
    assertInBranchScope(ws, row.propertyId);
    const [pattern] = await this.presentPatterns([row]);
    return pattern;
  }

  private async presentPatterns(rows: PatternRow[]): Promise<RotationPattern[]> {
    const ids = [...new Set(rows.flatMap((r) => r.steps.filter((s) => s !== 'off')))];
    const names = new Map((await this.time.findTemplates(ids)).map((t) => [t.id, t.name]));
    return rows.map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      name: r.name,
      steps: r.steps as RotationPattern['steps'],
      stepNames: r.steps.map((s) => (s === 'off' ? 'Off' : (names.get(s) ?? 'A retired shift'))),
      rule: r.rule,
      ruleValue: r.ruleValue,
      status: r.status,
      openAssignments: r.openAssignments,
    }));
  }
}

function presentAssignment(row: AssignmentRow): RotationAssignment {
  return {
    id: row.id,
    employee: rosterCard({
      id: row.employeeId,
      preferredName: row.preferredName,
      legalName: row.legalName,
      jobPositionTitle: row.jobPositionTitle,
    }),
    patternId: row.patternId,
    patternName: row.patternName,
    propertyId: row.propertyId,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    startStep: row.startStep,
  };
}
