import type {
  ChecklistBoard,
  ChecklistTemplate,
  ChecklistTemplateList,
  CreateChecklistTemplateRequest,
  EmployeeChecklist,
  MyChecklists,
  StartChecklistRequest,
  UpdateChecklistTemplateRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { addDays, anchorFor, overdueCount, tasksFor, type ChecklistKind } from '../domain/checklists';
import { kigaliToday } from '../domain/hr-calendar';
import {
  ChecklistsRepository,
  type ChecklistRow,
  type TaskRow,
  type TemplateItemRow,
  type TemplateItemValues,
  type TemplateRow,
} from '../infrastructure/checklists.repository';
import { EmployeesRepository, violatedConstraint, type EmployeeRow, type Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { MyWorkRepository } from '../infrastructure/my-work.repository';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';

/** How far back somebody who joined or left with no checklist is still offered one. */
const UNSTARTED_WITHIN_DAYS = 30;

/**
 * Checklists (ADR-058): the business's lists for somebody joining and somebody
 * leaving, and each person's copy of one.
 *
 * `people.manage` writes the templates, starts a checklist and ticks any task;
 * `people.view` reads the board. A person reads their own through `/me/work`
 * and ticks only the tasks that are theirs to do. A checklist follows the
 * caller's branches as a file does (AC-PF15).
 *
 * A template belongs to the business, so its audit row is filed against the
 * org; a checklist and its tasks belong to a person, so theirs is filed
 * against the file.
 */
@Injectable()
export class ChecklistsService {
  private readonly logger = new Logger(ChecklistsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly checklists: ChecklistsRepository,
    private readonly employees: EmployeesRepository,
    private readonly work: MyWorkRepository,
  ) {}

  // --- Templates ----------------------------------------------------------------------

  async templates(ws: ScopedWorkspace): Promise<ChecklistTemplateList> {
    const rows = await this.checklists.templates(orgOf(ws));
    const items = await this.checklists.itemsOf(rows.map((r) => r.id));
    return { templates: rows.map((row) => presentTemplate(row, items)) };
  }

  async createTemplate(ws: ScopedWorkspace, userId: string, body: CreateChecklistTemplateRequest): Promise<ChecklistTemplate> {
    const orgId = orgOf(ws);
    const items = await this.itemValues(orgId, body.items);
    const name = body.name.trim();
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        // The first template of a kind is the default: a business with one
        // joining list means that one.
        const first = (await this.checklists.templates(orgId, tx)).every((t) => t.kind !== body.kind);
        const isDefault = body.isDefault ?? first;
        if (isDefault) await this.checklists.clearDefault(tx, orgId, body.kind, null);
        const created = await this.checklists.insertTemplate(tx, { orgId, kind: body.kind, name, isDefault }, items);
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'org',
          subjectId: orgId,
          eventType: 'hr.checklist_template_created',
          orgId,
          diff: { templateId: { to: created }, kind: { to: body.kind }, name: { to: name }, tasks: { to: items.length } },
        });
        return created;
      });
    } catch (error) {
      throw nameTaken(error, name);
    }
    return this.template(orgId, id);
  }

  async updateTemplate(ws: ScopedWorkspace, userId: string, id: string, body: UpdateChecklistTemplateRequest): Promise<ChecklistTemplate> {
    const orgId = orgOf(ws);
    const before = await this.ownTemplate(orgId, id);
    const items = await this.itemValues(orgId, body.items);
    const name = body.name.trim();
    const isDefault = body.isDefault ?? before.isDefault;
    try {
      await this.db.transaction(async (tx) => {
        if (isDefault) await this.checklists.clearDefault(tx, orgId, before.kind, id);
        await this.checklists.replaceTemplate(tx, id, { name, isDefault }, items);
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'org',
          subjectId: orgId,
          eventType: 'hr.checklist_template_changed',
          orgId,
          diff: {
            templateId: { to: id },
            ...(name !== before.name ? { name: { from: before.name, to: name } } : {}),
            ...(isDefault !== before.isDefault ? { isDefault: { from: before.isDefault, to: isDefault } } : {}),
            tasks: { to: items.length },
          },
        });
      });
    } catch (error) {
      throw nameTaken(error, name);
    }
    return this.template(orgId, id);
  }

  /** A template is configuration: it goes, and the checklists it started stand as they are. */
  async deleteTemplate(ws: ScopedWorkspace, userId: string, id: string): Promise<void> {
    const orgId = orgOf(ws);
    const before = await this.ownTemplate(orgId, id);
    await this.db.transaction(async (tx) => {
      await this.checklists.deleteTemplate(tx, id);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.checklist_template_deleted',
        orgId,
        diff: { templateId: { from: id }, kind: { from: before.kind }, name: { from: before.name } },
      });
    });
  }

  // --- The board --------------------------------------------------------------------

  /** Every checklist in the caller's branches, the unfinished first, and who has none started. */
  async board(ws: ScopedWorkspace): Promise<ChecklistBoard> {
    const orgId = orgOf(ws);
    const today = kigaliToday();
    const rows = await this.checklists.checklists(orgId, ws.branchScope);
    const tasks = await this.checklists.tasksOf(rows.map((r) => r.id));
    const presented = rows.map((row) => presentChecklist(row, tasks, today));
    const open = (c: EmployeeChecklist): boolean => c.doneCount < c.tasks.length;
    const unstarted = await this.checklists.unstarted(orgId, ws.branchScope, addDays(today, -UNSTARTED_WITHIN_DAYS));
    return {
      today,
      // Unfinished before finished; within each, the order they were started, newest first.
      checklists: [...presented.filter(open), ...presented.filter((c) => !open(c))],
      unstarted: unstarted.map((r) => ({ employee: rosterCard(r), kind: r.kind, on: r.on })),
    };
  }

  /** Start a checklist for a person from a template named, or the default of that kind. */
  async start(ws: ScopedWorkspace, userId: string, body: StartChecklistRequest): Promise<EmployeeChecklist> {
    const orgId = orgOf(ws);
    const employee = await this.employees.find(body.employeeId);
    if (!employee || employee.orgId !== orgId) throw new NotFoundException();
    assertPersonInReach(ws, employee.workPropertyId);

    const template = body.templateId
      ? await this.ownTemplate(orgId, body.templateId)
      : await this.checklists.defaultTemplate(orgId, body.kind);
    if (!template) {
      throw new UnprocessableEntityException(
        `There is no ${body.kind === 'onboarding' ? 'joining' : 'leaving'} checklist to start from yet. Write one under Checklists first.`,
      );
    }
    if (template.kind !== body.kind) {
      throw new UnprocessableEntityException('That checklist is of the other kind.');
    }
    const id = await this.db.transaction((tx) => this.stamp(tx, employee, template, userId));
    if (!id) {
      throw new ConflictException(
        `${employee.preferredName ?? employee.legalName} already has a ${body.kind === 'onboarding' ? 'joining' : 'leaving'} checklist.`,
      );
    }
    return this.checklist(id);
  }

  /**
   * Start the business's default checklist for a file that was just created
   * or offboarded. Called beside those commands, after they have committed,
   * and never the reason one fails: with no default written, or a checklist
   * already there, it does nothing, and an error is logged and swallowed.
   */
  async startDefault(ws: ScopedWorkspace, userId: string, employeeId: string, kind: ChecklistKind): Promise<void> {
    try {
      const orgId = orgOf(ws);
      const template = await this.checklists.defaultTemplate(orgId, kind);
      if (!template) return;
      const employee = await this.employees.find(employeeId);
      if (!employee || employee.orgId !== orgId) return;
      await this.db.transaction((tx) => this.stamp(tx, employee, template, userId));
    } catch (error) {
      this.logger.warn(`The default ${kind} checklist was not started for ${employeeId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * `people.manage` ticks or unticks any task of a file in its branches. A task
   * marked owner only (taking an account away, which is staffing the business)
   * also needs `team.manage`, the owner's alone (AC-O2).
   */
  async setDone(ws: ScopedWorkspace, userId: string, taskId: string, done: boolean): Promise<EmployeeChecklist> {
    const orgId = orgOf(ws);
    const task = await this.checklists.findTask(taskId);
    if (!task || task.orgId !== orgId) throw new NotFoundException();
    const checklist = await this.checklists.findChecklist(task.checklistId);
    if (!checklist) throw new NotFoundException();
    assertInBranchScope(ws, checklist.workPropertyId);
    if (task.ownerOnly && !ws.permissions.includes('team.manage')) {
      throw new ForbiddenException('Only someone who manages the team can tick this step.');
    }
    await this.mark(task, checklist, userId, done);
    return this.checklist(checklist.id);
  }

  // --- A person's own (058-self-service) ------------------------------------------------

  async mine(userId: string, employeeId: string): Promise<MyChecklists> {
    await this.owned(userId, employeeId);
    const today = kigaliToday();
    const rows = await this.checklists.checklistsOf(employeeId);
    const tasks = await this.checklists.tasksOf(rows.map((r) => r.id));
    return { today, checklists: rows.map((row) => presentChecklist(row, tasks, today)) };
  }

  /** A person ticks what is theirs to do, and nothing else: the rest is the office's word. */
  async setMineDone(userId: string, employeeId: string, taskId: string, done: boolean): Promise<MyChecklists> {
    const employee = await this.owned(userId, employeeId);
    const task = await this.checklists.findTask(taskId);
    if (!task) throw new NotFoundException();
    const checklist = await this.checklists.findChecklist(task.checklistId);
    // Somebody else's task answers as one that does not exist (index contract 10).
    if (!checklist || checklist.employeeId !== employee.id) throw new NotFoundException();
    if (!task.byEmployee) {
      throw new ForbiddenException('The office ticks this one once it is done.');
    }
    // A file the person has left is read only, as on every `me/work` route (AC-SS1).
    if (employee.status !== 'active') {
      throw new ConflictException('You no longer work here, so this checklist is read only.');
    }
    await this.mark(task, checklist, userId, done);
    return this.mine(userId, employeeId);
  }

  // --- Helpers ----------------------------------------------------------------------

  /** Copy a template onto a person. Null when they already have a checklist of that kind. */
  private async stamp(tx: Tx, employee: EmployeeRow, template: TemplateRow, userId: string | null): Promise<string | null> {
    const today = kigaliToday();
    const anchorOn = anchorFor(template.kind, employee, today);
    const items = await this.checklists.itemsOf([template.id], tx);
    const id = await this.checklists.insertChecklist(
      tx,
      { orgId: employee.orgId, employeeId: employee.id, kind: template.kind, templateName: template.name, anchorOn, startedByUserId: userId },
      tasksFor(items, employee.jobPositionId, anchorOn),
    );
    if (!id) return null;
    await writeHrAudit(tx, {
      actorUserId: userId,
      subjectType: 'employee',
      subjectId: employee.id,
      eventType: 'hr.checklist_started',
      orgId: employee.orgId,
      diff: { checklistId: { to: id }, kind: { to: template.kind }, template: { to: template.name } },
    });
    return id;
  }

  private async mark(
    task: { id: string; doneAt: Date | null },
    checklist: ChecklistRow,
    userId: string,
    done: boolean,
  ): Promise<void> {
    // Ticking what is ticked, or unticking what is not, changes nothing and writes nothing.
    if ((task.doneAt !== null) === done) return;
    await this.db.transaction(async (tx) => {
      await this.checklists.setTaskDone(tx, task.id, done ? { at: new Date(), byUserId: userId } : null);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: checklist.employeeId,
        eventType: done ? 'hr.checklist_task_done' : 'hr.checklist_task_undone',
        orgId: checklist.orgId,
        diff: { checklistId: { to: checklist.id }, taskId: { to: task.id } },
      });
    });
  }

  private async owned(userId: string, employeeId: string): Promise<EmployeeRow> {
    if (!(await this.work.owned(userId, employeeId))) throw new NotFoundException();
    const employee = await this.employees.find(employeeId);
    if (!employee) throw new NotFoundException();
    return employee;
  }

  private async ownTemplate(orgId: string, id: string): Promise<TemplateRow> {
    const template = await this.checklists.findTemplate(id);
    if (!template || template.orgId !== orgId) throw new NotFoundException();
    return template;
  }

  /** The tasks as rows, each in the order it was sent, naming only this business's positions. */
  private async itemValues(
    orgId: string,
    items: CreateChecklistTemplateRequest['items'],
  ): Promise<TemplateItemValues[]> {
    const positions = [...new Set(items.map((i) => i.jobPositionId).filter((id): id is string => !!id))];
    const own = await this.checklists.ownPositions(orgId, positions);
    if (positions.some((id) => !own.has(id))) {
      throw new UnprocessableEntityException('A task names a job position this business does not have.');
    }
    return items.map((item, index) => ({
      label: item.label.trim(),
      code: item.code ?? null,
      detail: item.detail?.trim() || null,
      sortOrder: index,
      byEmployee: item.byEmployee ?? false,
      ownerOnly: item.ownerOnly ?? false,
      dueAfterDays: item.dueAfterDays ?? 0,
      jobPositionId: item.jobPositionId ?? null,
    }));
  }

  private async template(orgId: string, id: string): Promise<ChecklistTemplate> {
    const row = await this.ownTemplate(orgId, id);
    return presentTemplate(row, await this.checklists.itemsOf([id]));
  }

  private async checklist(id: string): Promise<EmployeeChecklist> {
    const row = await this.checklists.findChecklist(id);
    if (!row) throw new NotFoundException();
    return presentChecklist(row, await this.checklists.tasksOf([id]), kigaliToday());
  }
}

function presentTemplate(row: TemplateRow, items: readonly TemplateItemRow[]): ChecklistTemplate {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    isDefault: row.isDefault,
    items: items
      .filter((item) => item.templateId === row.id)
      .map((item) => ({
        id: item.id,
        label: item.label,
        code: item.code,
        detail: item.detail,
        byEmployee: item.byEmployee,
        ownerOnly: item.ownerOnly,
        dueAfterDays: item.dueAfterDays,
        jobPosition: item.jobPositionId && item.jobPositionTitle ? { id: item.jobPositionId, title: item.jobPositionTitle } : null,
      })),
  };
}

function presentChecklist(row: ChecklistRow, tasks: readonly TaskRow[], today: string): EmployeeChecklist {
  const own = tasks.filter((task) => task.checklistId === row.id);
  return {
    id: row.id,
    employee: rosterCard({ id: row.employeeId, preferredName: row.preferredName, legalName: row.legalName, jobPositionTitle: row.jobPositionTitle }),
    branchId: row.workPropertyId,
    kind: row.kind,
    templateName: row.templateName,
    anchorOn: row.anchorOn,
    startedAt: row.startedAt.toISOString(),
    tasks: own.map((task) => ({
      id: task.id,
      label: task.label,
      code: task.code,
      detail: task.detail,
      byEmployee: task.byEmployee,
      ownerOnly: task.ownerOnly,
      dueOn: task.dueOn,
      doneAt: task.doneAt ? task.doneAt.toISOString() : null,
      doneByName: task.doneByName,
    })),
    doneCount: own.filter((task) => task.doneAt !== null).length,
    overdueCount: overdueCount(own, today),
  };
}

/** A second template of one name and kind, said in words rather than as a constraint. */
function nameTaken(error: unknown, name: string): unknown {
  return violatedConstraint(error) === 'checklist_templates_name_uk'
    ? new ConflictException(`There is already a checklist of that kind called ${name}.`)
    : error;
}
