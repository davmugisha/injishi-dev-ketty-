import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { users } from '../../../database/drizzle/auth';
import {
  orgMemberships,
  userProfiles,
  workspaces,
} from '../../../database/drizzle/schema';

/** One membership row, joined to the person it names. */
export interface TeamMemberRow {
  userId: string;
  name: string | null;
  email: string | null;
  orgRole: 'owner' | 'manager' | 'receptionist' | 'housekeeper';
  status: string;
  joinedAt: Date;
}

/**
 * Who works at a business (ADR-035, wave 2 follow-up).
 *
 * **This repository exists because nothing read `org_memberships` for anybody
 * but the caller.** `WorkspaceService` queries it to resolve your own grant and
 * stops there, so the operator app had no way to list its own staff and the
 * screen that tried showed invented people.
 *
 * IT RESOLVES THE ORG FROM THE WORKSPACE, not from a caller supplied org id.
 * A workspace belongs to exactly one org, and taking the org from the request
 * would let somebody who holds workspace A ask for the staff of org B. The
 * guard proves the workspace; this derives everything else from it.
 *
 * REMOVED MEMBERS ARE RETURNED, not filtered out. A membership is never
 * deleted — `status` goes to `removed` and `removed_at` is stamped — because
 * the rows they posted, charged and voided still name them. The screen decides
 * whether to show them; the repository does not get to hide history.
 */
@Injectable()
export class TeamRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForWorkspace(workspaceId: string): Promise<TeamMemberRow[]> {
    const rows = await this.db
      .select({
        userId: orgMemberships.userId,
        // The profile's display name first, the auth record's second. A person
        // who has completed Step 1 chose the first; the second is whatever the
        // sign-in gave us, and it is better than nothing.
        displayName: userProfiles.displayName,
        authName: users.name,
        email: users.email,
        orgRole: orgMemberships.orgRole,
        status: orgMemberships.status,
        joinedAt: orgMemberships.createdAt,
      })
      .from(orgMemberships)
      .innerJoin(workspaces, eq(workspaces.orgId, orgMemberships.orgId))
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .leftJoin(userProfiles, eq(userProfiles.userId, orgMemberships.userId))
      .where(eq(workspaces.id, workspaceId))
      .orderBy(asc(orgMemberships.orgRole), asc(users.email));

    return rows.map((row) => ({
      userId: row.userId,
      name: row.displayName ?? row.authName,
      email: row.email,
      orgRole: row.orgRole,
      status: row.status,
      joinedAt: row.joinedAt,
    }));
  }
}
