import { Injectable } from '@nestjs/common';
import {
  isOperational,
  landingFor,
  type MeContext,
  type MeContextBusiness,
  type OversightGrant,
  type StaffAccess,
  type WorkspaceAccess,
} from '@injishi/contracts';

import { MeContextRepository } from '../infrastructure/me-context.repository';

/** What the session and the grants already say, read by the caller from `WorkspaceService`. */
export interface MeContextGrants {
  user: { id: string; name: string | null; email: string };
  workspaces: readonly WorkspaceAccess[];
  activeWorkspaceId: string | null;
  oversight: readonly OversightGrant[];
  staff: StaffAccess;
}

/**
 * Who am I, in one answer (blueprint 2.5): the businesses the person is an
 * active member of (with their role and what it permits), the homes they rent,
 * their local leader or officer seats, their broker record and staff roles,
 * and where they land. Every surface comes from a real record.
 */
@Injectable()
export class MeContextService {
  constructor(private readonly reads: MeContextRepository) {}

  async build(grants: MeContextGrants): Promise<MeContext> {
    const [tenancies, broker] = await Promise.all([
      this.reads.tenancies(grants.user.id),
      this.reads.broker(grants.user.id),
    ]);
    const businesses: MeContextBusiness[] = grants.workspaces
      .filter((w) => w.kind === 'business' && w.orgId && w.domain)
      .map((w) => ({
        workspaceId: w.workspaceId,
        orgId: w.orgId as string,
        orgName: w.orgName ?? '',
        domain: w.domain as MeContextBusiness['domain'],
        role: w.orgRole,
        registrationStatus: w.registrationStatus,
        operational: isOperational(w.registrationStatus),
        permissions: w.permissions,
      }));
    const facts = {
      businesses,
      activeWorkspaceId: grants.activeWorkspaceId,
      tenancies,
      oversight: [...grants.oversight],
      broker,
      staff: { isStaff: grants.staff.isStaff, roles: grants.staff.roles },
    };
    return { user: grants.user, ...facts, landing: landingFor(facts) };
  }
}
