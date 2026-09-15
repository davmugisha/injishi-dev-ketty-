import {
  type OperatorRoom,
  type OperatorRoomList,
  SetHousekeepingRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { FrontDeskService } from '../../../modules/operations/application/front-desk.service';
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
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Rooms → /api/v1/ops/rooms (ADR-012 step 4).
 *
 * The read carries no permission beyond holding the workspace, which is the
 * ADR's rule for operator reads: a desk that cannot see its own rooms cannot
 * work at all. Setting housekeeping is a command and declares `housekeeping.set`
 * — the one permission a housekeeper holds, which is exactly why the two are
 * separated.
 */
@Controller({ path: 'ops/rooms', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRoomsController {
  constructor(private readonly frontDesk: FrontDeskService) {}

  /** Every room on this property, with who is in it right now. */
  @Get()
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRoomList> {
    return { rooms: await this.frontDesk.listRooms(workspace) };
  }

  /**
   * Mark a room clean, dirty, inspected or out of order.
   *
   * Never touches the room's inventory status. Housekeeping owns readiness;
   * maintenance owns whether a room may be sold, and one role must not be able
   * to put an out of service room back on sale by tidying it.
   */
  @Post(':id/housekeeping')
  @RequirePermission('housekeeping.set')
  setHousekeeping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SetHousekeepingRequest))
    body: SetHousekeepingRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorRoom> {
    return this.frontDesk.setHousekeeping(workspace, id, body, user.id);
  }
}
