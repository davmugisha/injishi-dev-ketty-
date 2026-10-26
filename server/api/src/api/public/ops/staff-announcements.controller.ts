import {
  CreateStaffAnnouncementRequest,
  HR_PERMISSIONS,
  UpdateStaffAnnouncementRequest,
  type FileLink,
  type StaffAnnouncement,
  type StaffAnnouncementList,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { HrContentService } from '../../../modules/hr/application/hr-content.service';
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
 * Staff announcements -> /api/v1/ops/staff-announcements (058-people-file
 * AC-PF9). Separate from the platform's own `announcements`, which platform
 * staff write for every business.
 *
 * Read by any HR permission, written by `people.manage`. Posting one writes
 * `announcement.published`, which the automations deliver to its audience;
 * staff read, view and comment on it through self service.
 */
@Controller({ path: 'ops/staff-announcements', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsStaffAnnouncementsController {
  constructor(private readonly content: HrContentService) {}

  @Get()
  @RequireAnyPermission(...HR_PERMISSIONS)
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<StaffAnnouncementList> {
    return this.content.announcements(workspace);
  }

  @Post()
  @RequirePermission('people.manage')
  create(
    @Body(new ZodValidationPipe(CreateStaffAnnouncementRequest)) body: CreateStaffAnnouncementRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<StaffAnnouncement> {
    return this.content.createAnnouncement(workspace, user.id, body);
  }

  @Patch(':id')
  @RequirePermission('people.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateStaffAnnouncementRequest)) body: UpdateStaffAnnouncementRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<StaffAnnouncement> {
    return this.content.updateAnnouncement(workspace, user.id, id, body);
  }

  @Get(':id/files/:index')
  @RequireAnyPermission(...HR_PERMISSIONS)
  file(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<FileLink> {
    return this.content.announcementFileLink(workspace, id, index);
  }
}
