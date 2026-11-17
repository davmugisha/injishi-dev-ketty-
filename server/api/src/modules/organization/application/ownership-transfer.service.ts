import { InvitableOrgRole, ORG_ROLE_LABEL, type OrgRole } from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { NO_OPEN_TRANSFER, STEP_UP_STALE_MESSAGE, transferExpiresAt } from '../domain/ownership-transfer';
import { OwnershipTransferMailer } from '../infrastructure/ownership-transfer.mailer';
import { OwnershipTransferRepository, TransferRefused, type TransferRow } from '../infrastructure/ownership-transfer.repository';

/** A request as the owner and the member asked see it. Never a token, never a code. */
export interface OwnershipTransferView {
  id: string;
  legalName: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  toEmail: string;
  previousOwnerRole: OrgRole;
  previousOwnerRoleLabel: string;
  expiresAt: string;
  requestedAt: string;
}

const view = (r: TransferRow): OwnershipTransferView => ({
  id: r.id,
  legalName: r.legalName,
  fromUserId: r.fromUserId,
  fromName: r.fromName,
  toUserId: r.toUserId,
  toName: r.toName,
  toEmail: r.toEmail,
  previousOwnerRole: r.previousOwnerRole,
  previousOwnerRoleLabel: ORG_ROLE_LABEL[r.previousOwnerRole],
  expiresAt: r.expiresAt.toISOString(),
  requestedAt: r.createdAt.toISOString(),
});

const stale = () => new ForbiddenException({ code: 'step_up_stale', message: STEP_UP_STALE_MESSAGE });

/**
 * Transfer ownership of a business (migration 0155).
 *
 * Who may do what, decided here and nowhere else:
 * - only the business's owner (their membership role, not a permission another role could be given) asks, sees and
 *   cancels the request, and only with a fresh email step-up to ask;
 * - the member asked must be active on the team, not already an owner, and identity-verified (`mayElevate`);
 * - only that member, signed in as themselves, accepts or declines; accepting needs a fresh email step-up and a
 *   verified identity at that moment; a request is decided once, and never after it expires.
 * The caller says whether the session's step-up is fresh; the API's own `verifiedWithin` answers it.
 */
@Injectable()
export class OwnershipTransferService {
  private readonly log = new Logger(OwnershipTransferService.name);

  constructor(
    private readonly transfers: OwnershipTransferRepository,
    private readonly mail: OwnershipTransferMailer,
  ) {}

  private owner(ws: ScopedWorkspace): string {
    if (!ws.orgId) throw new BadRequestException('Only a business has an owner.');
    if (ws.orgRole !== 'owner') throw new ForbiddenException('Only the owner of the business can transfer its ownership.');
    return ws.orgId;
  }

  /** The business's open request, and who could be asked (identity-verified active members), for its owner. */
  async current(ws: ScopedWorkspace): Promise<{
    transfer: OwnershipTransferView | null;
    eligible: { userId: string; name: string; roleLabel: string }[];
  }> {
    const orgId = this.owner(ws);
    const [row, eligible] = await Promise.all([this.transfers.openForOrg(orgId), this.transfers.eligible(orgId)]);
    return {
      transfer: row ? view(row) : null,
      eligible: eligible.map((m) => ({ userId: m.userId, name: m.name, roleLabel: ORG_ROLE_LABEL[m.orgRole] })),
    };
  }

  async request(
    ws: ScopedWorkspace,
    actorUserId: string,
    fresh: boolean,
    body: { toUserId: string; previousOwnerRole: string },
  ): Promise<{ transfer: OwnershipTransferView }> {
    const orgId = this.owner(ws);
    if (!fresh) throw stale();
    const role = InvitableOrgRole.safeParse(body.previousOwnerRole);
    if (!role.success) throw new UnprocessableEntityException('Choose the role you keep after the transfer.');
    if (body.toUserId === actorUserId) throw new UnprocessableEntityException('Choose another member of the team.');
    const member = await this.transfers.member(orgId, body.toUserId);
    if (!member || member.status !== 'active') {
      throw new UnprocessableEntityException('Ownership can only pass to an active member of this business.');
    }
    if (member.orgRole === 'owner') throw new UnprocessableEntityException(`${member.name} is already an owner.`);
    if (!member.verified) {
      throw new UnprocessableEntityException(
        `${member.name} has not verified their identity, so they cannot become the owner yet.`,
      );
    }
    let id: string;
    try {
      id = await this.transfers.create({
        orgId,
        fromUserId: actorUserId,
        toUserId: body.toUserId,
        previousOwnerRole: role.data,
        expiresAt: transferExpiresAt(new Date()),
      });
    } catch (error) {
      if (error instanceof TransferRefused && error.why === 'already_pending') {
        throw new ConflictException('A transfer is already waiting for an answer. Cancel it first to ask someone else.');
      }
      throw error;
    }
    const row = await this.transfers.openForOrg(orgId);
    if (!row || row.id !== id) throw new NotFoundException(NO_OPEN_TRANSFER);
    await this.mail.requested({
      orgId,
      to: row.toEmail,
      legalName: row.legalName,
      toName: row.toName,
      fromName: row.fromName,
      previousOwnerRoleLabel: ORG_ROLE_LABEL[row.previousOwnerRole],
      expiresAt: row.expiresAt,
    });
    this.log.log(`Ownership transfer ${id} requested on org ${orgId} by ${actorUserId}`);
    return { transfer: view(row) };
  }

  async cancel(ws: ScopedWorkspace, actorUserId: string, transferId: string): Promise<{ transfer: null }> {
    const orgId = this.owner(ws);
    if (!(await this.transfers.cancel({ orgId, transferId, actorUserId }))) throw new NotFoundException(NO_OPEN_TRANSFER);
    return { transfer: null };
  }

  /** The open requests that would make this person an owner (any business). */
  async inbox(userId: string): Promise<{ transfers: OwnershipTransferView[] }> {
    return { transfers: (await this.transfers.openForRecipient(userId)).map(view) };
  }

  async accept(userId: string, fresh: boolean, transferId: string): Promise<{ orgId: string; legalName: string }> {
    if (!fresh) throw stale();
    const before = (await this.transfers.openForRecipient(userId)).find((t) => t.id === transferId);
    try {
      const done = await this.transfers.accept({ transferId, userId });
      this.log.log(`Ownership transfer ${transferId} accepted: org ${done.orgId} now owned by ${userId}`);
      return { orgId: done.orgId, legalName: before?.legalName ?? '' };
    } catch (error) {
      if (error instanceof TransferRefused) {
        this.log.warn(`Ownership transfer ${transferId} refused for ${userId}: ${error.why}`);
        if (error.why === 'recipient_not_verified') {
          throw new ForbiddenException({
            code: 'identity_not_verified',
            message: 'Verify your identity first: scan your ID in your account, then accept again.',
          });
        }
        throw new NotFoundException(NO_OPEN_TRANSFER);
      }
      throw error;
    }
  }

  async decline(userId: string, transferId: string): Promise<{ declined: true }> {
    if (!(await this.transfers.decline({ transferId, userId }))) throw new NotFoundException(NO_OPEN_TRANSFER);
    return { declined: true };
  }
}
