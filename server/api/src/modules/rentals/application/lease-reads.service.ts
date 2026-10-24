import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LEASE_PAGE_SIZE,
  LeaseTab,
  kigaliToday,
  leaseActionsFrom,
  leaseStatusesForTab,
  leaseTab,
  type LeaseContractView,
  type LeaseCounts,
  type LeaseDetail,
  type LeaseEventList,
  type LeaseListPage,
  type LeaseListQuery,
  type LeaseSignatureView,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { leaseNextAction } from '../domain/lease-words';
import { assertBuildingInScope, assertResidence, buildingFilter } from '../domain/residence';
import { LeasesRepository, type LeaseRecord } from '../infrastructure/leases.repository';
import { TenantsRepository } from '../infrastructure/tenants.repository';
import { leases } from '../../../database/drizzle/schema';
import { LeaseContractService } from './lease-contract.service';
import { presentLeaseListItem, presentTenantRecord, presentVersion } from './rentals-presenters';

/**
 * What the landlord reads about leases (blueprint 2.3): the list by tab with
 * counts, one lease's record, its timeline, and its contract. Everything is
 * scoped to the workspace and the caller's buildings; a lease of another
 * business, or of a building outside the scope, is 404.
 */
@Injectable()
export class LeaseReadsService {
  constructor(
    private readonly leases: LeasesRepository,
    private readonly tenants: TenantsRepository,
    private readonly contracts: LeaseContractService,
  ) {}

  async list(ws: ScopedWorkspace, query: LeaseListQuery): Promise<LeaseListPage> {
    const r = assertResidence(ws);
    const page = query.page ?? 1;
    const { rows, total } = await this.leases.page({
      workspaceId: r.workspaceId,
      scope: buildingFilter(leases.propertyId, ws.branchScope),
      statuses: query.tab ? leaseStatusesForTab(query.tab) : null,
      q: query.q ?? null,
      limit: LEASE_PAGE_SIZE,
      offset: (page - 1) * LEASE_PAGE_SIZE,
    });
    return { items: rows.map(presentLeaseListItem), total, page, pageSize: LEASE_PAGE_SIZE, tab: query.tab ?? null };
  }

  async counts(ws: ScopedWorkspace): Promise<LeaseCounts> {
    const r = assertResidence(ws);
    const byStatus = await this.leases.statusCounts(r.workspaceId, buildingFilter(leases.propertyId, ws.branchScope));
    const counts = Object.fromEntries(LeaseTab.options.map((t) => [t, 0])) as LeaseCounts['counts'];
    let total = 0;
    for (const [status, n] of byStatus) {
      const tab = leaseTab(status);
      counts[tab] = (counts[tab] ?? 0) + n;
      total += n;
    }
    return { counts, total };
  }

  /** The lease record: parties, terms, the current contract version, signatures, invitation and money so far. */
  async detail(ws: ScopedWorkspace, leaseId: string): Promise<LeaseDetail> {
    const record = await this.owned(ws, leaseId);
    const { lease } = record;
    const [versions, signatures, invitation, charges, signed, built] = await Promise.all([
      this.leases.versions(lease.id),
      this.leases.signatures(lease.id),
      this.leases.latestInvitation(lease.id),
      this.leases.chargesSummary(lease.id, lease.graceDays, kigaliToday()),
      this.tenants.signedTenantIds([lease.tenantId]),
      lease.status === 'draft' ? this.contracts.build(record) : Promise.resolve(null),
    ]);
    const current = versions.find((v) => v.id === lease.currentVersionId) ?? null;
    return {
      id: lease.id,
      reference: lease.reference,
      status: lease.status,
      tab: leaseTab(lease.status),
      actions: leaseActionsFrom(lease.status),
      nextAction: leaseNextAction(lease.status, {
        invitationAccepted: invitation ? invitation.status === 'accepted' : undefined,
      }),
      property: { id: lease.propertyId, name: record.propertyName },
      unit: { id: lease.unitId, label: record.unitLabel, blockCode: record.blockCode, blockName: record.blockName },
      tenant: presentTenantRecord(record.tenant, !signed.has(lease.tenantId)),
      terms: {
        startDate: lease.startDate,
        endDate: lease.endDate,
        billingStartsOn: lease.billingStartsOn,
        monthlyRentRwf: lease.monthlyRentRwf,
        depositRwf: lease.depositRwf,
        rentDueDay: lease.rentDueDay,
        graceDays: lease.graceDays,
        noticeDays: lease.noticeDays,
        occupants: [...lease.occupants],
        otherTerms: lease.otherTerms,
      },
      currentVersion: current ? presentVersion(current) : null,
      signatures: signatures.map(
        (s): LeaseSignatureView => ({
          id: s.id,
          role: s.signerRole,
          version: s.version,
          typedName: s.typedName,
          method: s.method,
          signedAt: s.signedAt.toISOString(),
          voidedAt: s.voidedAt?.toISOString() ?? null,
          note: s.note,
        }),
      ),
      invitation: invitation
        ? {
            status: invitation.status,
            email: invitation.email,
            sentAt: invitation.sentAt.toISOString(),
            lastSentAt: invitation.lastSentAt.toISOString(),
            sendCount: invitation.sendCount,
            expiresAt: invitation.expiresAt.toISOString(),
            acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
          }
        : null,
      charges: {
        rentChargedRwf: charges.rentChargedRwf,
        rentPaidRwf: charges.rentPaidRwf,
        overdueRwf: charges.overdueRwf,
        balanceRwf: charges.balanceRwf,
        nextDue: charges.nextDueOn ? { dueOn: charges.nextDueOn, amountRwf: charges.nextDueRwf ?? 0 } : null,
        depositAgreedRwf: lease.depositRwf,
        depositStatus: charges.depositStatus,
      },
      // Only a draft can still be signed by the landlord; its problems say what blocks that.
      contractProblems: built?.problems ?? [],
      broker: lease.brokerId ? { id: lease.brokerId, name: record.brokerName } : null,
      supersedesLeaseId: lease.supersedesLeaseId,
      signedAt: lease.signedAt?.toISOString() ?? null,
      activatedAt: lease.activatedAt?.toISOString() ?? null,
      endingSince: lease.endingSince?.toISOString() ?? null,
      endedOn: lease.endedOn,
      endReason: lease.endReason,
      cancelledAt: lease.cancelledAt?.toISOString() ?? null,
      cancelReason: lease.cancelReason,
      createdAt: lease.createdAt.toISOString(),
      updatedAt: lease.updatedAt.toISOString(),
    };
  }

  /** The lease's timeline, newest first, with who did each thing by name. */
  async events(ws: ScopedWorkspace, leaseId: string): Promise<LeaseEventList> {
    await this.owned(ws, leaseId);
    const rows = await this.leases.events(leaseId);
    return {
      events: rows.map((e) => ({
        id: e.id,
        kind: e.kind,
        actorRole: e.actorRole,
        actorName: e.actorRole === 'system' ? null : e.actorName,
        visibleToTenant: e.visibleToTenant,
        payload: (e.payload ?? {}) as Record<string, unknown>,
        occurredAt: e.occurredAt.toISOString(),
      })),
    };
  }

  /** The current contract version's text, and every version before it. */
  async contract(ws: ScopedWorkspace, leaseId: string): Promise<LeaseContractView> {
    const record = await this.owned(ws, leaseId);
    const versions = await this.leases.versions(leaseId);
    const current = versions.find((v) => v.id === record.lease.currentVersionId) ?? versions[0];
    if (!current) throw new NotFoundException('This lease has no contract yet.');
    const signatures = (await this.leases.signatures(leaseId)).filter((s) => s.versionId === current.id && !s.voidedAt);
    return {
      leaseId,
      version: presentVersion(current),
      content: current.content as LeaseContractView['content'],
      signed: signatures.some((s) => s.signerRole === 'landlord') && signatures.some((s) => s.signerRole === 'tenant'),
      versions: versions.map(presentVersion),
    };
  }

  private async owned(ws: ScopedWorkspace, leaseId: string): Promise<LeaseRecord> {
    const r = assertResidence(ws);
    const record = await this.leases.find(leaseId);
    if (!record || record.lease.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, record.lease.propertyId, 'Lease');
    return record;
  }
}
