import {
  ExtendFoundItemRetentionRequest,
  type FoundItem,
  type FoundItemList,
  LogFoundItemRequest,
  OpenFoundItemClaimRequest,
  ProposeFoundItemDisposalRequest,
  ReleaseFoundItemRequest,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { LostFoundService } from '../../../modules/pms/application/lost-found.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The lost and found register -> /api/v1/ops/found-items (real-data 1.2.3).
 *
 * Every route, reads included, declares `lostfound.manage`: the register carries guests' names, the
 * statements they gave and the identity checks made before an item went back, which is not for
 * everyone who cleans a room or checks a guest in. The two-person rule on disposal is the service's
 * (and a database CHECK), because a permission cannot say "someone other than the proposer".
 */
@Controller({ path: 'ops/found-items', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsFoundItemsController {
  constructor(private readonly register: LostFoundService) {}

  @Get()
  @RequirePermission('lostfound.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<FoundItemList> {
    return this.register.list(workspace);
  }

  @Get(':id')
  @RequirePermission('lostfound.manage')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<FoundItem> {
    return this.register.get(workspace, id);
  }

  @Post()
  @RequirePermission('lostfound.manage')
  log(
    @Body(new ZodValidationPipe(LogFoundItemRequest)) body: LogFoundItemRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FoundItem> {
    return this.register.log(workspace, body, user.id);
  }

  @Post(':id/claim')
  @RequirePermission('lostfound.manage')
  claim(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(OpenFoundItemClaimRequest)) body: OpenFoundItemClaimRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FoundItem> {
    return this.register.openClaim(workspace, id, body, user.id);
  }

  @Post(':id/release')
  @RequirePermission('lostfound.manage')
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReleaseFoundItemRequest)) body: ReleaseFoundItemRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FoundItem> {
    return this.register.release(workspace, id, body, user.id);
  }

  @Post(':id/disposal')
  @RequirePermission('lostfound.manage')
  proposeDisposal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ProposeFoundItemDisposalRequest)) body: ProposeFoundItemDisposalRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FoundItem> {
    return this.register.proposeDisposal(workspace, id, body, user.id);
  }

  @Post(':id/disposal/approve')
  @RequirePermission('lostfound.manage')
  approveDisposal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FoundItem> {
    return this.register.approveDisposal(workspace, id, user.id);
  }

  @Post(':id/retention')
  @RequirePermission('lostfound.manage')
  extendRetention(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ExtendFoundItemRetentionRequest)) body: ExtendFoundItemRetentionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FoundItem> {
    return this.register.extendRetention(workspace, id, body, user.id);
  }
}
