import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  checklistItems,
  checklistTemplateItems,
  checklistTemplates,
} from '../../../database/drizzle/hr-lifecycle';
import { departmentMembers, departments } from '../../../database/drizzle/operations';

type Kind = 'onboarding' | 'offboarding';

export interface ChecklistItemRow {
  id: string;
  kind: Kind;
  label: string;
  sortOrder: number;
  assigneeRole: string | null;
  beginOnDays: number;
  dueDate: string | null;
  done: boolean;
  completedAt: Date | null;
}

/** A task as it is handed to people: what it is, and which department it is for. */
export interface TaskToGive {
  workspaceId: string;
  kind: Kind;
  label: string;
  sortOrder: number;
  assigneeRole?: string | null;
  beginOnDays: number;
  /** Null is everybody. */
  departmentId: string | null;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Onboarding/offboarding checklists (HR module, Phase 3).
 *
 * A template is a list of tasks, set up once per workspace. EACH TASK IS FOR
 * ONE DEPARTMENT OR FOR EVERYBODY (`department_id`, null meaning everybody), so
 * a housekeeper is not handed the engineer's tasks. A person's own checklist
 * is a copy of the tasks that are for them, with a due date computed from the
 * day of the copy plus each task's offset.
 *
 * THE COPIES ARE KEPT IN STEP WITH THE LIST IN USE: a task added to it, moved
 * to another department or removed from it is given to, or withdrawn from, the
 * people it now concerns. A copy is matched to its task by kind and label, and
 * a copy somebody has already ticked is never withdrawn — it is a record of
 * work done.
 */
@Injectable()
export class ChecklistRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Templates -----------------------------------------------------------

  async listTemplates(workspaceId: string) {
    return this.db
      .select()
      .from(checklistTemplates)
      .where(eq(checklistTemplates.workspaceId, workspaceId));
  }

  async createTemplate(
    workspaceId: string,
    kind: Kind,
    name: string,
    isDefault: boolean,
  ): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(checklistTemplates)
      .values({ workspaceId, kind, name, isDefault })
      .returning({ id: checklistTemplates.id });
    return row;
  }

  async findTemplate(templateId: string) {
    const [row] = await this.db
      .select()
      .from(checklistTemplates)
      .where(eq(checklistTemplates.id, templateId))
      .limit(1);
    return row ?? null;
  }

  async findDefaultTemplate(workspaceId: string, kind: Kind) {
    const [row] = await this.db
      .select()
      .from(checklistTemplates)
      .where(
        and(
          eq(checklistTemplates.workspaceId, workspaceId),
          eq(checklistTemplates.kind, kind),
          eq(checklistTemplates.isDefault, true),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Make this template the one new hires (or leavers) are given. The old
   * default is stood down in the same transaction, so there is never a moment
   * with two — the partial unique index would refuse it — or with none.
   * Answers false when the template is not in this workspace.
   */
  async setDefault(workspaceId: string, templateId: string): Promise<boolean> {
    const template = await this.findTemplate(templateId);
    if (!template || template.workspaceId !== workspaceId) return false;

    await this.db.transaction(async (tx) => {
      await tx
        .update(checklistTemplates)
        .set({ isDefault: false })
        .where(
          and(
            eq(checklistTemplates.workspaceId, workspaceId),
            eq(checklistTemplates.kind, template.kind),
            ne(checklistTemplates.id, templateId),
          ),
        );
      await tx
        .update(checklistTemplates)
        .set({ isDefault: true })
        .where(eq(checklistTemplates.id, templateId));
    });
    return true;
  }

  // --- A template's tasks --------------------------------------------------

  async listTemplateItems(templateId: string) {
    return this.db
      .select()
      .from(checklistTemplateItems)
      .where(eq(checklistTemplateItems.templateId, templateId));
  }

  async addTemplateItem(
    templateId: string,
    label: string,
    sortOrder: number,
    assigneeRole?: string,
    beginOnDays = 0,
    departmentId: string | null = null,
  ): Promise<void> {
    await this.db
      .insert(checklistTemplateItems)
      .values({ templateId, label, sortOrder, assigneeRole, beginOnDays, departmentId });
  }

  /** One template task, with the template it belongs to. */
  async findTemplateItem(itemId: string) {
    const [row] = await this.db
      .select({
        id: checklistTemplateItems.id,
        label: checklistTemplateItems.label,
        sortOrder: checklistTemplateItems.sortOrder,
        assigneeRole: checklistTemplateItems.assigneeRole,
        beginOnDays: checklistTemplateItems.beginOnDays,
        departmentId: checklistTemplateItems.departmentId,
        workspaceId: checklistTemplates.workspaceId,
        kind: checklistTemplates.kind,
        isDefault: checklistTemplates.isDefault,
      })
      .from(checklistTemplateItems)
      .innerJoin(checklistTemplates, eq(checklistTemplates.id, checklistTemplateItems.templateId))
      .where(eq(checklistTemplateItems.id, itemId))
      .limit(1);
    return row ?? null;
  }

  async setTemplateItemDepartment(itemId: string, departmentId: string | null): Promise<void> {
    await this.db
      .update(checklistTemplateItems)
      .set({ departmentId })
      .where(eq(checklistTemplateItems.id, itemId));
  }

  async deleteTemplateItem(itemId: string): Promise<void> {
    await this.db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.id, itemId));
  }

  async departmentInWorkspace(workspaceId: string, departmentId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.workspaceId, workspaceId)))
      .limit(1);
    return row !== undefined;
  }

  // --- Keeping people's checklists in step ---------------------------------

  /**
   * Hand a task to everybody it is for who does not hold it yet. Answers how
   * many people received it.
   *
   * WHO IT IS FOR differs by kind. An onboarding task goes to every active
   * employee in its department, because the onboarding list is what everybody
   * there is expected to have done. An offboarding task goes only to people
   * who are already being offboarded — handing every employee a leaver's task
   * the day it is written would be wrong.
   */
  async giveTask(task: TaskToGive): Promise<number> {
    const inDepartment = task.departmentId
      ? eq(departmentMembers.departmentId, task.departmentId)
      : undefined;

    const candidates =
      task.kind === 'onboarding'
        ? await this.db
            .select({ id: departmentMembers.id })
            .from(departmentMembers)
            .where(
              and(
                eq(departmentMembers.workspaceId, task.workspaceId),
                eq(departmentMembers.status, 'active'),
                inDepartment,
              ),
            )
        : await this.db
            .selectDistinct({ id: departmentMembers.id })
            .from(checklistItems)
            .innerJoin(departmentMembers, eq(departmentMembers.id, checklistItems.departmentMemberId))
            .where(
              and(
                eq(checklistItems.workspaceId, task.workspaceId),
                eq(checklistItems.kind, 'offboarding'),
                inDepartment,
              ),
            );
    if (candidates.length === 0) return 0;

    const holders = await this.db
      .select({ id: checklistItems.departmentMemberId })
      .from(checklistItems)
      .where(
        and(
          eq(checklistItems.workspaceId, task.workspaceId),
          eq(checklistItems.kind, task.kind),
          eq(checklistItems.label, task.label),
        ),
      );
    const alreadyHave = new Set(holders.map((row) => row.id));
    const receivers = candidates.filter((c) => !alreadyHave.has(c.id));
    if (receivers.length === 0) return 0;

    await this.db.insert(checklistItems).values(
      receivers.map((r) => ({
        departmentMemberId: r.id,
        workspaceId: task.workspaceId,
        kind: task.kind,
        label: task.label,
        sortOrder: task.sortOrder,
        assigneeRole: task.assigneeRole ?? undefined,
        beginOnDays: task.beginOnDays,
        dueDate: addDays(new Date(), task.beginOnDays),
      })),
    );
    return receivers.length;
  }

  /**
   * Take a task back from the people it is no longer for: everybody when
   * `keepDepartmentId` is null (the task was removed), otherwise everybody
   * outside that department (the task was moved to it). Only copies NOT yet
   * done — a ticked task is a record and stays. Answers how many were removed.
   */
  async withdrawTask(input: {
    workspaceId: string;
    kind: Kind;
    label: string;
    keepDepartmentId: string | null;
  }): Promise<number> {
    const copies = await this.db
      .select({ id: checklistItems.id })
      .from(checklistItems)
      .innerJoin(departmentMembers, eq(departmentMembers.id, checklistItems.departmentMemberId))
      .where(
        and(
          eq(checklistItems.workspaceId, input.workspaceId),
          eq(checklistItems.kind, input.kind),
          eq(checklistItems.label, input.label),
          eq(checklistItems.done, false),
          input.keepDepartmentId
            ? ne(departmentMembers.departmentId, input.keepDepartmentId)
            : undefined,
        ),
      );
    if (copies.length === 0) return 0;

    await this.db.delete(checklistItems).where(
      inArray(
        checklistItems.id,
        copies.map((c) => c.id),
      ),
    );
    return copies.length;
  }

  /**
   * Copy onto one person's checklist the tasks of the list in use that are for
   * their department (or for everybody) and that they do not already hold,
   * each with a due date from today plus its offset.
   *
   * Answers how many tasks were copied (0 when they hold them all), or why
   * none could be, so a caller can say so rather than report a success that
   * assigned nothing.
   */
  async applyDefaultTemplate(
    workspaceId: string,
    departmentMemberId: string,
    kind: Kind,
  ): Promise<number | 'not_found' | 'no_template' | 'no_items' | 'none_for_department'> {
    const [member] = await this.db
      .select({ departmentId: departmentMembers.departmentId })
      .from(departmentMembers)
      .where(
        and(
          eq(departmentMembers.id, departmentMemberId),
          eq(departmentMembers.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!member) return 'not_found';

    const template = await this.findDefaultTemplate(workspaceId, kind);
    if (!template) return 'no_template';

    const templateItems = await this.listTemplateItems(template.id);
    if (templateItems.length === 0) return 'no_items';

    const forThem = templateItems.filter(
      (item) => item.departmentId === null || item.departmentId === member.departmentId,
    );
    if (forThem.length === 0) return 'none_for_department';

    const held = await this.db
      .select({ label: checklistItems.label })
      .from(checklistItems)
      .where(
        and(
          eq(checklistItems.departmentMemberId, departmentMemberId),
          eq(checklistItems.kind, kind),
        ),
      );
    const heldLabels = new Set(held.map((row) => row.label));
    const items = forThem.filter((item) => !heldLabels.has(item.label));
    if (items.length === 0) return 0;

    const startDate = new Date();
    await this.db.insert(checklistItems).values(
      items.map((item) => ({
        departmentMemberId,
        workspaceId,
        kind,
        label: item.label,
        sortOrder: item.sortOrder,
        assigneeRole: item.assigneeRole,
        beginOnDays: item.beginOnDays,
        dueDate: addDays(startDate, item.beginOnDays),
      })),
    );
    return items.length;
  }

  // --- One person's checklist ----------------------------------------------

  /**
   * How far along each person's checklist is: tasks in all, done, and still
   * open past their due date. One grouped read, so the roster can show
   * progress without opening every row.
   */
  async progressForWorkspace(
    workspaceId: string,
  ): Promise<{ departmentMemberId: string; total: number; done: number; overdue: number }[]> {
    return this.db
      .select({
        departmentMemberId: checklistItems.departmentMemberId,
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${checklistItems.done})::int`,
        overdue: sql<number>`count(*) filter (where not ${checklistItems.done} and ${checklistItems.dueDate} < current_date)::int`,
      })
      .from(checklistItems)
      .where(eq(checklistItems.workspaceId, workspaceId))
      .groupBy(checklistItems.departmentMemberId);
  }

  async listForEmployee(departmentMemberId: string): Promise<ChecklistItemRow[]> {
    return this.db
      .select({
        id: checklistItems.id,
        kind: checklistItems.kind,
        label: checklistItems.label,
        sortOrder: checklistItems.sortOrder,
        assigneeRole: checklistItems.assigneeRole,
        beginOnDays: checklistItems.beginOnDays,
        dueDate: checklistItems.dueDate,
        done: checklistItems.done,
        completedAt: checklistItems.completedAt,
      })
      .from(checklistItems)
      .where(eq(checklistItems.departmentMemberId, departmentMemberId));
  }

  async toggleItem(itemId: string, done: boolean, completedByUserId: string): Promise<void> {
    await this.db
      .update(checklistItems)
      .set({
        done,
        completedAt: done ? new Date() : null,
        completedByUserId: done ? completedByUserId : null,
      })
      .where(eq(checklistItems.id, itemId));
  }

  async addAdHocItem(
    departmentMemberId: string,
    workspaceId: string,
    kind: Kind,
    label: string,
  ): Promise<void> {
    await this.db.insert(checklistItems).values({
      departmentMemberId,
      workspaceId,
      kind,
      label,
      sortOrder: 999,
    });
  }
}
