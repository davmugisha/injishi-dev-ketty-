import {
  type AccessRoleOption,
  accessNeedsOwner,
  type EmployeeAccess,
  type EmployeeAccessOptions,
  type GrantEmployeeAccessRequest,
  type GrantEmployeeAccessResponse,
  InvitableOrgRole,
  MEMBER_BRANCHES_REFUSAL,
  ORG_ROLE_LABEL,
  ORG_ROLE_SUMMARY,
  PERMISSION_AREA,
  PERMISSION_AREA_LABEL,
  PERMISSION_AREA_OF,
  PERMISSION_LABEL,
  type Permission,
  STAFF_ACCESS_REFUSAL,
  type StaffAccessRequest,
  type StaffAccessRequestList,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import {
  type AccessFile,
  type AccessRequestRow,
  StaffAccessRepository,
} from '../infrastructure/staff-access.repository';
import { StaffInvitationRepository } from '../infrastructure/staff-invitation.repository';
import { RolePermissionsService } from './role-permissions.service';
import { StaffInvitationService } from './staff-invitation.service';
import { memberBranchesShapeRefusal, TeamService } from './team.service';

/**
 * A staff file's Injishi login, given while putting the person on file (HR onboarding).
 *
 * WHO MAY GIVE ONE is decided on the route: `people.manage` (it is somebody's file) and
 * `team.invite` or `team.manage`. WHAT HAPPENS depends on the role asked for and on the caller:
 *
 * - the owner (`team.manage`) gives any staff role at once, as the Team screen does;
 * - with `team.invite` alone, a role that holds nothing of `OWNER_APPROVED_ACCESS` at this
 *   business (the front desk, housekeeping) goes out at once, and any other is a REQUEST the
 *   owner approves before an invitation exists. HR never re-roles or removes anybody: a file that
 *   already has a login is refused, and its role is changed on Team by the owner;
 * - a caller limited to some branches gives logins for those branches only.
 *
 * The invitation itself is the Team screen's (`StaffInvitationService.invite`): one address, one
 * live link, the same mail. What this adds is the file: the request row names it, and accepting
 * the invitation links the account to that file instead of writing a second one.
 */
@Injectable()
export class StaffAccessService {
  constructor(
    private readonly repo: StaffAccessRepository,
    private readonly invitationRows: StaffInvitationRepository,
    private readonly invitations: StaffInvitationService,
    private readonly roles: RolePermissionsService,
    private readonly team: TeamService,
  ) {}

  /** The roles, branches and rights a login may be given with, before there is a file. */
  async options(ws: ScopedWorkspace): Promise<EmployeeAccessOptions> {
    this.orgOf(ws);
    const managesTeam = this.managesTeam(ws);
    const { roles } = await this.roles.list(ws);
    return {
      roles: roles.flatMap((role) => {
        const parsed = InvitableOrgRole.safeParse(role.orgRole);
        if (!parsed.success) return [];
        return [
          {
            orgRole: parsed.data,
            label: ORG_ROLE_LABEL[parsed.data],
            summary: ORG_ROLE_SUMMARY[parsed.data],
            areas: byArea(role.permissions),
            needsOwner: !managesTeam && accessNeedsOwner(role.permissions),
          },
        ];
      }),
      branches: ws.branches.map((b) => ({ id: b.id, name: b.name })),
      canGrant: managesTeam || ws.permissions.includes('team.invite'),
      grantsEveryRole: managesTeam,
    };
  }

  /** Where one file's login stands, and the roles that may be given. */
  async read(ws: ScopedWorkspace, employeeId: string): Promise<EmployeeAccess> {
    const orgId = this.orgOf(ws);
    const file = await this.fileOf(ws, orgId, employeeId);
    return this.present(ws, orgId, file);
  }

  /** Give the file a login, or ask the owner for one. */
  async grant(
    ws: ScopedWorkspace,
    actorUserId: string,
    employeeId: string,
    body: GrantEmployeeAccessRequest,
  ): Promise<GrantEmployeeAccessResponse> {
    const orgId = this.orgOf(ws);
    const file = await this.fileOf(ws, orgId, employeeId);
    if (file.status !== 'active') throw new ConflictException(STAFF_ACCESS_REFUSAL.offboarded);
    if (file.memberUserId) throw new ConflictException(STAFF_ACCESS_REFUSAL.hasLogin);
    const latest = await this.repo.latestFor(orgId, file.id);
    if (latest?.status === 'pending') throw new ConflictException(STAFF_ACCESS_REFUSAL.pending);

    const branchIds = body.branchIds ? [...new Set(body.branchIds)] : null;
    await this.refuseBranches(ws, orgId, branchIds);

    const permissions = await this.rolePermissions(ws, body.orgRole);
    const ownerDecides = !this.managesTeam(ws) && accessNeedsOwner(permissions);
    await this.repo.fillFileEmail(file.id, body.email);

    if (ownerDecides) {
      await this.repo.insert({
        orgId,
        employeeId: file.id,
        email: body.email,
        orgRole: body.orgRole,
        branchIds,
        note: body.note?.trim() || null,
        requestedByUserId: actorUserId,
        invitationId: null,
      });
      return { outcome: 'requested', access: await this.present(ws, orgId, file) };
    }

    const invitation = await this.invitations.invite(ws, actorUserId, {
      name: file.name,
      email: body.email,
      orgRole: body.orgRole,
      branchIds,
    });
    await this.repo.insert({
      orgId,
      employeeId: file.id,
      email: body.email,
      orgRole: body.orgRole,
      branchIds,
      note: body.note?.trim() || null,
      requestedByUserId: actorUserId,
      invitationId: invitation.id,
    });
    return { outcome: 'invited', access: await this.present(ws, orgId, file) };
  }

  /**
   * Take back what is still open for the file: a request waiting for the owner, or else the live
   * invitation sent for it. A login already accepted is the owner's to remove, on Team.
   */
  async cancel(ws: ScopedWorkspace, actorUserId: string, employeeId: string): Promise<EmployeeAccess> {
    const orgId = this.orgOf(ws);
    const file = await this.fileOf(ws, orgId, employeeId);
    const latest = await this.repo.latestFor(orgId, file.id);
    if (latest?.status === 'pending') {
      await this.repo.decide({
        orgId,
        id: latest.id,
        status: 'cancelled',
        actorUserId,
        decisionNote: null,
        invitationId: null,
      });
      return this.present(ws, orgId, file);
    }
    const live = await this.repo.liveInvitationFor(orgId, file.id, file.email);
    if (!live) throw new NotFoundException('There is no invitation or request open for this person.');
    await this.invitations.revoke(ws, live.id);
    return this.present(ws, orgId, file);
  }

  /** The owner's list: requests waiting for them, then the last month's. */
  async list(ws: WorkspaceAccess): Promise<StaffAccessRequestList> {
    const orgId = this.orgOf(ws);
    return { requests: (await this.repo.listForOrg(orgId)).map(presentRequest) };
  }

  /** The owner approves: the invitation goes out now, in the requester's words for the person. */
  async approve(ws: ScopedWorkspace, actorUserId: string, requestId: string): Promise<StaffAccessRequest> {
    const orgId = this.orgOf(ws);
    const request = await this.pendingRequest(orgId, requestId);
    const file = await this.fileOf(ws, orgId, request.employeeId);
    if (file.status !== 'active') throw new ConflictException(STAFF_ACCESS_REFUSAL.offboarded);
    if (file.memberUserId) throw new ConflictException(STAFF_ACCESS_REFUSAL.hasLogin);
    const parsedRole = InvitableOrgRole.safeParse(request.orgRole);
    if (!parsedRole.success) throw new UnprocessableEntityException('An owner login is not given this way.');

    const invitation = await this.invitations.invite(ws, actorUserId, {
      name: file.name,
      email: request.email,
      orgRole: parsedRole.data,
      branchIds: request.branchIds,
    });
    const decided = await this.repo.decide({
      orgId,
      id: request.id,
      status: 'approved',
      actorUserId,
      decisionNote: null,
      invitationId: invitation.id,
    });
    if (!decided) {
      // Decided by somebody else between the read and now: take back the link just sent.
      await this.invitations.revoke(ws, invitation.id);
      throw new ConflictException(STAFF_ACCESS_REFUSAL.notPending);
    }
    return presentRequest(await this.requestOf(orgId, request.id));
  }

  /** The owner declines, saying why; HR reads it on the file. */
  async decline(
    ws: WorkspaceAccess,
    actorUserId: string,
    requestId: string,
    note: string,
  ): Promise<StaffAccessRequest> {
    const orgId = this.orgOf(ws);
    const request = await this.pendingRequest(orgId, requestId);
    const decided = await this.repo.decide({
      orgId,
      id: request.id,
      status: 'declined',
      actorUserId,
      decisionNote: note.trim(),
      invitationId: null,
    });
    if (!decided) throw new ConflictException(STAFF_ACCESS_REFUSAL.notPending);
    return presentRequest(await this.requestOf(orgId, request.id));
  }

  // ── Reads ───────────────────────────────────────────────────────────────────────────────────────

  private async present(ws: ScopedWorkspace, orgId: string, file: AccessFile): Promise<EmployeeAccess> {
    const [options, latest, live, team] = await Promise.all([
      this.options(ws),
      this.repo.latestFor(orgId, file.id),
      this.repo.liveInvitationFor(orgId, file.id, file.email),
      file.memberUserId ? this.team.list(ws) : Promise.resolve(null),
    ]);
    const member = file.memberUserId
      ? (team?.members.find((m) => m.userId === file.memberUserId) ?? null)
      : null;
    const state: EmployeeAccess['state'] = member
      ? 'active'
      : live
        ? 'invited'
        : latest?.status === 'pending'
          ? 'awaiting_owner'
          : 'none';
    return {
      ...options,
      employeeId: file.id,
      state,
      member: member
        ? {
            email: member.email,
            orgRole: member.orgRole,
            branchIds: member.branchIds,
            lastActiveAt: member.lastActiveAt,
          }
        : null,
      invitation: live
        ? {
            id: live.id,
            email: live.email,
            orgRole: live.orgRole,
            branchIds: live.branchIds,
            sentAt: live.sentAt.toISOString(),
            expiresAt: live.expiresAt.toISOString(),
          }
        : null,
      request: latest ? presentRequest(latest) : null,
    };
  }

  /** The role's permissions at THIS business: the defaults with the owner's changes. */
  private async rolePermissions(ws: WorkspaceAccess, orgRole: InvitableOrgRole): Promise<Permission[]> {
    const { roles } = await this.roles.list(ws);
    const role = roles.find((r) => r.orgRole === orgRole);
    if (!role) throw new UnprocessableEntityException('That role is not offered here.');
    return role.permissions;
  }

  /**
   * The branches a login names: the Team screen's shape and ownership rules, and for a caller
   * limited to some branches, only theirs (they cannot hand out a branch they do not cover).
   */
  private async refuseBranches(
    ws: ScopedWorkspace,
    orgId: string,
    branchIds: readonly string[] | null,
  ): Promise<void> {
    const shape = memberBranchesShapeRefusal(ws, branchIds);
    if (shape) throw new UnprocessableEntityException(shape);
    if (branchIds) {
      const refusal = await this.invitationRows.branchRefusal(orgId, branchIds);
      if (refusal) throw new UnprocessableEntityException(MEMBER_BRANCHES_REFUSAL[refusal]);
    }
    if (ws.branchScope.coverage === 'limited') {
      const covered = new Set(ws.branchScope.propertyIds);
      if (!branchIds || branchIds.some((id) => !covered.has(id))) {
        throw new ForbiddenException(STAFF_ACCESS_REFUSAL.branches);
      }
    }
  }

  private managesTeam(ws: WorkspaceAccess): boolean {
    return ws.permissions.includes('team.manage');
  }

  /** The file, as the caller may see it: one outside a limited caller's branches answers 404 (AC-PF15). */
  private async fileOf(ws: ScopedWorkspace, orgId: string, employeeId: string): Promise<AccessFile> {
    const file = await this.repo.file(orgId, employeeId);
    if (!file) throw new NotFoundException('No staff file with that id here.');
    const scope = ws.branchScope;
    const hidden =
      scope.coverage === 'limited' &&
      (file.workPropertyId === null
        ? !scope.includesUnbranched
        : !scope.propertyIds.includes(file.workPropertyId));
    if (hidden) throw new NotFoundException('No staff file with that id here.');
    return file;
  }

  private async pendingRequest(orgId: string, id: string): Promise<AccessRequestRow> {
    const request = await this.requestOf(orgId, id);
    if (request.status !== 'pending') throw new ConflictException(STAFF_ACCESS_REFUSAL.notPending);
    return request;
  }

  private async requestOf(orgId: string, id: string): Promise<AccessRequestRow> {
    const request = await this.repo.byId(orgId, id);
    if (!request) throw new NotFoundException('No access request with that id here.');
    return request;
  }

  private orgOf(ws: WorkspaceAccess): string {
    if (!ws.orgId) throw new BadRequestException('Only a business workspace has staff to give logins to.');
    return ws.orgId;
  }
}

/** A role's permissions grouped the way the Roles screen groups them, empty areas left out. */
function byArea(permissions: readonly Permission[]): AccessRoleOption['areas'] {
  return PERMISSION_AREA.options.flatMap((area) => {
    const held = permissions.filter((p) => PERMISSION_AREA_OF[p] === area);
    return held.length === 0
      ? []
      : [
          {
            area,
            label: PERMISSION_AREA_LABEL[area],
            permissions: held.map((permission) => ({ permission, label: PERMISSION_LABEL[permission] })),
          },
        ];
  });
}

function presentRequest(row: AccessRequestRow): StaffAccessRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employeeNumber: row.employeeNumber,
    jobTitle: row.jobTitle,
    email: row.email,
    orgRole: row.orgRole,
    branchIds: row.branchIds,
    status: row.status,
    note: row.note,
    requestedAt: row.requestedAt.toISOString(),
    requestedByName: row.requestedByName,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedByName: row.decidedByName,
    decisionNote: row.decisionNote,
  };
}
