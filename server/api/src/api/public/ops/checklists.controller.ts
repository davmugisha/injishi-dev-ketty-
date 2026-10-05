import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ChecklistService } from '../../../modules/hr/application/checklist.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';

/**
 * Onboarding/offboarding checklists (HR module, Phase 3). Gated on
 * employee.manage, same as the rest of HR.
 */
@Controller({ path: 'ops/checklists', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsChecklistsController {
  constructor(private readonly checklists: ChecklistService) {}

  @Get('templates')
  @RequirePermission('employee.manage')
  listTemplates(@CurrentWorkspace() workspace: ScopedWorkspace) {
    return this.checklists.listTemplates(workspace);
  }

  @Post('templates')
  @RequirePermission('employee.manage')
  createTemplate(
    @Body() body: { kind: 'onboarding' | 'offboarding'; name: string; isDefault?: boolean },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ) {
    return this.checklists.createTemplate(workspace, body.kind, body.name, body.isDefault ?? false);
  }

  @Get('templates/:id/items')
  @RequirePermission('employee.manage')
  listTemplateItems(@Param('id', ParseUUIDPipe) id: string) {
    return this.checklists.listTemplateItems(id);
  }

  @Post('templates/:id/items')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async addTemplateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { label: string; sortOrder?: number; assigneeRole?: string; beginOnDays?: number },
  ): Promise<void> {
    await this.checklists.addTemplateItem(
      id,
      body.label,
      body.sortOrder ?? 0,
      body.assigneeRole,
      body.beginOnDays,
    );
  }

  @Get('employees/:departmentMemberId')
  @RequirePermission('employee.manage')
  listForEmployee(@Param('departmentMemberId', ParseUUIDPipe) departmentMemberId: string) {
    return this.checklists.listForEmployee(departmentMemberId);
  }

  @Post('employees/:departmentMemberId/apply-template')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async applyTemplate(
    @Param('departmentMemberId', ParseUUIDPipe) departmentMemberId: string,
    @Body() body: { kind: 'onboarding' | 'offboarding' },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.checklists.applyDefaultTemplate(workspace, departmentMemberId, body.kind);
  }

  @Post('employees/:departmentMemberId/items')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async addAdHocItem(
    @Param('departmentMemberId', ParseUUIDPipe) departmentMemberId: string,
    @Body() body: { kind: 'onboarding' | 'offboarding'; label: string },
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.checklists.addAdHocItem(workspace, departmentMemberId, body.kind, body.label);
  }

  @Patch('items/:itemId')
  @HttpCode(204)
  @RequirePermission('employee.manage')
  async toggleItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: { done: boolean },
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.checklists.toggleItem(itemId, body.done, user.id);
  }
}
