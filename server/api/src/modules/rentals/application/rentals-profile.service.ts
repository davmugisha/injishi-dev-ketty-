import { Inject, Injectable } from '@nestjs/common';
import {
  RentalsSetupStep,
  brokerFeeFrom,
  type BrokerDefaultsRequest,
  type LandlordProfileView,
  type LeaseDefaultsRequest,
  type RentalsSetupView,
  type SignatoryRequest,
} from '@injishi/contracts';
import { and, eq } from 'drizzle-orm';

import { leases } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { destinationOf } from '../domain/payout-accounts';
import { assertResidence } from '../domain/residence';
import { RentalsContextRepository, type LandlordProfileRow } from '../infrastructure/rentals-context.repository';
import { LeaseContractService } from './lease-contract.service';

/**
 * The landlord's rentals profile and setup (blueprint 2.3, "Overview and
 * settings"): the lease defaults a new lease starts from, who signs leases for
 * the business, and which setup steps are done.
 */
@Injectable()
export class RentalsProfileService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly context: RentalsContextRepository,
    private readonly contracts: LeaseContractService,
  ) {}

  async profile(ws: ScopedWorkspace): Promise<LandlordProfileView> {
    const r = assertResidence(ws);
    const [profile, org] = await Promise.all([this.context.ensureProfile(r), this.context.org(r.orgId)]);
    return present(profile, org.legalName, org.tin);
  }

  /** The whole set of lease defaults. Leases already drafted keep their own terms. */
  async setLeaseDefaults(ws: ScopedWorkspace, body: LeaseDefaultsRequest): Promise<LandlordProfileView> {
    const r = assertResidence(ws);
    await this.context.ensureProfile(r);
    await this.context.updateProfile(this.db, r.orgId, {
      defaultGraceDays: body.graceDays,
      defaultNoticeDays: body.noticeDays,
      defaultRentDueDay: body.rentDueDay,
      autoStartLeases: body.autoStartLeases,
      leaseDefaultsSetAt: new Date(),
    });
    return this.profile(ws);
  }

  /**
   * The broker fee a unit starts with when the landlord lets brokers offer it
   * (2026-10-25). A unit keeps its own fee once set; this is only the default.
   */
  async setBrokerDefaults(ws: ScopedWorkspace, body: BrokerDefaultsRequest): Promise<LandlordProfileView> {
    const r = assertResidence(ws);
    await this.context.ensureProfile(r);
    const fee = body.fee;
    await this.context.updateProfile(this.db, r.orgId, {
      brokerFeeKind: fee?.kind ?? null,
      brokerFeePercent: fee?.kind === 'percent' ? fee.percent : null,
      brokerFeeRwf: fee?.kind === 'fixed' ? fee.amountRwf : null,
    });
    return this.profile(ws);
  }

  /**
   * Who signs leases for the business, and the contact tenants see. Every
   * draft's contract names them, so drafts get a new version; a lease already
   * out for signing or signed keeps the text that was signed.
   */
  async setSignatory(ws: ScopedWorkspace, userId: string, body: SignatoryRequest): Promise<LandlordProfileView> {
    const r = assertResidence(ws);
    await this.context.ensureProfile(r);
    await this.context.updateProfile(this.db, r.orgId, {
      signatoryName: body.name,
      signatoryIdKind: body.idKind,
      signatoryIdNumber: body.idNumber,
      contactPhone: body.contactPhone,
      contactEmail: body.contactEmail,
    });
    const drafts = await this.db
      .select({ id: leases.id })
      .from(leases)
      .where(and(eq(leases.workspaceId, r.workspaceId), eq(leases.status, 'draft')));
    await this.contracts.refreshDrafts(
      drafts.map((d) => d.id),
      userId,
    );
    return this.profile(ws);
  }

  /**
   * What is done of the setup steps, in order, with one plain line each. Once
   * every step is done the profile records when, so the app stops offering
   * them; a step undone later (a retired account) shows again but the date
   * stays.
   */
  async setup(ws: ScopedWorkspace): Promise<RentalsSetupView> {
    const r = assertResidence(ws);
    const [profile, buildings, units, primary] = await Promise.all([
      this.context.ensureProfile(r),
      this.context.buildings(r.workspaceId),
      this.context.unitCount(r.workspaceId),
      this.context.primaryPayoutAccount(r.orgId),
    ]);
    const place = buildings[0] ? await this.context.buildingPlace(buildings[0].id) : null;
    const located = buildings.length > 0 && buildings.every((b) => b.villageId !== null);
    const signatoryDone = Boolean(
      profile.signatoryName && profile.signatoryIdNumber && profile.contactPhone && profile.contactEmail,
    );
    const done: Record<RentalsSetupStep, { done: boolean; detail: string }> = {
      location: located
        ? { done: true, detail: [place?.village && `${place.village} village`, place?.district].filter(Boolean).join(', ') }
        : { done: false, detail: 'Add the village your homes are in.' },
      units: units > 0 ? { done: true, detail: `${units} ${units === 1 ? 'unit' : 'units'}` } : { done: false, detail: 'Add your units.' },
      getting_paid: primary
        ? { done: true, detail: destinationOf(primary) }
        : { done: false, detail: 'Add where rent is paid out.' },
      lease_defaults: profile.leaseDefaultsSetAt
        ? {
            done: true,
            detail: `Late after ${profile.defaultGraceDays} ${profile.defaultGraceDays === 1 ? 'day' : 'days'}, ${profile.defaultNoticeDays} days' notice`,
          }
        : { done: false, detail: 'Check the lease defaults.' },
      signatory: signatoryDone
        ? { done: true, detail: `Signed by ${profile.signatoryName}` }
        : { done: false, detail: 'Say who signs leases for the business.' },
    };
    const steps = RentalsSetupStep.options.map((step) => ({ step, ...done[step] }));
    const next = steps.find((s) => !s.done)?.step ?? null;
    let completedAt = profile.setupCompletedAt;
    if (next === null && !completedAt) completedAt = await this.context.markSetupComplete(r.orgId);
    return { steps, next, complete: next === null, setupCompletedAt: completedAt?.toISOString() ?? null };
  }
}

function present(profile: LandlordProfileRow, legalName: string, tin: string | null): LandlordProfileView {
  return {
    orgId: profile.orgId,
    workspaceId: profile.workspaceId,
    legalName,
    tin,
    taxpayerKind: profile.taxpayerKind,
    signatory: {
      name: profile.signatoryName,
      idKind: profile.signatoryIdKind,
      idNumber: profile.signatoryIdNumber,
      contactPhone: profile.contactPhone,
      contactEmail: profile.contactEmail,
    },
    leaseDefaults: {
      graceDays: profile.defaultGraceDays,
      noticeDays: profile.defaultNoticeDays,
      rentDueDay: profile.defaultRentDueDay,
      autoStartLeases: profile.autoStartLeases,
      setAt: profile.leaseDefaultsSetAt?.toISOString() ?? null,
    },
    brokerFeePercent: profile.brokerFeePercent,
    brokerFee: brokerFeeFrom(profile.brokerFeeKind, profile.brokerFeePercent, profile.brokerFeeRwf),
    setupCompletedAt: profile.setupCompletedAt?.toISOString() ?? null,
  };
}
