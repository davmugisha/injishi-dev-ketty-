import { Injectable } from '@nestjs/common';
import type { WorkspaceAccess } from '@injishi/contracts';

import { ChecklistRepository } from '../infrastructure/checklist.repository';

@Injectable()
export class ChecklistService {
  constructor(private readonly checklists: ChecklistRepository) {}

  async listTemplates(ws: WorkspaceAccess) {
    return this.checklists.listTemplates(ws.workspaceId);
  }

  async createTemplate(
    ws: WorkspaceAccess,
    kind: 'onboarding' | 'offboarding',
    name: string,
    isDefault: boolean,
  ) {
    return this.checklists.createTemplate(ws.workspaceId, kind, name, isDefault);
  }

  async addTemplateItem(
    templateId: string,
    label: string,
    sortOrder: number,
    assigneeRole?: string,
    beginOnDays?: number,
  ) {
    await this.checklists.addTemplateItem(templateId, label, sortOrder, assigneeRole, beginOnDays);
  }

  async listTemplateItems(templateId: string) {
    return this.checklists.listTemplateItems(templateId);
  }

  async applyDefaultTemplate(
    ws: WorkspaceAccess,
    departmentMemberId: string,
    kind: 'onboarding' | 'offboarding',
  ) {
    await this.checklists.applyDefaultTemplate(ws.workspaceId, departmentMemberId, kind);
  }

  async listForEmployee(departmentMemberId: string) {
    return this.checklists.listForEmployee(departmentMemberId);
  }

  async toggleItem(itemId: string, done: boolean, userId: string) {
    await this.checklists.toggleItem(itemId, done, userId);
  }

  async addAdHocItem(
    ws: WorkspaceAccess,
    departmentMemberId: string,
    kind: 'onboarding' | 'offboarding',
    label: string,
  ) {
    await this.checklists.addAdHocItem(departmentMemberId, ws.workspaceId, kind, label);
  }
}
