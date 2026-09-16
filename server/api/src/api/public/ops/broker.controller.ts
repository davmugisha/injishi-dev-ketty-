import type {
  BrokerCredits,
  BrokerDirectory,
  BrokerEarnings,
  BrokerPlacement,
  BrokerPlacementList,
  BrokerReveal,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { BrokerService } from '../../../modules/operations/application/broker.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';

/**
 * The broker's own surface → /api/v1/ops/broker (ADR-038 child 6).
 *
 * In the `ops/*` family because a broker workspace is a workspace, and its
 * credits belong to it rather than to a person. NO route here declares a
 * permission, and that is deliberate: `permissionsForWorkspace` returns an
 * empty array for every workspace that is not kind `business`, so a broker
 * holds none and any declaration would refuse the one person the surface is
 * for. `BrokerService` refuses anything that is not an active broker's own
 * workspace, which is the whole check. All six handlers — the two commands and
 * the four reads — are named in the API's
 * `require-permission-on-guarded-route` allowlist, the reads because audit H1
 * extended that rule from mutations to every verb.
 */
@Controller({ path: 'ops/broker', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsBrokerController {
  constructor(private readonly broker: BrokerService) {}

  @Get('directory')
  directory(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerDirectory> {
    return this.broker.directory(workspace);
  }

  /** 200 whether or not it charged: a repeat returns the reveal already bought. */
  @Post('directory/:listingId/reveal')
  @HttpCode(200)
  reveal(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerReveal> {
    return this.broker.reveal(workspace, listingId);
  }

  @Post('directory/:listingId/placements')
  @HttpCode(200)
  startPlacement(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerPlacement> {
    return this.broker.startPlacement(workspace, listingId);
  }

  @Get('credits')
  credits(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerCredits> {
    return this.broker.credits(workspace);
  }

  @Get('placements')
  placements(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerPlacementList> {
    return this.broker.placements(workspace);
  }

  @Get('earnings')
  earnings(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerEarnings> {
    return this.broker.earnings(workspace);
  }
}
