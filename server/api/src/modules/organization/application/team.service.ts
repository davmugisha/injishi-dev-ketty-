import type { OperatorTeamList, WorkspaceAccess } from '@injishi/contracts';
import { Injectable } from '@nestjs/common';

import { TeamRepository } from '../infrastructure/team.repository';

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
 * NO WRITE PATH HERE, DELIBERATELY. Adding somebody to a business is an
 * invitation, and an invitation is its own flow with its own decisions — who may
 * send one, how it is delivered, what happens when it is accepted by an account
 * that already holds a different role. Shipping a bare "add member" that wrote
 * an `org_memberships` row would skip all of that. Reading is the honest half
 * and it is what unblocks the screen.
 */
@Injectable()
export class TeamService {
  constructor(private readonly team: TeamRepository) {}

  async list(ws: WorkspaceAccess): Promise<OperatorTeamList> {
    const rows = await this.team.listForWorkspace(ws.workspaceId);
    return {
      members: rows.map((row) => ({
        userId: row.userId,
        name: row.name,
        email: row.email,
        orgRole: row.orgRole,
        status: row.status,
        joinedAt: row.joinedAt.toISOString(),
      })),
    };
  }
}
