import {
  CheckInRequest,
  CheckOutRequest,
  IssueStayClaimInviteRequest,
  type OperatorStay,
  type OperatorStayList,
  type StayClaimInvite,
  WalkInRequest,
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
import { StayClaimService } from '../../../modules/pms/application/stay-claim.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
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
  constructor(
    private readonly frontDesk: FrontDeskService,
    private readonly onboarding: StayClaimService,
  ) {}

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
   *
   * Names guests, so it is the desk's: Today, Reservations, the stay record, the
   * calendar and the command bar, all read by whoever checks guests in or out
   * or charges their bill.
   */
  @Get()
  @RequireAnyPermission('stay.checkin', 'stay.checkout', 'folio.charge')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<OperatorStayList> {
    return this.frontDesk.listStays(workspace);
  }

  /**
   * ONE stay, by its own id.
   *
   * The record screen resolved its stay out of the list above, so the whole
   * property had to be read to render one guest, and the screen's answer to
   * "does this stay exist" was "is it in that list" — a question a list is not
   * qualified to answer. A stay on another workspace, or on a branch outside
   * this scope, is a 404 here, the same answer an invented id gets.
   *
   * Same permission set as the list, so opening a record by id is never easier
   * than seeing it listed.
   *
   * `walk-in` below is a POST, so this GET cannot shadow it whatever the
   * declaration order, and `ParseUUIDPipe` would refuse that word besides.
   */
  @Get(':id')
  @RequireAnyPermission('stay.checkin', 'stay.checkout', 'folio.charge')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorStay> {
    return this.frontDesk.getStay(workspace, id);
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
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorStay> {
    return this.frontDesk.walkIn(workspace, body);
  }

  @Post(':id/checkin')
  @RequirePermission('stay.checkin')
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CheckInRequest)) body: CheckInRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorStay> {
    return this.frontDesk.checkIn(workspace, id, body);
  }

  /**
   * Close an open stay.
   *
   * Dirties the room in the same transaction. A checkout that did not is how
   * housekeeping walks past a room that needs them, and two separate calls mean
   * a dropped connection between them loses the second.
   *
   * Needs `folio.close` as well as `stay.checkout`, because check out is what
   * signs the stay's sale (ADR-050 D-t, AC-8).
   *
   * **IT TAKES A BODY NOW, AND IT ALWAYS SHOULD HAVE.** `CheckOutRequest` has
   * been declared in `@injishi/contracts` since this route was written, with a
   * `note` field, and this method took no `@Body` at all — so the contract
   * described a request nobody could send and nothing could store. A declared
   * field that is silently impossible is worse than an absent one: it reads to
   * the next person as already built.
   *
   * The body stays OPTIONAL, and `.default({})` is what makes that true rather
   * than a hope. `CheckOutRequest` is an object whose every field is optional,
   * and Zod still REFUSES `undefined` for the object itself — so validating the
   * bare schema would turn every existing bodyless `POST /checkout` into a 400,
   * including `scripts/verify-walk-in.mjs` and every desk on an older build.
   * The default is applied here, at the route, rather than in the contract,
   * because the contract describes what a client may send and this describes
   * what this handler does when a client sends nothing.
   */
  @Post(':id/checkout')
  @RequirePermission('stay.checkout', 'folio.close')
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CheckOutRequest.default({}))) body: CheckOutRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorStay> {
    return this.frontDesk.checkOut(workspace, id, body);
  }

  /**
   * The claim code on this stay's slip, and whether the guest has been mailed
   * it (§6.8).
   *
   * A READ, and it sends nothing. The desk needs the code to print at the
   * moment of check in, and a GET that mailed the guest every time somebody
   * opened the stay record would be a surprising side effect on a read — and
   * would spam a guest whose record the desk is simply looking at.
   *
   * `stay.checkin` rather than a permission of its own. The code is a key to
   * the stay, and whoever may create the stay may hand out its key; inventing a
   * twenty-ninth permission for the slip that comes out of the same act would
   * give a receptionist a check in they could not complete.
   */
  @Get(':id/claim-invite')
  @RequirePermission('stay.checkin')
  claimInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<StayClaimInvite> {
    return this.onboarding.currentInvite(workspace, id);
  }

  /**
   * Send it, or send it again.
   *
   * For the guest who gave their address after check in, the one who never got
   * the mail, and — with `reissue` — the one who lost the slip. A reissue mints
   * a fresh code and invalidates the printed one, which is why it is a flag the
   * desk sets deliberately rather than what every re-send does.
   *
   * The address is optional and, when absent, the one already on the stay
   * stands. What it can never do is redirect an invitation somewhere else and
   * leave: an address given here is RECORDED on the stay first, so the record
   * always says where this stay's code was sent.
   */
  @Post(':id/claim-invite')
  @RequirePermission('stay.checkin')
  sendClaimInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(IssueStayClaimInviteRequest))
    body: IssueStayClaimInviteRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<StayClaimInvite> {
    return this.onboarding.issueInvite(workspace, id, body);
  }
}
