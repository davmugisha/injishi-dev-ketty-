import type { InvitableOrgRole, OrgRole, StaffAccessRequestStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  employees,
  jobPositions,
  orgInvitations,
  orgMemberships,
  staffAccessRequests,
  users,
} from '../../../database/drizzle/schema';
import { AuditWriter } from '../../../shared/audit/audit-writer';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/** A staff file, as giving it a login needs it. */
export interface AccessFile {
  id: string;
  name: string;
  employeeNumber: string;
  email: string | null;
  jobTitle: string | null;
  status: 'active' | 'offboarded';
  /** The branch the person works at; a caller limited to other branches does not see the file. */
  workPropertyId: string | null;
  /** The account on the file, when its membership is active. */
  memberUserId: string | null;
}

export interface AccessRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  jobTitle: string | null;
  email: string;
  orgRole: OrgRole;
  branchIds: string[] | null;
  status: StaffAccessRequestStatus;
  note: string | null;
  requestedAt: Date;
  requestedByName: string | null;
  decidedAt: Date | null;
  decidedByName: string | null;
  decisionNote: string | null;
}

export interface LiveInvitationRow {
  id: string;
  email: string;
  orgRole: OrgRole;
  branchIds: string[] | null;
  sentAt: Date;
  expiresAt: Date;
}

/**
 * `staff_access_requests`: the login HR gave a file, or asked the owner for (HR onboarding).
 *
 * Reads join the file and the people who asked and decided, so a request reads as a sentence
 * ("Diane asked for a Finance login for Claudine") without a second round trip. Every query names
 * the org, so a request id of another business answers nothing.
 */
@Injectable()
export class StaffAccessRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async file(orgId: string, employeeId: string): Promise<AccessFile | null> {
    const [row] = await this.db
      .select({
        id: employees.id,
        legalName: employees.legalName,
        preferredName: employees.preferredName,
        employeeNumber: employees.employeeNumber,
        email: employees.email,
        jobTitle: jobPositions.title,
        status: employees.status,
        workPropertyId: employees.workPropertyId,
        memberUserId: orgMemberships.userId,
        membershipStatus: orgMemberships.status,
        removedAt: orgMemberships.removedAt,
      })
      .from(employees)
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(orgMemberships, eq(orgMemberships.id, employees.orgMembershipId))
      .where(and(eq(employees.id, employeeId), eq(employees.orgId, orgId)))
      .limit(1);
    if (!row) return null;
    const member = row.memberUserId && row.membershipStatus === 'active' && row.removedAt === null;
    return {
      id: row.id,
      name: row.preferredName?.trim() || row.legalName,
      employeeNumber: row.employeeNumber,
      email: row.email,
      jobTitle: row.jobTitle,
      status: row.status,
      workPropertyId: row.workPropertyId,
      memberUserId: member ? row.memberUserId : null,
    };
  }

  /** The file's email, written when HR left it empty: the file and the login then agree. */
  async fillFileEmail(employeeId: string, email: string): Promise<void> {
    await this.db
      .update(employees)
      .set({ email: email.toLowerCase(), updatedAt: new Date() })
      .where(and(eq(employees.id, employeeId), isNull(employees.email)));
  }

  /** Every request of the business: those waiting first, then the last month's, newest first. */
  async listForOrg(orgId: string): Promise<AccessRequestRow[]> {
    return this.select(
      and(
        eq(staffAccessRequests.orgId, orgId),
        or(
          eq(staffAccessRequests.status, 'pending'),
          gt(staffAccessRequests.updatedAt, sql`now() - interval '30 days'`),
        ),
      ),
    );
  }

  async byId(orgId: string, id: string): Promise<AccessRequestRow | null> {
    const [row] = await this.select(
      and(eq(staffAccessRequests.orgId, orgId), eq(staffAccessRequests.id, id)),
    );
    return row ?? null;
  }

  /** The file's latest request, whatever became of it. */
  async latestFor(orgId: string, employeeId: string): Promise<AccessRequestRow | null> {
    const [row] = await this.select(
      and(eq(staffAccessRequests.orgId, orgId), eq(staffAccessRequests.employeeId, employeeId)),
    );
    return row ?? null;
  }

  /**
   * The live staff invitation for this file: one sent through a request for it, or one the owner
   * sent from Team to the address on the file. Unspent and unexpired.
   */
  async liveInvitationFor(
    orgId: string,
    employeeId: string,
    fileEmail: string | null,
  ): Promise<LiveInvitationRow | null> {
    const forThisFile = this.db
      .select({ id: staffAccessRequests.invitationId })
      .from(staffAccessRequests)
      .where(eq(staffAccessRequests.employeeId, employeeId));
    const [row] = await this.db
      .select({
        id: orgInvitations.id,
        email: orgInvitations.email,
        orgRole: orgInvitations.orgRole,
        branchIds: orgInvitations.branchPropertyIds,
        sentAt: orgInvitations.createdAt,
        expiresAt: orgInvitations.expiresAt,
      })
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.orgId, orgId),
          eq(orgInvitations.purpose, 'staff'),
          eq(orgInvitations.status, 'sent'),
          gt(orgInvitations.expiresAt, sql`now()`),
          fileEmail
            ? or(
                inArray(orgInvitations.id, forThisFile),
                sql`lower(${orgInvitations.email}) = ${fileEmail.toLowerCase()}`,
              )
            : inArray(orgInvitations.id, forThisFile),
        ),
      )
      .orderBy(desc(orgInvitations.createdAt))
      .limit(1);
    return row ?? null;
  }

  /** Write a request, and audit it. `approved` when its invitation went out with it. */
  async insert(input: {
    orgId: string;
    employeeId: string;
    email: string;
    orgRole: InvitableOrgRole;
    branchIds: readonly string[] | null;
    note: string | null;
    requestedByUserId: string;
    invitationId: string | null;
  }): Promise<string> {
    return this.db.transaction(async (tx) => {
      const approved = input.invitationId !== null;
      const now = new Date();
      const [row] = await tx
        .insert(staffAccessRequests)
        .values({
          orgId: input.orgId,
          employeeId: input.employeeId,
          email: input.email.toLowerCase(),
          orgRole: input.orgRole,
          branchPropertyIds: input.branchIds ? [...input.branchIds] : null,
          status: approved ? 'approved' : 'pending',
          note: input.note,
          requestedByUserId: input.requestedByUserId,
          decidedByUserId: approved ? input.requestedByUserId : null,
          decidedAt: approved ? now : null,
          invitationId: input.invitationId,
        })
        .returning({ id: staffAccessRequests.id });
      if (!row) throw new Error('Access request insert returned no row.');
      // Through the one writer (G16): it records the access the act was done under, and
      // writes the email as "changed", as every personal value in an audit diff is.
      await AuditWriter.write(tx, {
        actorUserId: input.requestedByUserId,
        subjectType: 'org',
        subjectId: input.orgId,
        eventType: approved ? 'team.access_given' : 'team.access_requested',
        payloadDiff: {
          requestId: row.id,
          employeeId: input.employeeId,
          email: input.email,
          orgRole: input.orgRole,
          branchIds: input.branchIds,
          invitationId: input.invitationId,
        },
        reason: input.note,
      });
      return row.id;
    });
  }

  /**
   * Decide a request still waiting, and audit it. False when it was decided meanwhile, so a
   * second press of Approve never sends a second invitation.
   */
  async decide(input: {
    orgId: string;
    id: string;
    status: 'approved' | 'declined' | 'cancelled';
    actorUserId: string;
    decisionNote: string | null;
    invitationId: string | null;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(staffAccessRequests)
        .set({
          status: input.status,
          decidedByUserId: input.actorUserId,
          decidedAt: new Date(),
          decisionNote: input.decisionNote,
          invitationId: input.invitationId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(staffAccessRequests.id, input.id),
            eq(staffAccessRequests.orgId, input.orgId),
            eq(staffAccessRequests.status, 'pending'),
          ),
        )
        .returning({ id: staffAccessRequests.id });
      if (rows.length === 0) return false;
      await AuditWriter.write(tx, {
        actorUserId: input.actorUserId,
        subjectType: 'org',
        subjectId: input.orgId,
        eventType: `team.access_${input.status}`,
        payloadDiff: { requestId: input.id, invitationId: input.invitationId },
        reason: input.decisionNote,
      });
      return true;
    });
  }

  private async select(where: ReturnType<typeof and>): Promise<AccessRequestRow[]> {
    const requester = alias(users, 'requester');
    const decider = alias(users, 'decider');
    const rows = await this.db
      .select({
        id: staffAccessRequests.id,
        employeeId: staffAccessRequests.employeeId,
        legalName: employees.legalName,
        preferredName: employees.preferredName,
        employeeNumber: employees.employeeNumber,
        jobTitle: jobPositions.title,
        email: staffAccessRequests.email,
        orgRole: staffAccessRequests.orgRole,
        branchIds: staffAccessRequests.branchPropertyIds,
        status: staffAccessRequests.status,
        note: staffAccessRequests.note,
        requestedAt: staffAccessRequests.createdAt,
        requestedByName: requester.name,
        decidedAt: staffAccessRequests.decidedAt,
        decidedByName: decider.name,
        decisionNote: staffAccessRequests.decisionNote,
      })
      .from(staffAccessRequests)
      .innerJoin(employees, eq(employees.id, staffAccessRequests.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(requester, eq(requester.id, staffAccessRequests.requestedByUserId))
      .leftJoin(decider, eq(decider.id, staffAccessRequests.decidedByUserId))
      .where(where)
      .orderBy(
        sql`case when ${staffAccessRequests.status} = 'pending' then 0 else 1 end`,
        desc(staffAccessRequests.createdAt),
      );
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.preferredName?.trim() || r.legalName,
      employeeNumber: r.employeeNumber,
      jobTitle: r.jobTitle,
      email: r.email,
      orgRole: r.orgRole,
      branchIds: r.branchIds,
      status: r.status as StaffAccessRequestStatus,
      note: r.note,
      requestedAt: r.requestedAt,
      requestedByName: r.requestedByName,
      decidedAt: r.decidedAt,
      decidedByName: r.decidedByName,
      decisionNote: r.decisionNote,
    }));
  }
}
