import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  LeaseContract,
  kigaliToday,
  premisesLine,
  type LeaseContractView,
  type LeaseEventList,
  type TenancyDetail,
  type TenancyList,
  type TenancyListItem,
  type TenancyPlace,
} from '@injishi/contracts';

import { LeasesRepository, type LeaseRecord, type VersionRow } from '../infrastructure/leases.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { SigningRepository } from '../infrastructure/signing.repository';
import { TenanciesRepository } from '../infrastructure/tenancies.repository';
import { LeaseBrokersService } from './lease-brokers.service';
import { LeaseContractService } from './lease-contract.service';
import { presentVersion } from './rentals-presenters';

/** A lease the caller holds as its tenant, as the tenancy guard resolved it. */
export interface TenancyRef {
  leaseId: string;
  tenantId: string;
  userId: string;
  workspaceId: string;
}

/** What anyone but the lease's own tenant is told, for a draft as for a lease that does not exist. */
export const TENANCY_NOT_FOUND = "We couldn't find this lease on your account.";

/**
 * The tenant's own leases (blueprint 2.4, `/me/tenancies`). A person holds a
 * lease through the tenant record their account is linked to (`tenants.user_id`,
 * set when they accept the invitation). Drafts are the landlord's alone and
 * are never shown; another person's lease is the same 404 as no lease.
 */
@Injectable()
export class TenanciesService {
  constructor(
    private readonly tenancies: TenanciesRepository,
    private readonly leases: LeasesRepository,
    private readonly signing: SigningRepository,
    private readonly context: RentalsContextRepository,
    private readonly contracts: LeaseContractService,
    /** The broker on the lease (2026-10-25); absent in the older unit tests. */
    @Optional() private readonly brokers?: LeaseBrokersService,
  ) {}

  /** The tenancy guard's check: the caller's own lease, and not a draft. */
  async resolve(userId: string, leaseId: string): Promise<TenancyRef> {
    const row = await this.tenancies.owner(leaseId);
    if (!row || row.tenantUserId !== userId || row.status === 'draft') throw new NotFoundException(TENANCY_NOT_FOUND);
    return { leaseId: row.leaseId, tenantId: row.tenantId, userId, workspaceId: row.workspaceId };
  }

  /** The person's tenancies, and the leases sent to their email that wait for them to accept. */
  async list(user: { id: string; email: string }): Promise<TenancyList> {
    const today = kigaliToday();
    const rows = await this.tenancies.listFor(user.id);
    const tenancies = await Promise.all(
      rows.map(async (row): Promise<TenancyListItem> => {
        const [charges, needsMySignature] = await Promise.all([
          this.leases.chargesSummary(row.id, row.graceDays, today),
          row.status === 'pending_signature' ? this.awaitsTenant(row.currentVersionId) : Promise.resolve(false),
        ]);
        return {
          id: row.id,
          reference: row.reference,
          status: row.status,
          landlordName: row.landlordName,
          propertyName: row.propertyName,
          unitLabel: row.unitLabel,
          monthlyRentRwf: row.monthlyRentRwf,
          startDate: row.startDate,
          endDate: row.endDate,
          needsMySignature,
          nextDue: charges.nextDueOn ? { dueOn: charges.nextDueOn, amountRwf: charges.nextDueRwf ?? 0 } : null,
          balanceRwf: charges.balanceRwf,
        };
      }),
    );
    const held = new Set(rows.map((r) => r.id));
    const invitations = (await this.signing.openInvitationsFor(user.email, new Date()))
      .filter((inv) => !held.has(inv.leaseId))
      .map((inv) => ({
        invitationId: inv.invitationId,
        leaseId: inv.leaseId,
        landlordName: inv.landlordName,
        propertyName: inv.propertyName,
        unitLabel: inv.unitLabel,
        monthlyRentRwf: inv.monthlyRentRwf,
        startDate: inv.startDate,
        endDate: inv.endDate,
        sentAt: inv.sentAt.toISOString(),
        expiresAt: inv.expiresAt.toISOString(),
      }));
    return { tenancies, invitations };
  }

  /** One tenancy: the landlord, the home, the terms, the contract and its signatures, and the money so far. */
  async detail(ref: TenancyRef): Promise<TenancyDetail> {
    const record = await this.record(ref);
    const { lease, tenant } = record;
    const [versions, signatures, charges, profile, org, broker] = await Promise.all([
      this.leases.versions(lease.id),
      this.leases.signatures(lease.id),
      this.leases.chargesSummary(lease.id, lease.graceDays, kigaliToday()),
      this.context.ensureProfile({ orgId: lease.orgId, workspaceId: lease.workspaceId }),
      this.context.org(lease.orgId),
      lease.brokerId && this.brokers ? this.brokers.tenantView(lease.id) : Promise.resolve(null),
    ]);
    const current = versions.find((v) => v.id === lease.currentVersionId) ?? null;
    const standing = current ? signatures.filter((s) => s.versionId === current.id && !s.voidedAt) : [];
    const landlordSigned = standing.some((s) => s.signerRole === 'landlord');
    const tenantSigned = standing.some((s) => s.signerRole === 'tenant');
    return {
      id: lease.id,
      reference: lease.reference,
      status: lease.status,
      landlord: {
        name: org.legalName,
        signatoryName: profile.signatoryName,
        phone: profile.contactPhone,
        email: profile.contactEmail,
      },
      place: await this.place(record, current),
      tenant: { fullName: tenant.fullName, email: tenant.email, phone: tenant.phone },
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
      signatures: standing.map((s) => ({
        role: s.signerRole,
        typedName: s.typedName,
        method: s.method,
        signedAt: s.signedAt.toISOString(),
        version: s.version,
      })),
      needsMySignature: lease.status === 'pending_signature' && landlordSigned && !tenantSigned,
      signedCopyReady: landlordSigned && tenantSigned && Boolean(current?.signedPdfObjectId),
      charges: {
        rentChargedRwf: charges.rentChargedRwf,
        rentPaidRwf: charges.rentPaidRwf,
        overdueRwf: charges.overdueRwf,
        balanceRwf: charges.balanceRwf,
        nextDue: charges.nextDueOn ? { dueOn: charges.nextDueOn, amountRwf: charges.nextDueRwf ?? 0 } : null,
        depositAgreedRwf: lease.depositRwf,
        depositStatus: charges.depositStatus,
      },
      broker,
      signedAt: lease.signedAt?.toISOString() ?? null,
      activatedAt: lease.activatedAt?.toISOString() ?? null,
      endedOn: lease.endedOn,
      cancelledAt: lease.cancelledAt?.toISOString() ?? null,
      cancelReason: lease.cancelReason,
      createdAt: lease.createdAt.toISOString(),
      updatedAt: lease.updatedAt.toISOString(),
    };
  }

  /**
   * The tenancy's timeline: only what the tenant may see. The landlord's acts
   * are named by the business, never by the staff member who did them.
   */
  async events(ref: TenancyRef): Promise<LeaseEventList> {
    const record = await this.record(ref);
    const [rows, org] = await Promise.all([this.leases.events(ref.leaseId), this.context.org(record.lease.orgId)]);
    return {
      events: rows
        .filter((e) => e.visibleToTenant)
        .map((e) => ({
          id: e.id,
          kind: e.kind,
          actorRole: e.actorRole,
          actorName: e.actorRole === 'landlord' ? org.legalName : e.actorRole === 'tenant' ? record.tenant.fullName : null,
          visibleToTenant: true,
          payload: (e.payload ?? {}) as Record<string, unknown>,
          occurredAt: e.occurredAt.toISOString(),
        })),
    };
  }

  /** The contract as it stands: the version out for signature, or signed. Earlier drafts were never the tenant's. */
  async contract(ref: TenancyRef): Promise<LeaseContractView> {
    const record = await this.record(ref);
    const versions = await this.leases.versions(ref.leaseId);
    const current = versions.find((v) => v.id === record.lease.currentVersionId);
    if (!current) throw new NotFoundException('This lease has no contract yet.');
    const standing = await this.signing.liveSignatures(current.id);
    return {
      leaseId: ref.leaseId,
      version: presentVersion(current),
      content: current.content as LeaseContractView['content'],
      signed: standing.some((s) => s.signerRole === 'landlord') && standing.some((s) => s.signerRole === 'tenant'),
      versions: [presentVersion(current)],
    };
  }

  /** The contract as a PDF: the signed copy once both have signed, a marked preview before. */
  async pdf(ref: TenancyRef): Promise<{ body: Buffer; filename: string }> {
    return this.contracts.pdfOf(await this.record(ref));
  }

  /** The lease record behind a resolved tenancy. */
  async record(ref: TenancyRef): Promise<LeaseRecord> {
    const record = await this.leases.find(ref.leaseId);
    if (!record || record.tenant.id !== ref.tenantId || record.tenant.userId !== ref.userId || record.lease.status === 'draft') {
      throw new NotFoundException(TENANCY_NOT_FOUND);
    }
    return record;
  }

  /** Out for signature and the landlord signed this version: the tenant's turn. */
  private async awaitsTenant(versionId: string | null): Promise<boolean> {
    if (!versionId) return false;
    const standing = await this.signing.liveSignatures(versionId);
    return standing.some((s) => s.signerRole === 'landlord') && !standing.some((s) => s.signerRole === 'tenant');
  }

  /** Where the home is: as the contract the tenant reads names it, else from the building's record. */
  private async place(record: LeaseRecord, current: VersionRow | null): Promise<TenancyPlace> {
    const parsed = current ? LeaseContract.safeParse(current.content) : null;
    if (parsed?.success) {
      const p = parsed.data.premises;
      return {
        propertyName: p.property,
        unitLabel: p.unit ?? record.unitLabel,
        blockCode: p.block,
        line: parsed.data.premisesLine,
        village: p.village,
        cell: p.cell,
        sector: p.sector,
        district: p.district,
        province: p.province,
      };
    }
    const place = await this.context.buildingPlace(record.lease.propertyId);
    const premises = {
      property: place?.name ?? record.propertyName,
      unit: record.unitLabel,
      block: record.blockCode,
      street: place?.addressText ?? null,
      village: place?.village ?? null,
      cell: place?.cell ?? null,
      sector: place?.sector ?? null,
      district: place?.district ?? null,
      province: place?.province ?? null,
    };
    return {
      propertyName: premises.property,
      unitLabel: record.unitLabel,
      blockCode: record.blockCode,
      line: premisesLine(premises),
      village: premises.village,
      cell: premises.cell,
      sector: premises.sector,
      district: premises.district,
      province: premises.province,
    };
  }
}
