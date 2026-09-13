import {
  type AcceptedStaffInvitation,
  type InviteStaffRequest,
  ORG_ROLE_LABEL,
  type OperatorStaffInvitation,
  type StaffInvitationPreview,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  newStaffInvitationToken,
  staffInvitationExpiresAt,
} from '../domain/staff-invitation';
import { StaffInvitationMailer } from '../infrastructure/staff-invitation.mailer';
import {
  StaffInvitationRefused,
  StaffInvitationRepository,
  type StaffInvitationRow,
} from '../infrastructure/staff-invitation.repository';

/**
 * Putting staff on a business: invite by email and role, accept by signing in.
 *
 * WHO MAY INVITE is `team.manage` on the route, which only an owner holds, and
 * only once the business is `active` (D20). WHAT THE INVITEE MAY DO is decided
 * by the role on the membership this writes, resolved by
 * `permissionsForWorkspace` like every other member's — the invitation carries
 * the role and nothing else.
 */
@Injectable()
export class StaffInvitationService {
  constructor(
    private readonly repo: StaffInvitationRepository,
    private readonly mailer: StaffInvitationMailer,
  ) {}

  async list(ws: WorkspaceAccess): Promise<OperatorStaffInvitation[]> {
    const orgId = this.orgOf(ws);
    const rows = await this.repo.listForOrg(orgId);
    return rows.map(present);
  }

  async invite(
    ws: WorkspaceAccess,
    actorUserId: string,
    body: InviteStaffRequest,
  ): Promise<OperatorStaffInvitation> {
    const orgId = this.orgOf(ws);
    const member = await this.repo.memberByEmail(orgId, body.email);
    if (member) {
      throw new ConflictException(
        `${body.email} already works here as ${ORG_ROLE_LABEL[member.orgRole]}.`,
      );
    }

    const token = newStaffInvitationToken();
    const expiresAt = staffInvitationExpiresAt(new Date());
    const id = await this.repo.issue({
      orgId,
      email: body.email,
      orgRole: body.orgRole,
      token,
      expiresAt,
      invitedByUserId: actorUserId,
    });

    // After the commit, and never throwing: a slow relay must not turn an
    // invitation that exists into a reported failure.
    await this.mailer.send({
      orgId,
      email: body.email,
      token,
      expiresAt,
      legalName: (await this.repo.legalName(orgId)) ?? 'this business',
      orgRole: body.orgRole,
      inviterName: await this.repo.displayName(actorUserId),
    });

    const created = (await this.repo.listForOrg(orgId)).find((r) => r.id === id);
    if (!created) throw new NotFoundException('Invitation not found.');
    return present(created);
  }

  async revoke(ws: WorkspaceAccess, invitationId: string): Promise<void> {
    const orgId = this.orgOf(ws);
    if (!(await this.repo.revoke(orgId, invitationId))) {
      throw new NotFoundException('No pending invitation with that id.');
    }
  }

  /** 404 for any token that is not live for this business: it names nothing. */
  async preview(orgId: string, token: string): Promise<StaffInvitationPreview> {
    const found = await this.repo.preview(orgId, token);
    if (!found) throw new NotFoundException('This invitation is not valid any more.');
    return found;
  }

  async accept(input: {
    orgId: string;
    token: string;
    userId: string;
    userEmail: string;
  }): Promise<AcceptedStaffInvitation> {
    try {
      const accepted = await this.repo.accept(input);
      return { orgId: input.orgId, ...accepted };
    } catch (error) {
      if (!(error instanceof StaffInvitationRefused)) throw error;
      switch (error.why) {
        case 'wrong_account':
          throw new ForbiddenException(
            'This invitation was sent to a different email address. Sign in with that address to accept it.',
          );
        case 'already_member':
          throw new ConflictException(
            `You already work at this business as ${
              error.existingRole ? ORG_ROLE_LABEL[error.existingRole] : 'a member'
            }.`,
          );
        default:
          throw new NotFoundException('This invitation is not valid any more.');
      }
    }
  }

  private orgOf(ws: WorkspaceAccess): string {
    if (!ws.orgId) {
      throw new BadRequestException('Only a business workspace has staff to invite.');
    }
    return ws.orgId;
  }
}

function present(row: StaffInvitationRow): OperatorStaffInvitation {
  const expired = row.status === 'sent' && row.expiresAt.getTime() <= Date.now();
  return {
    id: row.id,
    email: row.email,
    orgRole: row.orgRole,
    status: expired ? 'expired' : row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
