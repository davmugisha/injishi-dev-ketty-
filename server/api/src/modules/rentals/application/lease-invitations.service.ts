import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  INVITATION_RESEND_SECONDS,
  LEASE_INVITATION_DAYS,
  longDate,
  type AcceptLeaseInvitationRequest,
  type LeaseDetail,
  type LeaseInvitationPreview,
  type LeaseInvitationState,
  type ResendInvitationRequest,
  type TenancyDetail,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { maskEmail } from '../../../shared/identity/mask';
import { invitationMail } from '../domain/rentals-mail';
import { assertBuildingInScope, assertResidence, leaseStateConflict } from '../domain/residence';
import { newInvitationToken, sha256Hex } from '../domain/signing-secrets';
import { LeasesRepository, type LeaseRecord } from '../infrastructure/leases.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { LeaseEventsWriter, RentalsAuditWriter, type Tx } from '../infrastructure/rentals-writers';
import { RentalsMailer } from '../infrastructure/rentals.mailer';
import { SigningRepository, type InvitationRow } from '../infrastructure/signing.repository';
import { LeaseDraftingService } from './lease-drafting.service';
import { LeaseReadsService } from './lease-reads.service';
import { TenanciesService } from './tenancies.service';

const DAY_MS = 86_400_000;

/** A mail to send once the transaction that decided it has committed. */
export type PendingMail = () => Promise<void>;

/** The 404 every unknown or replaced link gets: it says nothing about whether a lease exists. */
const LINK_NOT_VALID = 'This invitation link is not valid. Open the newest email from your landlord.';

/**
 * The invitation to the tenant (blueprint 2.5, WP 1.5b).
 *
 * The landlord's signature sends it (`issue`, inside the signing
 * transaction): a link with a random token, good for 14 days, to the
 * tenant's email. The tenant opens it (`preview`, public), signs in with that
 * address, and accepts (`accept`), which links their account to the tenant
 * record; then they sign. A tenant whose account already holds the record (a
 * returning tenant) has nothing to accept: the lease is on their account the
 * moment it is sent, and the email takes them straight to it.
 *
 * Only the token's hash is kept. Sending again issues a fresh token, so the
 * link in an older email stops working.
 */
@Injectable()
export class LeaseInvitationsService {
  private readonly log = new Logger(LeaseInvitationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly leases: LeasesRepository,
    private readonly signing: SigningRepository,
    private readonly context: RentalsContextRepository,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
    private readonly reads: LeaseReadsService,
    private readonly drafting: LeaseDraftingService,
    private readonly tenancies: TenanciesService,
    private readonly mailer: RentalsMailer,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  /**
   * Send the lease to the tenant, as part of the landlord's signature. Inside
   * the signing transaction, with the lease locked; answers the mail to send
   * after it commits.
   */
  async issue(tx: Tx, record: LeaseRecord, actorUserId: string): Promise<PendingMail> {
    const { lease, tenant } = record;
    const now = this.now();
    const expiresAt = new Date(now.getTime() + LEASE_INVITATION_DAYS * DAY_MS);
    const live = await this.signing.liveInvitation(lease.id, tx);

    if (tenant.userId) {
      // A returning tenant: the record is already on their account.
      if (live) await this.revoke(tx, live.id);
      const accountEmail = (await this.signing.accountEmail(tenant.userId)) ?? (tenant.email as string);
      const invitationId = await this.signing.insertInvitation(tx, {
        leaseId: lease.id,
        tenantId: tenant.id,
        email: (tenant.email ?? accountEmail).toLowerCase(),
        tokenHash: newInvitationToken().tokenHash,
        status: 'accepted',
        sentAt: now,
        lastSentAt: now,
        expiresAt,
        acceptedAt: now,
        acceptedByUserId: tenant.userId,
      });
      await this.events.write(tx, {
        leaseId: lease.id,
        workspaceId: lease.workspaceId,
        kind: 'invitation_sent',
        actorUserId,
        actorRole: 'landlord',
        visibleToTenant: true,
        payload: { invitationId, onAccount: true },
      });
      return this.mailFor(record, accountEmail, null, expiresAt);
    }

    const email = (tenant.email ?? '').toLowerCase();
    const { token, tokenHash } = newInvitationToken();
    let invitationId: string;
    if (live && live.email === email && live.expiresAt > now) {
      await this.signing.refreshInvitation(tx, live.id, { tokenHash, expiresAt, email });
      invitationId = live.id;
    } else {
      if (live) await this.revoke(tx, live.id);
      invitationId = await this.signing.insertInvitation(tx, {
        leaseId: lease.id,
        tenantId: tenant.id,
        email,
        tokenHash,
        status: 'sent',
        sentAt: now,
        lastSentAt: now,
        expiresAt,
      });
    }
    await this.events.write(tx, {
      leaseId: lease.id,
      workspaceId: lease.workspaceId,
      kind: 'invitation_sent',
      actorUserId,
      actorRole: 'landlord',
      visibleToTenant: true,
      payload: { invitationId, expiresAt: expiresAt.toISOString() },
    });
    return this.mailFor(record, email, token, expiresAt);
  }

  /**
   * Email the invitation again (`POST /ops/leases/:id/invitation/resend`).
   *
   * A new `email` before the tenant accepted is an edit of the lease (the
   * contract names the address): it goes back to draft for the landlord to
   * sign again, and that signature sends it to the new address. Otherwise the
   * invitation goes again with a fresh link, at most once a minute; once the
   * tenant has accepted, the email reminds them to sign.
   */
  async resend(ws: ScopedWorkspace, userId: string, leaseId: string, body: ResendInvitationRequest): Promise<LeaseDetail> {
    const r = assertResidence(ws);
    const record = await this.leases.find(leaseId);
    if (!record || record.lease.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, record.lease.propertyId, 'Lease');
    const latest = await this.signing.latestInvitation(leaseId);

    if (body.email && body.email !== (record.tenant.email ?? '').toLowerCase()) {
      if (latest?.status === 'accepted' && record.lease.status === 'pending_signature') {
        throw new ConflictException({
          code: 'invitation_accepted',
          message: `${record.tenant.fullName} accepted the invitation already, so it can't go to another address.`,
        });
      }
      if (record.lease.status !== 'pending_signature' && record.lease.status !== 'draft') {
        throw leaseStateConflict(record.lease.status, "The tenant's email can no longer change on it.");
      }
      // The typo guard ran on the request; the edit voids the signature and returns the lease to draft.
      return this.drafting.edit(ws, userId, leaseId, { tenant: { email: body.email }, confirmEmail: true });
    }

    if (record.lease.status !== 'pending_signature') {
      throw leaseStateConflict(
        record.lease.status,
        record.lease.status === 'draft' ? 'Sign it first. Signing sends the invitation.' : 'There is no invitation to send again.',
      );
    }
    const now = this.now();
    if (latest && now.getTime() - latest.lastSentAt.getTime() < INVITATION_RESEND_SECONDS * 1000) {
      const wait = Math.ceil(INVITATION_RESEND_SECONDS - (now.getTime() - latest.lastSentAt.getTime()) / 1000);
      throw new HttpException(
        { code: 'invitation_wait', retryAfterSeconds: wait, message: `It was sent a moment ago. Try again in ${wait} seconds.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let mail: PendingMail | null = null;
    await this.db.transaction(async (tx) => {
      const row = await this.leases.lock(tx, leaseId);
      if (!row || row.status !== 'pending_signature') {
        throw new ConflictException('This lease changed while you were sending. Refresh and try again.');
      }
      const fresh = (await this.leases.find(leaseId, tx)) as LeaseRecord;
      const expiresAt = new Date(now.getTime() + LEASE_INVITATION_DAYS * DAY_MS);
      let invitationId: string;
      let sendCount: number;
      if (latest?.status === 'accepted') {
        // The tenant has the lease on their account: remind them to sign.
        await this.signing.touchInvitation(tx, latest.id);
        invitationId = latest.id;
        sendCount = latest.sendCount + 1;
        const to = (fresh.tenant.userId && (await this.signing.accountEmail(fresh.tenant.userId))) || latest.email;
        mail = this.mailFor(fresh, to, null, expiresAt);
      } else {
        const email = (fresh.tenant.email ?? '').toLowerCase();
        const { token, tokenHash } = newInvitationToken();
        const live = await this.signing.liveInvitation(leaseId, tx);
        if (live && live.email === email) {
          await this.signing.refreshInvitation(tx, live.id, { tokenHash, expiresAt, email });
          invitationId = live.id;
          sendCount = live.sendCount + 1;
        } else {
          if (live) await this.revoke(tx, live.id);
          invitationId = await this.signing.insertInvitation(tx, {
            leaseId,
            tenantId: fresh.tenant.id,
            email,
            tokenHash,
            status: 'sent',
            sentAt: now,
            lastSentAt: now,
            expiresAt,
          });
          sendCount = 1;
        }
        mail = this.mailFor(fresh, email, token, expiresAt);
      }
      await this.events.write(tx, {
        leaseId,
        workspaceId: r.workspaceId,
        kind: 'invitation_resent',
        actorUserId: userId,
        actorRole: 'landlord',
        visibleToTenant: true,
        payload: { invitationId, sendCount },
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'lease',
        subjectId: leaseId,
        eventType: 'lease.invitation_resent',
        diff: { invitationId, sendCount },
      });
    });
    const send = mail as PendingMail | null;
    if (send) void send();
    return this.reads.detail(ws, leaseId);
  }

  /**
   * What an invitation link shows before anyone signs in (`GET
   * /lease-invitations/:token`, public): the landlord, the home, the rent and
   * the start, and the address it went to, partly hidden. A link that was
   * replaced, or never existed, is the same 404.
   */
  async preview(token: string): Promise<LeaseInvitationPreview> {
    const inv = await this.signing.invitationByTokenHash(sha256Hex(token));
    const record = inv ? await this.leases.find(inv.leaseId) : null;
    if (!inv || !record) throw new NotFoundException(LINK_NOT_VALID);
    const [org, place] = await Promise.all([this.context.org(record.lease.orgId), this.context.buildingPlace(record.lease.propertyId)]);
    const state = this.stateOf(inv, record);
    return {
      state,
      message: this.stateWords(state, inv, org.legalName, record),
      invitedEmail: maskEmail(inv.email),
      landlordName: org.legalName,
      propertyName: record.propertyName,
      unitLabel: record.unitLabel,
      district: place?.district ?? null,
      monthlyRentRwf: record.lease.monthlyRentRwf,
      depositRwf: record.lease.depositRwf,
      startDate: record.lease.startDate,
      endDate: record.lease.endDate,
      expiresAt: inv.expiresAt.toISOString(),
    };
  }

  /**
   * Take the lease, signed in as the address it was sent to
   * (`POST /me/lease-invitations/accept`). The match is against the SESSION's
   * email, never an address in the request: signing in proved that mailbox.
   * The tenant record is linked to the account; accepting again from the same
   * account is answered like the first time.
   */
  async accept(user: { id: string; email: string }, body: AcceptLeaseInvitationRequest): Promise<TenancyDetail> {
    const me = user.email.trim().toLowerCase();
    const inv = body.token
      ? await this.signing.invitationByTokenHash(sha256Hex(body.token))
      : await this.signing.invitationById(body.invitationId as string);
    // By id, an invitation to someone else is not even confirmed to exist.
    if (!inv || (body.invitationId && inv.email !== me)) throw new NotFoundException(LINK_NOT_VALID);
    const record = await this.leases.find(inv.leaseId);
    if (!record) throw new NotFoundException(LINK_NOT_VALID);
    if (inv.email !== me) {
      throw new ForbiddenException({
        code: 'invitation_other_email',
        message: `This invitation was sent to ${maskEmail(inv.email)}. Sign in with that email to accept it.`,
      });
    }
    const org = await this.context.org(record.lease.orgId);

    if (inv.status === 'accepted') {
      if (inv.acceptedByUserId === user.id) return this.tenancies.detail(this.refFor(record, user.id));
      throw new ConflictException({ code: 'invitation_accepted', message: 'This invitation was accepted from another account.' });
    }
    const state = this.stateOf(inv, record);
    if (state !== 'open') {
      throw new ConflictException({ code: `invitation_${state}`, message: this.stateWords(state, inv, org.legalName, record) });
    }

    await this.db
      .transaction(async (tx) => {
        const locked = await this.signing.lockInvitation(tx, inv.id);
        if (!locked || locked.status !== 'sent') {
          throw new ConflictException('This invitation changed while you were accepting it. Open it again.');
        }
        const linked = await this.signing.linkTenant(tx, record.tenant.id, user.id);
        if (!linked) {
          throw new ConflictException({
            code: 'tenant_other_account',
            message: `${org.legalName} has this tenant linked to another account. Ask them to check the email on the lease.`,
          });
        }
        await this.signing.markAccepted(tx, inv.id, user.id);
        await this.signing.nameUserIfNameless(tx, user.id, record.tenant.fullName);
        await this.events.write(tx, {
          leaseId: record.lease.id,
          workspaceId: record.lease.workspaceId,
          kind: 'invitation_accepted',
          actorUserId: user.id,
          actorRole: 'tenant',
          visibleToTenant: true,
          payload: { invitationId: inv.id },
        });
        await this.audit.write(tx, {
          actorUserId: user.id,
          subjectType: 'tenant',
          subjectId: record.tenant.id,
          eventType: 'tenant.account_linked',
          diff: { leaseId: record.lease.id, invitationId: inv.id },
        });
      })
      .catch((cause: unknown) => {
        if (isUniqueViolation(cause, 'tenants_workspace_user_uk')) {
          throw new ConflictException({
            code: 'tenant_other_record',
            message: `Your account already holds another tenant record with ${org.legalName}. Ask them to draft this lease for that record.`,
          });
        }
        throw cause;
      });
    return this.tenancies.detail(this.refFor(record, user.id));
  }

  // --- Helpers --------------------------------------------------------------------

  private refFor(record: LeaseRecord, userId: string): { leaseId: string; tenantId: string; userId: string; workspaceId: string } {
    return { leaseId: record.lease.id, tenantId: record.tenant.id, userId, workspaceId: record.lease.workspaceId };
  }

  private async revoke(tx: Tx, invitationId: string): Promise<void> {
    await this.signing.revokeInvitation(tx, invitationId);
  }

  /** Where a link stands for whoever holds it. A cancelled lease's invitation was revoked with it. */
  private stateOf(inv: InvitationRow, record: LeaseRecord): LeaseInvitationState {
    if (inv.status === 'accepted') return 'accepted';
    if (inv.status === 'revoked' || record.lease.status === 'cancelled') return 'revoked';
    if (inv.status === 'expired' || inv.expiresAt <= this.now()) return 'expired';
    return 'open';
  }

  private stateWords(
    state: LeaseInvitationState,
    inv: InvitationRow,
    landlordName: string,
    record: LeaseRecord,
  ): string | null {
    switch (state) {
      case 'open':
        return null;
      case 'accepted':
        return `This invitation is already accepted. The lease is on the Injishi home of ${maskEmail(inv.email)}.`;
      case 'expired':
        return `This invitation expired on ${longDate(inv.expiresAt.toISOString().slice(0, 10))}. Ask ${landlordName} to send it again.`;
      case 'revoked':
        // A cancelled lease took its invitation with it; otherwise a newer link replaced this one.
        return record.lease.status === 'cancelled'
          ? `${landlordName} cancelled this lease. Nothing is owed on it.`
          : `This link was replaced by a newer one. Use the link in the latest email from ${landlordName}.`;
    }
  }

  /** The invitation email, worded now from the lease as it stands, sent when called. */
  private mailFor(record: LeaseRecord, to: string, token: string | null, expiresAt: Date): PendingMail {
    const { lease, tenant } = record;
    return async () => {
      try {
        const org = await this.context.org(lease.orgId);
        await this.mailer.send(
          `lease ${lease.id} invitation`,
          to,
          invitationMail({
            appUrl: this.mailer.appUrl,
            leaseId: lease.id,
            token,
            tenantName: tenant.fullName,
            landlordName: org.legalName,
            home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
            terms: {
              monthlyRentRwf: lease.monthlyRentRwf,
              depositRwf: lease.depositRwf,
              startDate: lease.startDate,
              endDate: lease.endDate,
            },
            expiresAt,
          }),
        );
      } catch (cause) {
        // The invitation stands and shows in the tenant's list; only the email is lost.
        this.log.error(`invitation email for lease ${lease.id} failed: ${String(cause)}`);
      }
    };
  }
}

interface PgError {
  code?: string;
  constraint?: string;
  cause?: PgError;
}

function isUniqueViolation(cause: unknown, constraint: string): boolean {
  let e = cause as PgError | undefined;
  while (e && typeof e === 'object') {
    if (e.code === '23505') return e.constraint === constraint;
    e = e.cause;
  }
  return false;
}
