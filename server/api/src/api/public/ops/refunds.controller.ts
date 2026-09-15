import type {
  StayRefundRequestList,
  StayRefundRequestView,
  StayRefundState,
  WorkspaceAccess,
} from '@injishi/contracts';
import { DecideStayRefundRequest, StayRefundState as StayRefundStateSchema } from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { StayRefundService } from '../../../modules/operations/application/stay-refund.service';
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
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Refund requests → `/api/v1/ops/refund-requests` (§6.8).
 *
 * ## Both routes carry `refund.decide`, including the READ
 *
 * That is a departure from this module's usual shape — the departments list and
 * the stays list carry no permission beyond holding the workspace, because a
 * receptionist needs them to do the job. This queue is different: every row is
 * a guest saying the property got something wrong, in their own words, with a
 * number attached. It is the material of a dispute, and the two roles that can
 * answer it are the two that should be reading it.
 *
 * A receptionist who needs to look at one is looking at it in order to decide
 * it, which is the thing this permission exists to keep off the front desk: a
 * discretionary spend of the business's money, argued in front of an unhappy
 * guest who is standing right there.
 *
 * ## One route decides, two ways
 *
 * Approving and refusing are the same decision by the same person at the same
 * moment. Two routes would let a queue accumulate requests somebody
 * half-answered, and the request body's discriminated union already refuses the
 * incoherent combinations: an approval carries an amount, a refusal carries a
 * reason, and neither can carry the other's field.
 */
@Controller({ path: 'ops/refund-requests', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRefundRequestsController {
  constructor(private readonly refunds: StayRefundService) {}

  /**
   * The queue. `?state=submitted` is what a desk opens it on; absent gives the
   * whole history, which is what a dispute three weeks later needs.
   */
  @Get()
  @RequirePermission('refund.decide')
  list(
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Query('state') state: string | undefined,
  ): Promise<StayRefundRequestList> {
    const states = parseStates(state);
    return this.refunds.listForWorkspace(workspace, states);
  }

  /**
   * Answer one.
   *
   * On an approval above zero the money is instructed BEFORE anything is
   * recorded, so a rail that does not confirm leaves the request open rather
   * than marking a guest refunded on money that never moved.
   */
  @Post(':id/decision')
  @RequirePermission('refund.decide')
  decide(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @Body(new ZodValidationPipe(DecideStayRefundRequest))
    body: DecideStayRefundRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<StayRefundRequestView> {
    return this.refunds.decide(workspace, requestId, body, user.id);
  }
}

/**
 * `?state=submitted,rejected` → the two states, or undefined for all of them.
 *
 * A value that is not a state is DROPPED rather than refused. This is a list
 * filter on a queue somebody is looking at, and a 400 over a typo in a query
 * string would blank the screen instead of showing the work; an empty result
 * from a filter nobody meant is the more useful failure. An all-unknown filter
 * therefore reads as "no filter", which is what the caller saw before they
 * typed it.
 */
function parseStates(raw: string | undefined): StayRefundState[] | undefined {
  if (!raw) return undefined;
  const states = raw
    .split(',')
    .map((part) => StayRefundStateSchema.safeParse(part.trim()))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  return states.length > 0 ? states : undefined;
}
