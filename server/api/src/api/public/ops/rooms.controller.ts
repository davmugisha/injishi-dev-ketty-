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

import { FrontDeskService } from '../../../modules/pms/application/front-desk.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Rooms → /api/v1/ops/rooms (ADR-012 step 4).
 *
 * The read is open to every role that works a room: the desk checking a guest
 * in (`stay.checkin`) or holding one on the grid (`reservation.assign`),
 * housekeeping (`housekeeping.set`) and inventory (`listing.manage`). A
 * business still in the registration pipeline holds none of them (audit H1).
 * Setting housekeeping is a command and declares `housekeeping.set`
 * — the one permission a housekeeper holds, which is exactly why the two are
 * separated.
 */
@Controller({ path: 'ops/rooms', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pms')
export class OpsRoomsController {
  constructor(private readonly frontDesk: FrontDeskService) {}

  /** Every room on this property, with who is in it right now. */
  @Get()
  @RequireAnyPermission(
    'stay.checkin',
    'housekeeping.set',
    'reservation.assign',
    'listing.manage',
  )
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
