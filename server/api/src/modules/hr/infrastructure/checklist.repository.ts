import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  checklistItems,
  checklistTemplateItems,
  checklistTemplates,
} from '../../../database/drizzle/hr-lifecycle';

export interface ChecklistItemRow {
  id: string;
  kind: 'onboarding' | 'offboarding';
  label: string;
  sortOrder: number;
  assigneeRole: string | null;
  beginOnDays: number;
  dueDate: string | null;
  done: boolean;
  completedAt: Date | null;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Onboarding/offboarding checklists (HR module, Phase 3). Templates are
 * configured once per workspace, including each task's assignee role and
 * day offset; hiring or terminating someone copies the current default
 * template's items onto their own checklist, computing a due date from
 * the copy date plus each task's offset.
 */
@Injectable()
export class ChecklistRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listTemplates(workspaceId: string) {
    return this.db
      .select()
      .from(checklistTemplates)
      .where(eq(checklistTemplates.workspaceId, workspaceId));
  }

  async createTemplate(
    workspaceId: string,
    kind: 'onboarding' | 'offboarding',
    name: string,
    isDefault: boolean,
  ): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(checklistTemplates)
      .values({ workspaceId, kind, name, isDefault })
      .returning({ id: checklistTemplates.id });
    return row;
  }

  async addTemplateItem(
    templateId: string,
    label: string,
    sortOrder: number,
    assigneeRole?: string,
    beginOnDays = 0,
  ): Promise<void> {
    await this.db
      .insert(checklistTemplateItems)
      .values({ templateId, label, sortOrder, assigneeRole, beginOnDays });
  }

  async listTemplateItems(templateId: string) {
    return this.db
      .select()
      .from(checklistTemplateItems)
      .where(eq(checklistTemplateItems.templateId, templateId));
  }

  async findDefaultTemplate(workspaceId: string, kind: 'onboarding' | 'offboarding') {
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

  /** Copies the default template's items onto a new checklist, computing
   * each task's due date from today plus its beginOnDays offset. */
  async applyDefaultTemplate(
    workspaceId: string,
    departmentMemberId: string,
    kind: 'onboarding' | 'offboarding',
  ): Promise<void> {
    const template = await this.findDefaultTemplate(workspaceId, kind);
    if (!template) return;

    const items = await this.listTemplateItems(template.id);
    if (items.length === 0) return;

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
    kind: 'onboarding' | 'offboarding',
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
