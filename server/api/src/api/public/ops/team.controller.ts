import {
  ChangeMemberRoleRequest,
  DeclineStaffAccessRequest,
  InviteStaffRequest,
  SetMemberBranchesRequest,
  type OperatorStaffInvitation,
  type OperatorStaffInvitationList,
  type OperatorTeamList,
  type OperatorTeamMember,
  type StaffAccessRequest,
  type StaffAccessRequestList,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { StaffAccessService } from '../../../modules/organization/application/staff-access.service';
import { StaffInvitationService } from '../../../modules/organization/application/staff-invitation.service';
import { TeamService } from '../../../modules/organization/application/team.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireEveryBranch,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

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
 * Adding somebody is an INVITATION, never a bare membership write: the owner
 * names an address and a role, the mail carries a single use link, and the
 * membership is written only when that address signs in and accepts
 * (`/api/v1/orgs/:orgId/staff-invitation`). Every route here sits behind
 * `team.manage`, so none of it opens before the business is approved (D20).
 */
@Controller({ path: 'ops/team', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('account')
export class OpsTeamController {
  constructor(
    private readonly team: TeamService,
    private readonly invitations: StaffInvitationService,
    private readonly access: StaffAccessService,
  ) {}

  @Get()
  @RequirePermission('team.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<OperatorTeamList> {
    return this.team.list(workspace);
  }

  /** Every staff invitation this business has sent, newest first. */
  @Get('invitations')
  @RequirePermission('team.manage')
  async listInvitations(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorStaffInvitationList> {
    return { invitations: await this.invitations.list(workspace) };
  }

  /**
   * Logins HR asked for while putting people on file (HR onboarding): those waiting for the
   * owner first, then the last month's decisions. Before `:userId` routes, as a literal segment.
   */
  @Get('access-requests')
  @RequirePermission('team.manage')
  listAccessRequests(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<StaffAccessRequestList> {
    return this.access.list(workspace);
  }

  /** Approve a login HR asked for: its invitation is sent now. */
  @Post('access-requests/:id/approve')
  @HttpCode(200)
  @RequirePermission('team.manage')
  @RequireEveryBranch()
  approveAccessRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<StaffAccessRequest> {
    return this.access.approve(workspace, user.id, id);
  }

  /** Decline a login HR asked for, saying why; HR reads it on the person's file. */
  @Post('access-requests/:id/decline')
  @HttpCode(200)
  @RequirePermission('team.manage')
  @RequireEveryBranch()
  declineAccessRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DeclineStaffAccessRequest)) body: DeclineStaffAccessRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<StaffAccessRequest> {
    return this.access.decline(workspace, user.id, id, body.note);
  }

  /**
   * Limit a member to some branches, or give them every branch again
   * (ADR-054 AC-T1). An org wide write, so a limited caller is refused (AC-M6).
   */
  @Put(':userId/branches')
  @RequirePermission('team.manage')
  @RequireEveryBranch()
  setBranches(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(SetMemberBranchesRequest)) body: SetMemberBranchesRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorTeamMember> {
    return this.team.setBranches(workspace, userId, body.branchIds, user.id);
  }

  /**
   * Move a member to another staff role. `team.manage` only, which is the
   * owner's alone and can never be granted, and an org wide write, so a member
   * limited to some branches is refused (AC-M6). Neither direction can touch
   * `owner`: the body cannot name it and the service refuses a member who
   * holds it. Audited as `team.member_role_changed`.
   */
  @Patch(':userId/role')
  @RequirePermission('team.manage')
  @RequireEveryBranch()
  changeRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(ChangeMemberRoleRequest)) body: ChangeMemberRoleRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorTeamMember> {
    return this.team.changeRole(workspace, userId, body.orgRole, user.id);
  }

  /** Invite somebody by email into a role. Mails them a single use link. */
  @Post('invitations')
  @RequirePermission('team.manage')
  @RequireEveryBranch()
  invite(
    @Body(new ZodValidationPipe(InviteStaffRequest)) body: InviteStaffRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorStaffInvitation> {
    return this.invitations.invite(workspace, user.id, body);
  }

  /** Withdraw an invitation nobody has accepted yet. */
  @Post('invitations/:id/revoke')
  @HttpCode(204)
  @RequirePermission('team.manage')
  @RequireEveryBranch()
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<void> {
    await this.invitations.revoke(workspace, id);
  }
}
