import type { MeContext } from '@injishi/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { MeContextService } from '../../../modules/user/application/me-context.service';
import {
  CurrentSession,
  CurrentUser,
  SessionGuard,
  type SessionRecord,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { WorkspaceService } from '../../../shared/auth/workspace.service';

/**
 * Who am I, in one call (blueprint 2.5) -> GET /api/v1/me/context.
 *
 * Session only: it answers for anyone signed in, a guest included, because
 * its job is to say which surfaces this person has (businesses with their
 * role and permissions, the homes they rent, leader or officer seats, a
 * broker record, staff roles) and where they land. The grants come from
 * `WorkspaceService`, the one place that resolves them; nothing here grants
 * anything, and every route behind a surface checks again.
 */
@Controller('me')
@UseGuards(SessionGuard)
export class MeContextController {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly meContext: MeContextService,
  ) {}

  @Get('context')
  async get(@CurrentUser() user: SessionUser, @CurrentSession() session: SessionRecord): Promise<MeContext> {
    const [workspaces, activeWorkspaceId, oversight, staff] = await Promise.all([
      this.workspaces.listForUser(user.id),
      this.workspaces.activeWorkspaceIdFor(session.id),
      this.workspaces.oversightGrantsForUser(user.id),
      this.workspaces.staffAccessForUser(user.id),
    ]);
    return this.meContext.build({
      user: { id: user.id, name: user.name ?? null, email: user.email },
      workspaces,
      activeWorkspaceId,
      oversight,
      staff,
    });
  }
}
