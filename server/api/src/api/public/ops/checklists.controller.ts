import {
  CreateChecklistTemplateRequest,
  StartChecklistRequest,
  UpdateChecklistTemplateRequest,
  type ChecklistBoard,
  type ChecklistTemplate,
  type ChecklistTemplateList,
  type EmployeeChecklist,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { ChecklistsService } from '../../../modules/people/application/checklists.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Checklists -> /api/v1/ops/hr/checklist-templates, /checklist-board, /checklists (POST) and
 * /checklist-tasks (ADR-058).
 *
 * What a business does when somebody joins and when somebody leaves. Read by
 * whoever reads files (`people.view`, `people.manage`); every write is
 * `people.manage`'s: a template, starting a checklist for a person, ticking a
 * task. A person ticks their own tasks through `/me/work`, never here.
 *
 * A template is replaced whole (`PUT`): its tasks are an ordered list, and a
 * list edited row by row over several requests can be left half moved.
 */
@Controller({ path: 'ops/hr', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Get('checklist-templates')
  @RequireAnyPermission('people.view', 'people.manage')
  templates(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<ChecklistTemplateList> {
    return this.checklists.templates(workspace);
  }

  @Post('checklist-templates')
  @RequirePermission('people.manage')
  createTemplate(
    @Body(new ZodValidationPipe(CreateChecklistTemplateRequest)) body: CreateChecklistTemplateRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ChecklistTemplate> {
    return this.checklists.createTemplate(workspace, user.id, body);
  }

  @Put('checklist-templates/:id')
  @RequirePermission('people.manage')
  updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateChecklistTemplateRequest)) body: UpdateChecklistTemplateRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ChecklistTemplate> {
    return this.checklists.updateTemplate(workspace, user.id, id, body);
  }

  @Delete('checklist-templates/:id')
  @HttpCode(204)
  @RequirePermission('people.manage')
  deleteTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    return this.checklists.deleteTemplate(workspace, user.id, id);
  }

  /**
   * Every checklist in the caller's branches, and who joined or is leaving with none.
   * At `checklist-board` since the new interface's own checklists took
   * `GET /ops/hr/checklists` (hr-workforce.controller, merged from main 2026-10-26).
   */
  @Get('checklist-board')
  @RequireAnyPermission('people.view', 'people.manage')
  board(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<ChecklistBoard> {
    return this.checklists.board(workspace);
  }

  @Post('checklists')
  @RequirePermission('people.manage')
  start(
    @Body(new ZodValidationPipe(StartChecklistRequest)) body: StartChecklistRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EmployeeChecklist> {
    return this.checklists.start(workspace, user.id, body);
  }

  @Post('checklist-tasks/:id/done')
  @HttpCode(200)
  @RequirePermission('people.manage')
  done(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EmployeeChecklist> {
    return this.checklists.setDone(workspace, user.id, id, true);
  }

  /** Ticked by mistake: who and when are cleared, and the task stands. */
  @Post('checklist-tasks/:id/undo')
  @HttpCode(200)
  @RequirePermission('people.manage')
  undo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EmployeeChecklist> {
    return this.checklists.setDone(workspace, user.id, id, false);
  }
}
