import {
  AssignRoomRequest,
  type OperatorReservation,
  type OperatorReservationList,
  OperatorReservationQuery,
  type OperatorRoomAssignment,
  type OperatorRoomAssignmentList,
  RoomAssignmentWindowQuery,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { OperatorReservationsService } from '../../../modules/booking/application/operator-reservations.service';
import { RoomAssignmentService } from '../../../modules/operations/application/room-assignment.service';
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
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The front desk's reservations → /api/v1/ops/reservations (ADR-012, D-k).
 *
 * This is the first operator command endpoint, and it is the shape every other
 * one copies. Three things make it the standard rather than just a route:
 *
 * 1. **A command is named for its action.** `POST :id/approve`, not
 *    `PATCH :id` with a status in the body. So one route maps to exactly one
 *    permission, and the guard never reads a body to learn what is being asked.
 * 2. **The class carries the guards, the handler carries the permission.**
 *    `@RequirePermission` sits on each command rather than on the class,
 *    because the reads below are open to several powers and a class-wide
 *    declaration would quietly demand every command's power of them.
 * 3. **The guard is not the whole check.** `WorkspaceGuard` proves the caller
 *    HOLDS the workspace they named; it never reads the row, so it cannot know
 *    whether `:id` belongs there. `OperatorReservationsService` proves that
 *    through `assertOwned`, and answers 404 rather than 403 (AC-3).
 *
 * A caller whose business is not `active` holds no permissions at all (D20), so
 * both commands are closed to them and the refusal names the registration stage
 * instead of the missing power (AC-2). The reads are closed to them too (audit
 * H1): the pipeline is rendered from `registrationStatus` on the grant, so
 * watching it needs no reservation list.
 *
 * `injishi/require-permission-on-guarded-route` fails the build if a command
 * here ever loses its `@RequirePermission` (AC-1).
 */
@Controller({ path: 'ops/reservations', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsReservationsController {
  constructor(
    private readonly reservations: OperatorReservationsService,
    private readonly assignments: RoomAssignmentService,
  ) {}

  /**
   * Every reservation on this desk.
   *
   * Anyone who works the desk: Reservations (`reservation.approve`), the
   * calendar grid (`reservation.assign`) and Today (`stay.checkin`). A
   * housekeeper holds none of them and is refused.
   *
   * And whoever reads the money (`money.view`, ADR-069 D-d): the accountant
   * opens Reservations to see bookings and what they are worth without taking
   * a desk write to get there. Only this read and the record below widen; the
   * room assignment reads stay the desk's, and every command on this
   * controller still declares its own write, so approve, decline, cancel and
   * assign stay closed to a grant that holds `money.view` alone.
   */
  @Get()
  @RequireAnyPermission('reservation.approve', 'reservation.assign', 'stay.checkin', 'money.view')
  async list(
    @Query(new ZodValidationPipe(OperatorReservationQuery))
    query: OperatorReservationQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorReservationList> {
    // The query is honoured now (review 4.3): a state narrows the desk, and
    // the read is windowed and capped either way (review 2.5).
    return { reservations: await this.reservations.list(workspace, query) };
  }

  /**
   * ONE reservation, by its own id.
   *
   * **The record page had no route and paid for it.** It resolved its booking
   * out of the desk list above, which is windowed to `DESK_WINDOW_DAYS` of
   * departures and capped at `DESK_LIMIT` rows — so a booking older than the
   * window rendered the app's "that page isn't here" refusal to the operator
   * who owns it. A window bounds a LIST; it must not decide whether a RECORD
   * exists.
   *
   * It carries the SAME permission set as the list above, deliberately. A
   * record read that was easier to reach than the list it came from would let
   * a housekeeper open by id exactly what the desk refuses to show them; and
   * one harder to reach would leave the accountant a list whose rows do not
   * open (ADR-069 D-d).
   */
  @Get(':id')
  @RequireAnyPermission('reservation.approve', 'reservation.assign', 'stay.checkin', 'money.view')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorReservation> {
    return this.reservations.get(workspace, id);
  }

  /**
   * Confirm a pending request. The escrow stays held; only the status moves.
   *
   * No body, by design (D-d). The URL says what is being asked and the
   * `x-workspace-id` header says where, so a command with nothing to send still
   * names its workspace.
   */
  @Post(':id/approve')
  @RequirePermission('reservation.approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorReservation> {
    return this.reservations.approve(workspace, id);
  }

  /**
   * Refuse a pending request. Refunds the escrow in full, in one transaction.
   *
   * Same permission as approve, because they are one decision with two answers:
   * anyone trusted to confirm a guest's booking is trusted to turn it down.
   */
  @Post(':id/decline')
  @RequirePermission('reservation.approve')
  decline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorReservation> {
    return this.reservations.decline(workspace, id);
  }

  /**
   * Every room this reservation holds (ADR-016 slice 4).
   *
   * A LIST rather than a single room, because a split stay is several holds on
   * one booking: 101 for two nights and 205 for the third. That requirement is
   * what ruled out a nullable `room_id` column on the booking, and it is why
   * the release below names the assignment rather than the reservation.
   */
  @Get(':id/assignments')
  @RequireAnyPermission('reservation.assign', 'reservation.approve', 'stay.checkin')
  async listAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRoomAssignmentList> {
    return {
      assignments: await this.assignments.listForBooking(workspace, id),
    };
  }

  /**
   * Hold a physical room for this reservation.
   *
   * The dates default to the booking's own. Two overlapping holds on one room
   * are refused by a database exclusion constraint rather than by a check here,
   * so a direct SQL insert is refused exactly as this route is.
   */
  @Post(':id/assign')
  @RequirePermission('reservation.assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AssignRoomRequest)) body: AssignRoomRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorRoomAssignment> {
    return this.assignments.assign(workspace, id, body, user.id);
  }

  /**
   * Let one held room go.
   *
   * Names the ASSIGNMENT, not the reservation, because a split stay has several
   * and "release the booking's room" would not say which leg.
   */
  @Delete(':id/assign/:assignmentId')
  @RequirePermission('reservation.assign')
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRoomAssignment> {
    return this.assignments.release(workspace, id, assignmentId);
  }
}

/**
 * Every room held across the property over a window
 * -> /api/v1/ops/room-assignments (the room grid's read).
 *
 * Its own path rather than a route on the reservations controller, because it
 * names no reservation: it answers "which rooms are held on these dates", and
 * `:id/assignments` above answers "which rooms does this one booking hold".
 *
 * Open to the desk that reads the grid (`reservation.assign`,
 * `reservation.approve`, `stay.checkin`). The commands that change a hold stay
 * behind `reservation.assign`.
 */
@Controller({ path: 'ops/room-assignments', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRoomAssignmentsController {
  constructor(private readonly assignments: RoomAssignmentService) {}

  @Get()
  @RequireAnyPermission('reservation.assign', 'reservation.approve', 'stay.checkin')
  async list(
    @Query(new ZodValidationPipe(RoomAssignmentWindowQuery))
    query: RoomAssignmentWindowQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRoomAssignmentList> {
    return {
      assignments: await this.assignments.listForWindow(workspace, query),
    };
  }
}
