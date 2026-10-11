import {
  CreateSavedViewRequest,
  LIST_READ,
  UpdateSavedViewRequest,
  type Permission,
  type SavedView,
  type SavedViewList,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { SavedViewsService } from '../../../modules/lists/application/saved-views.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Every permission that reads some list. The route serves every list, so it can
 * only declare their union; `SavedViewsService` then demands the named list's
 * own permissions (`LIST_READ`), so holding one list's permission never opens
 * another list's views.
 */
const ANY_LIST_READ = [...new Set(Object.values(LIST_READ).flat())] as [Permission, ...Permission[]];

/**
 * Saved list views -> /api/v1/ops/list-views (058-list-framework AC-LF5).
 */
@Controller({ path: 'ops/list-views', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsListViewsController {
  constructor(private readonly views: SavedViewsService) {}

  @Get()
  @RequireAnyPermission(...ANY_LIST_READ)
  list(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Query('listKey') listKey: string,
  ): Promise<SavedViewList> {
    return this.views.list(ws, user.id, String(listKey ?? ''));
  }

  @Post()
  @RequireAnyPermission(...ANY_LIST_READ)
  create(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(CreateSavedViewRequest)) body: CreateSavedViewRequest,
  ): Promise<SavedView> {
    return this.views.create(ws, user.id, body);
  }

  @Patch(':id')
  @RequireAnyPermission(...ANY_LIST_READ)
  update(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSavedViewRequest)) body: UpdateSavedViewRequest,
  ): Promise<SavedView> {
    return this.views.update(ws, user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireAnyPermission(...ANY_LIST_READ)
  async remove(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.views.remove(ws, user.id, id);
  }
}
