import { type FrontDeskBoard, FrontDeskBoardQuery } from '@injishi/contracts';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { FrontDeskBoardService } from '../../../modules/operations/application/front-desk-board.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The front desk's day → `GET /api/v1/ops/front-desk` (interface real-data).
 *
 * One read for every desk screen: arrivals, guests in house, departures, the
 * rooms and what is left to sell tonight, for one property and one Kigali day
 * decided by the server. It names guests, so it carries exactly the read set of
 * the reservations list it summarises: whoever works the desk
 * (`reservation.approve`, `reservation.assign`, `stay.checkin`,
 * `stay.checkout`) and whoever reads the money (`money.view`). A housekeeper
 * holds none of them and is refused.
 *
 * Bill balances inside it are the bill's own business: present only to a
 * caller holding `folio.charge` or `money.view`, null for anyone else.
 */
@Controller({ path: 'ops/front-desk', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsFrontDeskController {
  constructor(private readonly board: FrontDeskBoardService) {}

  @Get()
  @RequireAnyPermission('reservation.approve', 'reservation.assign', 'stay.checkin', 'stay.checkout', 'money.view')
  read(
    @Query(new ZodValidationPipe(FrontDeskBoardQuery)) query: FrontDeskBoardQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<FrontDeskBoard> {
    return this.board.board(workspace, query);
  }
}
