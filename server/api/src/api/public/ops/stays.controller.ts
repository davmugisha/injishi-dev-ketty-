import {
  CheckInRequest,
  type OperatorStay,
  type OperatorStayList,
  WalkInRequest,
  type WorkspaceAccess,
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
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Stays → /api/v1/ops/stays (ADR-012 step 4).
 *
 * **What `:id` means differs between the two routes, and that is worth saying
 * out loud.** On checkout it is the stay. On check in it is the BOOKING,
 * because a stay does not exist until someone walks through the door — this
 * command is what creates it, so there is no stay id to name yet.
 *
 * The alternative was `POST /ops/reservations/:id/checkin`, which reads better
 * and puts a stay command on the reservations resource. The route table in the
 * ADR names this path, so the path stays and the meaning is documented instead.
 *
 * A WALK IN has no booking at all, so it gets its own route rather than a
 * second meaning for `:id` (ADR-035). `POST /ops/stays/walk-in` is a literal
 * segment, and it is declared BEFORE `:id/checkin` below so Nest matches it as
 * a path rather than as a stay called "walk-in".
 */
@Controller({ path: 'ops/stays', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsStaysController {
  constructor(private readonly frontDesk: FrontDeskService) {}

  /**
   * Check a confirmed reservation in, into a named room.
   *
   * Both the reservation and the room are proved to belong to this workspace.
   * The room check is not decoration: without it, a caller could put their own
   * guest in a competitor's room and `WorkspaceGuard` would see nothing wrong,
   * because the workspace they named really is theirs.
   */
  /**
   * Every stay on the property, open and closed.
   *
   * **This route did not exist**, and its absence is what kept the stay
   * record page on fixtures: this controller could check a guest in and out
   * and never read one back (ADR-035, wave 2 follow-up).
   */
  @Get()
  list(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<OperatorStayList> {
    return this.frontDesk.listStays(workspace);
  }

  /**
   * Check a walk in in — somebody at the counter with no booking (ADR-035).
   *
   * **The desk had a button for this and no route behind it.** Check in names a
   * BOOKING in its path, so a person who never booked could not be checked in
   * at all.
   *
   * It carries `stay.checkin`, the same permission as an ordinary check in.
   * A walk in is not a lesser act — it puts a stranger in a room and opens a
   * bill — so it must not be reachable by somebody the desk would refuse for
   * the booked version of the same thing.
   *
   * Declared above `:id/checkin`, so `walk-in` is matched as a literal segment
   * rather than as a stay whose id happens to be that word.
   */
  @Post('walk-in')
  @RequirePermission('stay.checkin')
  walkIn(
    @Body(new ZodValidationPipe(WalkInRequest)) body: WalkInRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorStay> {
    return this.frontDesk.walkIn(workspace, body);
  }

  @Post(':id/checkin')
  @RequirePermission('stay.checkin')
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CheckInRequest)) body: CheckInRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorStay> {
    return this.frontDesk.checkIn(workspace, id, body);
  }

  /**
   * Close an open stay.
   *
   * Dirties the room in the same transaction. A checkout that did not is how
   * housekeeping walks past a room that needs them, and two separate calls mean
   * a dropped connection between them loses the second.
   */
  @Post(':id/checkout')
  @RequirePermission('stay.checkout')
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorStay> {
    return this.frontDesk.checkOut(workspace, id);
  }
}
