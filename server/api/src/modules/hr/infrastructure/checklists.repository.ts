import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';

import {
  checklistTemplateItems,
  checklistTemplates,
  employeeChecklistTasks,
  employeeChecklists,
  employees,
  jobPositions,
  users,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ChecklistKind, TaskToWrite } from '../domain/checklists';
import type { Tx } from './employees.repository';

export interface TemplateRow {
  id: string;
  orgId: string;
  kind: ChecklistKind;
  name: string;
  isDefault: boolean;
}

export interface TemplateItemRow {
  id: string;
  templateId: string;
  label: string;
  code: string | null;
  detail: string | null;
  sortOrder: number;
  byEmployee: boolean;
  ownerOnly: boolean;
  dueAfterDays: number;
  jobPositionId: string | null;
  jobPositionTitle: string | null;
}

export interface TemplateItemValues {
  label: string;
  code: string | null;
  detail: string | null;
  sortOrder: number;
  byEmployee: boolean;
  ownerOnly: boolean;
  dueAfterDays: number;
  jobPositionId: string | null;
}

/** A person's checklist with the roster card fields of whose it is. */
export interface ChecklistRow {
  id: string;
  orgId: string;
  employeeId: string;
  kind: ChecklistKind;
  templateName: string;
  anchorOn: string;
  startedAt: Date;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
}

export interface TaskRow {
  id: string;
  checklistId: string;
  label: string;
  code: string | null;
  detail: string | null;
  sortOrder: number;
  byEmployee: boolean;
  ownerOnly: boolean;
  dueOn: string;
  doneAt: Date | null;
  doneByName: string | null;
}

/** Somebody who joined or left lately with no checklist of that kind. */
export interface UnstartedRow {
  id: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  kind: ChecklistKind;
  on: string;
}

const checklistColumns = {
  id: employeeChecklists.id,
  orgId: employeeChecklists.orgId,
  employeeId: employeeChecklists.employeeId,
  kind: employeeChecklists.kind,
  templateName: employeeChecklists.templateName,
  anchorOn: employeeChecklists.anchorOn,
  startedAt: employeeChecklists.startedAt,
  preferredName: employees.preferredName,
  legalName: employees.legalName,
  jobPositionTitle: jobPositions.title,
  workPropertyId: employees.workPropertyId,
};

/**
 * Checklist rows (ADR-058). Every query names the business; a list is narrowed
 * to the caller's branches in its own `where`, and a single row is read
 * unscoped so the service can prove it belongs before acting on it, as the
 * other HR repositories do.
 */
@Injectable()
export class ChecklistsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Templates ----------------------------------------------------------------------

  async templates(orgId: string, tx?: Tx): Promise<TemplateRow[]> {
    return (tx ?? this.db)
      .select({
        id: checklistTemplates.id,
        orgId: checklistTemplates.orgId,
        kind: checklistTemplates.kind,
        name: checklistTemplates.name,
        isDefault: checklistTemplates.isDefault,
      })
      .from(checklistTemplates)
      .where(eq(checklistTemplates.orgId, orgId))
      // The default first within its kind, then by name: the order the screen lists them.
      .orderBy(asc(checklistTemplates.kind), desc(checklistTemplates.isDefault), asc(checklistTemplates.name));
  }

  async findTemplate(id: string, tx?: Tx): Promise<TemplateRow | null> {
    const [row] = await (tx ?? this.db)
      .select({
        id: checklistTemplates.id,
        orgId: checklistTemplates.orgId,
        kind: checklistTemplates.kind,
        name: checklistTemplates.name,
        isDefault: checklistTemplates.isDefault,
      })
      .from(checklistTemplates)
      .where(eq(checklistTemplates.id, id))
      .limit(1);
    return row ?? null;
  }

  async defaultTemplate(orgId: string, kind: ChecklistKind, tx?: Tx): Promise<TemplateRow | null> {
    const [row] = await (tx ?? this.db)
      .select({
        id: checklistTemplates.id,
        orgId: checklistTemplates.orgId,
        kind: checklistTemplates.kind,
        name: checklistTemplates.name,
        isDefault: checklistTemplates.isDefault,
      })
      .from(checklistTemplates)
      .where(and(eq(checklistTemplates.orgId, orgId), eq(checklistTemplates.kind, kind), eq(checklistTemplates.isDefault, true)))
      .limit(1);
    return row ?? null;
  }

  async itemsOf(templateIds: readonly string[], tx?: Tx): Promise<TemplateItemRow[]> {
    if (templateIds.length === 0) return [];
    return (tx ?? this.db)
      .select({
        id: checklistTemplateItems.id,
        templateId: checklistTemplateItems.templateId,
        label: checklistTemplateItems.label,
        code: checklistTemplateItems.code,
        detail: checklistTemplateItems.detail,
        sortOrder: checklistTemplateItems.sortOrder,
        byEmployee: checklistTemplateItems.byEmployee,
        ownerOnly: checklistTemplateItems.ownerOnly,
        dueAfterDays: checklistTemplateItems.dueAfterDays,
        jobPositionId: checklistTemplateItems.jobPositionId,
        jobPositionTitle: jobPositions.title,
      })
      .from(checklistTemplateItems)
      .leftJoin(jobPositions, eq(jobPositions.id, checklistTemplateItems.jobPositionId))
      .where(inArray(checklistTemplateItems.templateId, [...templateIds]))
      .orderBy(asc(checklistTemplateItems.templateId), asc(checklistTemplateItems.sortOrder));
  }

  /** The job positions of a business among these ids: a task may only name one of its own. */
  async ownPositions(orgId: string, ids: readonly string[], tx?: Tx): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await (tx ?? this.db)
      .select({ id: jobPositions.id })
      .from(jobPositions)
      .where(and(eq(jobPositions.orgId, orgId), inArray(jobPositions.id, [...ids])));
    return new Set(rows.map((r) => r.id));
  }

  async insertTemplate(
    tx: Tx,
    values: { orgId: string; kind: ChecklistKind; name: string; isDefault: boolean },
    items: readonly TemplateItemValues[],
  ): Promise<string> {
    const [row] = await tx.insert(checklistTemplates).values(values).returning({ id: checklistTemplates.id });
    await tx.insert(checklistTemplateItems).values(items.map((item) => ({ templateId: row.id, ...item })));
    return row.id;
  }

  /** The name, the default flag and every task, replaced whole. */
  async replaceTemplate(
    tx: Tx,
    id: string,
    values: { name: string; isDefault: boolean },
    items: readonly TemplateItemValues[],
  ): Promise<void> {
    await tx.update(checklistTemplates).set({ ...values, updatedAt: new Date() }).where(eq(checklistTemplates.id, id));
    await tx.delete(checklistTemplateItems).where(eq(checklistTemplateItems.templateId, id));
    await tx.insert(checklistTemplateItems).values(items.map((item) => ({ templateId: id, ...item })));
  }

  /** Take the default off every other template of a kind, before one is made the default. */
  async clearDefault(tx: Tx, orgId: string, kind: ChecklistKind, exceptId: string | null): Promise<void> {
    await tx
      .update(checklistTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(checklistTemplates.orgId, orgId),
          eq(checklistTemplates.kind, kind),
          eq(checklistTemplates.isDefault, true),
          exceptId ? ne(checklistTemplates.id, exceptId) : undefined,
        ),
      );
  }

  async deleteTemplate(tx: Tx, id: string): Promise<void> {
    await tx.delete(checklistTemplates).where(eq(checklistTemplates.id, id));
  }

  // --- A person's checklist ---------------------------------------------------------

  /** Every checklist of the business in the caller's branches, newest first. */
  async checklists(orgId: string, scope: BranchScope): Promise<ChecklistRow[]> {
    return this.db
      .select(checklistColumns)
      .from(employeeChecklists)
      .innerJoin(employees, eq(employees.id, employeeChecklists.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(and(eq(employeeChecklists.orgId, orgId), inBranchScope(employees.workPropertyId, scope)))
      .orderBy(desc(employeeChecklists.startedAt));
  }

  async checklistsOf(employeeId: string, tx?: Tx): Promise<ChecklistRow[]> {
    return (tx ?? this.db)
      .select(checklistColumns)
      .from(employeeChecklists)
      .innerJoin(employees, eq(employees.id, employeeChecklists.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(eq(employeeChecklists.employeeId, employeeId))
      .orderBy(asc(employeeChecklists.kind));
  }

  async findChecklist(id: string, tx?: Tx): Promise<ChecklistRow | null> {
    const [row] = await (tx ?? this.db)
      .select(checklistColumns)
      .from(employeeChecklists)
      .innerJoin(employees, eq(employees.id, employeeChecklists.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(eq(employeeChecklists.id, id))
      .limit(1);
    return row ?? null;
  }

  async hasChecklist(employeeId: string, kind: ChecklistKind, tx?: Tx): Promise<boolean> {
    const [row] = await (tx ?? this.db)
      .select({ id: employeeChecklists.id })
      .from(employeeChecklists)
      .where(and(eq(employeeChecklists.employeeId, employeeId), eq(employeeChecklists.kind, kind)))
      .limit(1);
    return !!row;
  }

  async tasksOf(checklistIds: readonly string[], tx?: Tx): Promise<TaskRow[]> {
    if (checklistIds.length === 0) return [];
    return (tx ?? this.db)
      .select({
        id: employeeChecklistTasks.id,
        checklistId: employeeChecklistTasks.checklistId,
        label: employeeChecklistTasks.label,
        code: employeeChecklistTasks.code,
        detail: employeeChecklistTasks.detail,
        sortOrder: employeeChecklistTasks.sortOrder,
        byEmployee: employeeChecklistTasks.byEmployee,
        ownerOnly: employeeChecklistTasks.ownerOnly,
        dueOn: employeeChecklistTasks.dueOn,
        doneAt: employeeChecklistTasks.doneAt,
        doneByName: users.name,
      })
      .from(employeeChecklistTasks)
      .leftJoin(users, eq(users.id, employeeChecklistTasks.doneByUserId))
      .where(inArray(employeeChecklistTasks.checklistId, [...checklistIds]))
      .orderBy(asc(employeeChecklistTasks.checklistId), asc(employeeChecklistTasks.sortOrder));
  }

  async findTask(
    id: string,
    tx?: Tx,
  ): Promise<{ id: string; orgId: string; checklistId: string; byEmployee: boolean; ownerOnly: boolean; doneAt: Date | null } | null> {
    const [row] = await (tx ?? this.db)
      .select({
        id: employeeChecklistTasks.id,
        orgId: employeeChecklistTasks.orgId,
        checklistId: employeeChecklistTasks.checklistId,
        byEmployee: employeeChecklistTasks.byEmployee,
        ownerOnly: employeeChecklistTasks.ownerOnly,
        doneAt: employeeChecklistTasks.doneAt,
      })
      .from(employeeChecklistTasks)
      .where(eq(employeeChecklistTasks.id, id))
      .limit(1);
    return row ?? null;
  }

  /**
   * Start a checklist and write its tasks. Null when the person already has
   * one of this kind: two people pressing Start at once make one checklist,
   * and the unique index is what says so.
   */
  async insertChecklist(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      kind: ChecklistKind;
      templateName: string;
      anchorOn: string;
      startedByUserId: string | null;
    },
    tasks: readonly TaskToWrite[],
  ): Promise<string | null> {
    const [row] = await tx
      .insert(employeeChecklists)
      .values(values)
      .onConflictDoNothing({ target: [employeeChecklists.employeeId, employeeChecklists.kind] })
      .returning({ id: employeeChecklists.id });
    if (!row) return null;
    if (tasks.length > 0) {
      await tx.insert(employeeChecklistTasks).values(tasks.map((task) => ({ orgId: values.orgId, checklistId: row.id, ...task })));
    }
    return row.id;
  }

  /** Tick a task, or untick it: unticking clears who and when and keeps the row. */
  async setTaskDone(tx: Tx, id: string, done: { at: Date; byUserId: string } | null): Promise<void> {
    await tx
      .update(employeeChecklistTasks)
      .set({ doneAt: done?.at ?? null, doneByUserId: done?.byUserId ?? null })
      .where(eq(employeeChecklistTasks.id, id));
  }

  /**
   * Who joined since a day and has no joining checklist, and who left since
   * then (or is on file to leave) and has no leaving one. In the caller's
   * branches, the most recent first.
   */
  async unstarted(orgId: string, scope: BranchScope, since: string): Promise<UnstartedRow[]> {
    const none = (kind: ChecklistKind): SQL =>
      sql`not exists (select 1 from ${employeeChecklists} c where c.employee_id = ${employees.id} and c.kind = ${kind})`;
    const card = {
      id: employees.id,
      preferredName: employees.preferredName,
      legalName: employees.legalName,
      jobPositionTitle: jobPositions.title,
    };
    const joined = await this.db
      .select({ ...card, on: employees.hiredOn })
      .from(employees)
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(
        and(
          eq(employees.orgId, orgId),
          eq(employees.status, 'active'),
          isNull(employees.offboardedOn),
          gte(employees.hiredOn, since),
          inBranchScope(employees.workPropertyId, scope),
          none('onboarding'),
        ),
      )
      .orderBy(desc(employees.hiredOn));
    const left = await this.db
      .select({ ...card, on: employees.offboardedOn })
      .from(employees)
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(
        and(
          eq(employees.orgId, orgId),
          gte(employees.offboardedOn, since),
          inBranchScope(employees.workPropertyId, scope),
          none('offboarding'),
        ),
      )
      .orderBy(desc(employees.offboardedOn));
    return [
      ...joined.map((r) => ({ ...r, kind: 'onboarding' as const })),
      ...left.map((r) => ({ ...r, kind: 'offboarding' as const, on: r.on as string })),
    ];
  }
}
