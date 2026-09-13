import {
  AdminOrgStatusChange,
  AdminTinRecheckResult,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { auditEvents } from '../../../database/drizzle/governance';
import { orgs, tinVerifications } from '../../../database/drizzle/org';
import { RegistrationService } from '../../../modules/organization/application/registration.service';
import { recordRegistrationEvent } from '../../../modules/organization/infrastructure/registration-events';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { ADMIN_ORG_TRANSITIONS, type AdminOrgMove } from './org-transitions';

/**
 * The businesses a staffer can change, as opposed to read: suspend, reinstate,
 * and retry a TIN check.
 *
 * A SEPARATE SERVICE FROM `AdminOrgsService` on purpose. That one is a reader
 * with thirteen routes behind it and never writes; keeping the writes apart
 * means the audit obligation below lives in one small file a reviewer can hold
 * in their head, rather than being one method among fourteen.
 *
 * THE RULE EVERY METHOD HERE KEEPS: one successful write, one `audit_events`
 * row, naming the actor, the subject, the event, the staffer's written reason
 * and what moved. A suspension nobody can explain afterwards is the failure the
 * audit trail exists to prevent, so the reason is required by the contract
 * before a request reaches this file, and never defaulted here.
 */
@Injectable()
export class AdminOrgActionsService {
  private readonly log = new Logger(AdminOrgActionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly registration: RegistrationService,
  ) {}

  /**
   * Suspend or reinstate a business, and record it, in ONE transaction.
   *
   * The change and its audit row are one act. A status that moved with no row
   * behind it is a suspension nobody can explain; a row describing a move that
   * rolled back is a trail that lies. So both statements run on `tx`, and a
   * failure of either — including the response parse — undoes both.
   *
   * WHAT SUSPENSION DOES, and why it needs no second write: the permission
   * model (`permissionsForWorkspace` in `@injishi/contracts`) grants an org's
   * members nothing unless it is `active`, and `WorkspaceGuard` reads
   * `registration_status` on every operator request. Moving the column is what
   * halts the business; there is no separate switch to forget to flip.
   */
  async move(
    orgId: string,
    move: AdminOrgMove,
    actorUserId: string,
    reason: string,
  ): Promise<AdminOrgStatusChange> {
    const edge = ADMIN_ORG_TRANSITIONS[move];

    return this.db.transaction(async (tx) => {
      // The `from` in the WHERE clause is the legality check AND the
      // concurrency control: of two staffers acting at once, exactly one row
      // moves, and the other falls through to the 409 below.
      const [moved] = await tx
        .update(orgs)
        .set({ registrationStatus: edge.to, updatedAt: new Date() })
        .where(and(eq(orgs.id, orgId), eq(orgs.registrationStatus, edge.from)))
        .returning({ districtId: orgs.districtId });

      if (!moved) {
        // Nothing moved. Read the row only now, to tell "no such business"
        // from "it is not where this move starts" — the two need different
        // answers, and neither may write an audit row.
        const [current] = await tx
          .select({ status: orgs.registrationStatus })
          .from(orgs)
          .where(eq(orgs.id, orgId))
          .limit(1);
        if (!current) throw new NotFoundException('No business has that id.');
        throw new ConflictException({
          code: 'illegal_transition',
          current: current.status,
          message:
            move === 'reinstated'
              ? `Only a suspended business can be reinstated; this one is ${current.status}.`
              : `Only an active business can be suspended; this one is ${current.status}.`,
        });
      }

      // The pair ADR-053 names as easy to miss: it lives outside the
      // organization module, and a suspension with no event row reads in admin's
      // queue as a business that has been in its previous stage forever.
      await recordRegistrationEvent(tx, {
        orgId,
        from: edge.from,
        to: edge.to,
        mover: { trigger: 'staff', actorUserId },
      });

      const [audit] = await tx
        .insert(auditEvents)
        .values({
          actorUserId,
          subjectType: 'org',
          subjectId: orgId,
          eventType: edge.eventType,
          payloadDiff: {
            registrationStatus: { from: edge.from, to: edge.to },
          } as never,
          reason,
          // Copied onto the row, as the registration gates do, so district
          // reporting can count suspensions without joining back to `orgs`.
          districtId: moved.districtId,
        })
        .returning({ id: auditEvents.id });

      return AdminOrgStatusChange.parse({
        orgId,
        from: edge.from,
        registrationStatus: edge.to,
        auditEventId: audit?.id,
      });
    });
  }

  /**
   * Run the RRA TIN check again for a business stuck at `submitted`.
   *
   * THROUGH `RegistrationService.runTinCheck`, never the adapter. The check,
   * the `tin_verifications` row it writes and the status it advances are the
   * organization module's use case; an admin copy of it would be a second
   * pipeline that could disagree with the first about what a pass means.
   *
   * THE ONE WRITE HERE THAT IS NOT A SINGLE TRANSACTION, and why that is stated
   * rather than hidden. The check calls RRA, and an outbound call cannot sit
   * inside a database transaction — it would hold a connection and a row lock
   * for as long as RRA takes, and the domain service commits on its own
   * connection anyway. So the order is chosen to fail safe:
   *
   *   1. Everything that can refuse is checked FIRST (exists, has a TIN, is at
   *      `submitted`), so a refused request writes nothing at all.
   *   2. The domain runs the check, recording its own evidence row.
   *   3. The audit row is written only if a NEW evidence row appeared. If the
   *      org moved on between (1) and (2), nothing was checked, nothing is
   *      audited, and the caller gets a 409.
   *
   * If step 3 itself fails, the check has happened without its staff row. The
   * `tin_verifications` row still proves the check ran, and the failure is
   * logged loudly with everything needed to write the missing row by hand.
   * Closing that gap properly needs `runTinCheck` to accept a transaction or
   * record the actor itself — a change to the organization module.
   */
  async recheckTin(
    orgId: string,
    actorUserId: string,
    reason: string,
  ): Promise<AdminTinRecheckResult> {
    const [org] = await this.db
      .select({
        status: orgs.registrationStatus,
        tin: orgs.tin,
        districtId: orgs.districtId,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    if (!org) throw new NotFoundException('No business has that id.');

    if (!org.tin) {
      // A residence carries a UPI, not a TIN (D24). There is no RRA check to
      // retry, and a button labelled "retry TIN" must not quietly move a
      // residence through a gate under that name.
      throw new ConflictException({
        code: 'illegal_transition',
        current: org.status,
        message: 'This business has no TIN, so there is no RRA check to retry.',
      });
    }
    if (org.status !== 'submitted') {
      // The only stage the check runs at. Past it the TIN has an answer; before
      // it the fee is unpaid (D23) and RRA must not be asked yet.
      throw new ConflictException({
        code: 'illegal_transition',
        current: org.status,
        message: `A TIN check runs only while a business is at submitted; this one is ${org.status}.`,
      });
    }

    const before = await this.latestTinCheck(orgId);
    await this.registration.runTinCheck(orgId);
    const after = await this.latestTinCheck(orgId);

    if (!after || after.id === before?.id) {
      // `runTinCheck` returns silently when the org is no longer at
      // `submitted`. Nothing was checked, so nothing is audited.
      throw new ConflictException({
        code: 'illegal_transition',
        message:
          'This business moved on before the check ran. Nothing was checked; reload to see where it stands.',
      });
    }

    const [now] = await this.db
      .select({ status: orgs.registrationStatus })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    const registrationStatus = now?.status ?? org.status;

    let auditEventId: string | undefined;
    try {
      const [audit] = await this.db
        .insert(auditEvents)
        .values({
          actorUserId,
          subjectType: 'org',
          subjectId: orgId,
          eventType: 'admin.org.tin_rechecked',
          payloadDiff: {
            registrationStatus: { from: org.status, to: registrationStatus },
            tinVerificationId: after.id,
            result: after.result,
            adapterMode: after.adapterMode,
          } as never,
          reason,
          districtId: org.districtId,
        })
        .returning({ id: auditEvents.id });
      auditEventId = audit?.id;
    } catch (err) {
      this.log.error(
        `TIN re-check for org ${orgId} ran (tin_verifications ${after.id}, ` +
          `${after.result}) but its audit row failed to write. ` +
          `actor=${actorUserId} reason=${JSON.stringify(reason)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }

    return AdminTinRecheckResult.parse({
      orgId,
      result: after.result,
      adapterMode: after.adapterMode,
      registrationStatus,
      auditEventId,
    });
  }

  /** The newest evidence row for this org's TIN, or null before any check. */
  private async latestTinCheck(orgId: string): Promise<{
    id: string;
    result: 'pending' | 'verified' | 'failed';
    adapterMode: 'mock' | 'live';
  } | null> {
    const [row] = await this.db
      .select({
        id: tinVerifications.id,
        result: tinVerifications.result,
        adapterMode: tinVerifications.adapterMode,
      })
      .from(tinVerifications)
      .where(eq(tinVerifications.orgId, orgId))
      .orderBy(desc(tinVerifications.checkedAt), desc(tinVerifications.id))
      .limit(1);
    return row ?? null;
  }
}
