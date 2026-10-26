import {
  type InvitableOrgRole,
  MEMBER_BRANCHES_REFUSAL,
  MEMBER_ROLE_REFUSAL,
  type OperatorTeamList,
  type OperatorTeamMember,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { TeamRepository, type TeamMemberRow } from '../infrastructure/team.repository';

/**
 * The staff roster (ADR-035, wave 2 follow-up).
 *
 * **The gap this closes was the largest wave 2 found.** Nothing on the API
 * answered "who works at this business": `org_memberships` holds the answer and
 * no controller read it for anybody but the caller. The operator app's Team
 * screen therefore showed a fixture, and an owner would have believed those
 * invented people were their staff.
 *
 * WHY THE ROLE TRAVELS WITH THE NAME. `orgRole` is the field
 * `permissionsForWorkspace` resolves every refusal from, so this list is the one
 * place an owner can see WHY their receptionist cannot open Finance. A roster
 * without it would be an address book.
 *
 * ADDING SOMEBODY IS STILL NOT HERE. Adding somebody to a business is an
 * invitation (`StaffInvitationService`), with its own decisions about delivery
 * and acceptance, and a bare "add member" would skip all of that. The two
 * writes here act on an EXISTING member: narrowing them to some branches
 * (ADR-054 AC-T1), which changes which rows they see, and moving them to
 * another staff role, which changes what they may do. Neither decides whether
 * they work here (removal is offboarding, in People), and neither can make or
 * unmake an owner.
 */
@Injectable()
export class TeamService {
  constructor(private readonly team: TeamRepository) {}

  async list(ws: WorkspaceAccess): Promise<OperatorTeamList> {
    const rows = await this.team.listForWorkspace(ws.workspaceId);
    return { members: rows.map(present) };
  }

  /**
   * `PUT /ops/team/:userId/branches`. The route already refused a limited
   * caller (AC-M6); this refuses the AC-T1 cases with 422 and an unknown or
   * removed member with 404.
   */
  async setBranches(
    ws: WorkspaceAccess,
    userId: string,
    branchIds: readonly string[] | null,
    actorUserId: string,
  ): Promise<OperatorTeamMember> {
    if (!ws.orgId) {
      throw new BadRequestException('Only a business workspace has staff.');
    }
    const refusal = memberBranchesShapeRefusal(ws, branchIds);
    if (refusal) throw new UnprocessableEntityException(refusal);

    const result = await this.team.setMemberBranches({
      orgId: ws.orgId,
      userId,
      branchIds: branchIds ? [...new Set(branchIds)] : null,
      actorUserId,
    });
    switch (result.kind) {
      case 'missing':
        throw new NotFoundException('No such member.');
      case 'owner':
      case 'foreign':
      case 'archived':
        throw new UnprocessableEntityException(MEMBER_BRANCHES_REFUSAL[result.kind]);
      case 'done':
        break;
    }

    const member = (await this.team.listForWorkspace(ws.workspaceId)).find(
      (m) => m.userId === userId,
    );
    if (!member) throw new NotFoundException('No such member.');
    return present(member);
  }

  /**
   * `PATCH /ops/team/:userId/role`. What a member may do follows from the role
   * on their membership, resolved on their next request by
   * `permissionsForWorkspace` (and this business's ADR-055 overrides), so the
   * change needs no session work: it applies the moment it commits. Audited in
   * the same transaction as `team.member_role_changed`.
   */
  async changeRole(
    ws: WorkspaceAccess,
    userId: string,
    orgRole: InvitableOrgRole,
    actorUserId: string,
  ): Promise<OperatorTeamMember> {
    if (!ws.orgId) {
      throw new BadRequestException('Only a business workspace has staff.');
    }
    const result = await this.team.setMemberRole({
      orgId: ws.orgId,
      userId,
      orgRole,
      actorUserId,
    });
    switch (result.kind) {
      case 'missing':
        throw new NotFoundException('No such member.');
      case 'owner':
      case 'same':
        throw new UnprocessableEntityException(MEMBER_ROLE_REFUSAL[result.kind]);
      case 'done':
        break;
    }
    const member = (await this.team.listForWorkspace(ws.workspaceId)).find(
      (m) => m.userId === userId,
    );
    if (!member) throw new NotFoundException('No such member.');
    return present(member);
  }
}

/**
 * The AC-T1 refusals a request carries on its face: a residence business, or
 * a list with nothing in it. Shared with the invitation, which takes the same
 * list. Whether each id is a live branch of this org is asked of the database.
 */
export function memberBranchesShapeRefusal(
  ws: Pick<WorkspaceAccess, 'domain'>,
  branchIds: readonly string[] | null,
): string | null {
  if (branchIds === null) return null;
  if (ws.domain !== 'hospitality') return MEMBER_BRANCHES_REFUSAL.residence;
  if (branchIds.length === 0) return MEMBER_BRANCHES_REFUSAL.empty;
  return null;
}

function present(row: TeamMemberRow): OperatorTeamMember {
  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    orgRole: row.orgRole,
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
    branchIds: row.branchIds,
    lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    removedAt: row.removedAt?.toISOString() ?? null,
    identityVerified: row.identityVerified,
  };
}
