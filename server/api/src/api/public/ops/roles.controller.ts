import {
  type OperatorRoleList,
  type OperatorRolePermissions,
  SetRolePermissionsRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { RolePermissionsService } from '../../../modules/organization/application/role-permissions.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * What each staff role may do here -> `/api/v1/ops/roles` (ADR-055).
 *
 * **BOTH VERBS SIT BEHIND `team.manage`, AND THE READ IS THE INTERESTING ONE.**
 * Most reads under `/ops/*` need only the workspace, because a receptionist has
 * to see rooms and threads to do the job. This one is the business's access
 * policy: it says which colleague can read the takings and which cannot, and
 * that is a disclosure about people, not operational data. It follows the
 * precedent `/ops/team` set for the roster and the bills read set before it.
 *
 * `team.manage` is the owner's alone (`OWNER_ONLY` in the model), so a manager
 * is refused both verbs by `WorkspaceGuard`. That is not an accident of reuse:
 * whoever can change what a manager may do must not be the manager.
 *
 * A PUT rather than a POST command, and rather than a PATCH: the body is the
 * WHOLE set the role should hold, so the same request sent twice leaves the same
 * policy. A delta verb would have made the client the author of the diff, and a
 * client one release behind on the default set would then write a delta that
 * meant something else.
 */
@Controller({ path: 'ops/roles', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('account')
export class OpsRolesController {
  constructor(private readonly roles: RolePermissionsService) {}

  @Get()
  @RequirePermission('team.manage')
  list(
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorRoleList> {
    return this.roles.list(workspace);
  }

  /**
   * The role is a PATH parameter and not a body field, so an address names the
   * policy it changes and a log line says which role was edited.
   */
  @Put(':role')
  @RequirePermission('team.manage')
  set(
    @Param('role') role: string,
    @Body(new ZodValidationPipe(SetRolePermissionsRequest))
    body: SetRolePermissionsRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorRolePermissions> {
    return this.roles.set(workspace, role, body, user.id);
  }
}
