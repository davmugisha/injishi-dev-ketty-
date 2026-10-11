import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

import { ChecklistRepository } from '../infrastructure/checklist.repository';

type Kind = 'onboarding' | 'offboarding';

@Injectable()
export class ChecklistService {
  constructor(private readonly checklists: ChecklistRepository) {}

  async listTemplates(ws: WorkspaceAccess) {
    return this.checklists.listTemplates(ws.workspaceId);
  }

  /**
   * The FIRST template of a kind becomes the default, because a workspace with
   * one template plainly means that one. A later template is an alternative
   * until somebody makes it the default — the caller's own `isDefault` is not
   * taken on trust, since two defaults of a kind cannot exist.
   */
  async createTemplate(ws: WorkspaceAccess, kind: Kind, name: string, _isDefault: boolean) {
    const trimmed = (name ?? '').trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Give the template a name.');
    }
    const existing = await this.checklists.findDefaultTemplate(ws.workspaceId, kind);
    return this.checklists.createTemplate(ws.workspaceId, kind, trimmed, existing === null);
  }

  async setDefaultTemplate(ws: WorkspaceAccess, templateId: string) {
    const changed = await this.checklists.setDefault(ws.workspaceId, templateId);
    if (!changed) throw new NotFoundException('That template is not in this workspace.');
  }

  /** A department named in a request must be one of this workspace's own. */
  private async ownDepartment(ws: WorkspaceAccess, departmentId: string | null): Promise<void> {
    if (departmentId === null) return;
    if (!(await this.checklists.departmentInWorkspace(ws.workspaceId, departmentId))) {
      throw new NotFoundException('That department is not part of this workspace.');
    }
  }

  /**
   * Add a task to a list, for one department or (null) for everybody. Added to
   * the list in use, it also goes straight to the people it is for.
   */
  async addTemplateItem(
    ws: WorkspaceAccess,
    templateId: string,
    label: string,
    sortOrder: number,
    assigneeRole: string | undefined,
    beginOnDays: number | undefined,
    departmentId: string | null,
  ) {
    const template = await this.checklists.findTemplate(templateId);
    if (!template || template.workspaceId !== ws.workspaceId) {
      throw new NotFoundException('That template is not in this workspace.');
    }
    const name = (label ?? '').trim();
    if (name.length === 0) throw new BadRequestException('Give the task a name.');
    await this.ownDepartment(ws, departmentId);

    const days = Math.max(0, Math.round(beginOnDays ?? 0));
    await this.checklists.addTemplateItem(templateId, name, sortOrder, assigneeRole, days, departmentId);

    if (template.isDefault) {
      await this.checklists.giveTask({
        workspaceId: template.workspaceId,
        kind: template.kind,
        label: name,
        sortOrder,
        assigneeRole,
        beginOnDays: days,
        departmentId,
      });
    }
  }

  private async ownTemplateItem(ws: WorkspaceAccess, itemId: string) {
    const item = await this.checklists.findTemplateItem(itemId);
    if (!item || item.workspaceId !== ws.workspaceId) {
      throw new NotFoundException('That task is not in this workspace.');
    }
    return item;
  }

  /**
   * Say which department a task is for (null: everybody). On the list in use
   * the people's checklists follow: it is taken back, where not yet done, from
   * those it is no longer for, and given to those it now is.
   */
  async setTemplateItemDepartment(ws: WorkspaceAccess, itemId: string, departmentId: string | null) {
    const item = await this.ownTemplateItem(ws, itemId);
    await this.ownDepartment(ws, departmentId);
    await this.checklists.setTemplateItemDepartment(itemId, departmentId);

    if (!item.isDefault) return;
    if (departmentId !== null) {
      await this.checklists.withdrawTask({
        workspaceId: item.workspaceId,
        kind: item.kind,
        label: item.label,
        keepDepartmentId: departmentId,
      });
    }
    await this.checklists.giveTask({
      workspaceId: item.workspaceId,
      kind: item.kind,
      label: item.label,
      sortOrder: item.sortOrder,
      assigneeRole: item.assigneeRole,
      beginOnDays: item.beginOnDays,
      departmentId,
    });
  }

  /** Remove a task from a list. From the list in use, undone copies go with it. */
  async deleteTemplateItem(ws: WorkspaceAccess, itemId: string) {
    const item = await this.ownTemplateItem(ws, itemId);
    await this.checklists.deleteTemplateItem(itemId);
    if (item.isDefault) {
      await this.checklists.withdrawTask({
        workspaceId: item.workspaceId,
        kind: item.kind,
        label: item.label,
        keepDepartmentId: null,
      });
    }
  }

  async listTemplateItems(templateId: string) {
    return this.checklists.listTemplateItems(templateId);
  }

  /**
   * Somebody pressed "start". Copies the tasks that are for this person and
   * that they do not hold yet, and refuses out loud when that is none — an
   * empty list and "already has them all" both used to answer 204.
   */
  async applyDefaultTemplate(ws: WorkspaceAccess, departmentMemberId: string, kind: Kind) {
    const copied = await this.checklists.applyDefaultTemplate(ws.workspaceId, departmentMemberId, kind);
    if (copied === 'not_found') {
      throw new NotFoundException('That employee is not in this workspace.');
    }
    if (copied === 0) {
      throw new ConflictException(`This person already has every ${kind} task that is for them.`);
    }
    if (copied === 'no_template' || copied === 'no_items') {
      throw new BadRequestException(`There are no ${kind} tasks yet. Add one first.`);
    }
    if (copied === 'none_for_department') {
      throw new BadRequestException(`There are no ${kind} tasks for this person's department yet.`);
    }
  }

  /**
   * Hiring or terminating somebody hands them the matching checklist. Quiet
   * by design: a workspace with no tasks yet must still be able to hire.
   */
  async applyForLifecycleEvent(workspaceId: string, departmentMemberId: string, kind: Kind) {
    await this.checklists.applyDefaultTemplate(workspaceId, departmentMemberId, kind);
  }

  async progress(ws: WorkspaceAccess) {
    return this.checklists.progressForWorkspace(ws.workspaceId);
  }

  async listForEmployee(departmentMemberId: string) {
    return this.checklists.listForEmployee(departmentMemberId);
  }

  async toggleItem(itemId: string, done: boolean, userId: string) {
    await this.checklists.toggleItem(itemId, done, userId);
  }

  async addAdHocItem(ws: WorkspaceAccess, departmentMemberId: string, kind: Kind, label: string) {
    await this.checklists.addAdHocItem(departmentMemberId, ws.workspaceId, kind, label);
  }
}
