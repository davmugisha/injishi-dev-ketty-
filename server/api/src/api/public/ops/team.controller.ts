import type { OperatorTeamList, WorkspaceAccess } from '@injishi/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { TeamService } from '../../../modules/organization/application/team.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';

/**
 * The staff roster -> `GET /api/v1/ops/team` (ADR-035, wave 2 follow-up).
 *
 * **The read is gated on `team.manage`, and that is a decision rather than a
 * default.** Most reads in `/ops/*` need only the workspace, because a
 * receptionist has to see rooms and threads to do the job. This one is
 * different: it enumerates every colleague, their email address and the role
 * each one holds. That is a disclosure, and it belongs to the people who manage
 * the team — owner and manager — the same two who may change it.
 *
 * It follows the `folio.charge` precedent set on the bills read for the same
 * reason: some lists are not operational data, they are information about
 * people.
 *
 * NO WRITE ROUTE. Adding somebody is an invitation and an invitation is its own
 * flow with its own decisions; a bare "add member" that wrote an
 * `org_memberships` row would skip all of them. Recorded as owed rather than
 * half built.
 */
@Controller({ path: 'ops/team', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsTeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @RequirePermission('team.manage')
  list(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<OperatorTeamList> {
    return this.team.list(workspace);
  }
}
