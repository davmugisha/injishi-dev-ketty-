import {
  brokerFeeAmount,
  brokerFeeFrom,
  kigaliToday,
  type BrokerContact,
  type BrokerEarnings,
  type BrokerFeeRecord,
  type BrokerHome,
  type BrokerHomes,
  type BrokerHomesQuery,
  type BrokerPlacement,
  type BrokerPlacementList,
  type BrokerReveal,
  type BrokerReviews,
  type BrokerSummary,
  type StartPlacementRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, UnprocessableEntityException } from '@nestjs/common';

import { RentalsMailer } from '../../rentals/infrastructure/rentals.mailer';
import { StorageService } from '../../storage/application/storage.service';
import { BrokersRepository, type BrokerSelfRow, type HomeRow, type RevealRow } from '../infrastructure/brokers.repository';
import { BrokerPlansService } from './broker-plans.service';

/** How many photos a home card carries, signed. */
const PHOTOS_PER_HOME = 6;
const NOT_HERE = 'That home is not on offer to you.';

/**
 * The broker's surface (2026-10-25): the opted-in homes inside their plan, a
 * free reveal of the landlord's contact (logged once per landlord), a
 * placement ("I have a tenant for this unit"), and what the work recorded:
 * placements, fees owed and paid, and ratings.
 *
 * No `@RequirePermission` on these routes: a broker workspace holds no
 * permissions (`permissionsForWorkspace` returns none for a workspace that is
 * not a business), so the control is here. The workspace must be a broker
 * workspace with an active broker behind it, and every unit is read through
 * the plan's area: outside it, or not switched on by its landlord, a unit is
 * not there (404).
 */
@Injectable()
export class BrokerHomesService {
  private readonly log = new Logger(BrokerHomesService.name);

  constructor(
    private readonly repo: BrokersRepository,
    private readonly plans: BrokerPlansService,
    private readonly storage: StorageService,
    @Optional() private readonly mailer?: RentalsMailer,
  ) {}

  async summary(ws: WorkspaceAccess): Promise<BrokerSummary> {
    const broker = await this.brokerOf(ws);
    const scope = await this.plans.scopeFor(broker.id);
    const [counts, described, fees] = await Promise.all([
      this.repo.counts(broker.id, scope),
      this.plans.describeScope(broker.id, scope),
      this.repo.fees(broker.id),
    ]);
    return {
      name: broker.name,
      status: broker.status,
      scope: described,
      homesInScope: counts.homes,
      openPlacements: counts.open,
      owedRwf: fees.filter((f) => f.status === 'pending' && f.leaseStatus !== 'cancelled').reduce((s, f) => s + f.amountRwf, 0),
      paidRwf: fees.filter((f) => f.status === 'disbursed').reduce((s, f) => s + f.amountRwf, 0),
      ratingAverage: counts.ratingAverage,
      ratingCount: counts.ratingCount,
    };
  }

  /** The homes on offer inside the plan, narrowed by the filters. A district outside the plan shows nothing. */
  async homes(ws: WorkspaceAccess, query: BrokerHomesQuery): Promise<BrokerHomes> {
    const broker = await this.brokerOf(ws);
    const scope = await this.plans.scopeFor(broker.id);
    const districtId = query.district ?? null;
    const [rows, districts, reveals, placements, described] = await Promise.all([
      this.repo.homes({
        scope,
        districtId,
        minRent: query.minRent,
        maxRent: query.maxRent,
        bedrooms: query.bedrooms,
        q: query.q,
        sort: query.sort,
      }),
      this.repo.homeDistricts(scope),
      this.repo.reveals(broker.id),
      this.repo.unitPlacements(broker.id),
      this.plans.describeScope(broker.id, scope),
    ]);
    const revealed = new Map(reveals.map((r) => [r.orgId, r]));
    const homes = await Promise.all(rows.map((row) => this.present(row, revealed.get(row.orgId) ?? null, placements.get(row.unitId) ?? null)));
    return { brokerStatus: broker.status, districtId, districts, homes, scope: described };
  }

  async home(ws: WorkspaceAccess, unitId: string): Promise<BrokerHome> {
    const broker = await this.brokerOf(ws);
    const row = await this.repo.home(unitId, await this.plans.scopeFor(broker.id));
    if (!row) throw new NotFoundException(NOT_HERE);
    const [reveals, placements] = await Promise.all([this.repo.reveals(broker.id), this.repo.unitPlacements(broker.id)]);
    return this.present(row, reveals.find((r) => r.orgId === row.orgId) ?? null, placements.get(row.unitId) ?? null, 20);
  }

  /**
   * See the landlord's phone and email. Free, and logged once per landlord: a
   * second reveal of any of their homes shows what was revealed then.
   */
  async reveal(ws: WorkspaceAccess, unitId: string): Promise<BrokerReveal> {
    const broker = await this.brokerOf(ws);
    this.assertActive(broker);
    const scope = await this.plans.scopeFor(broker.id);
    return this.repo.withBrokerLock(broker.id, async (tx) => {
      const home = await this.repo.home(unitId, scope, tx);
      if (!home) throw new NotFoundException(NOT_HERE);
      const existing = (await this.repo.reveals(broker.id, tx)).find((r) => r.orgId === home.orgId);
      if (existing) return { unitId, contact: contactOf(existing), first: false };
      const contact = await this.repo.landlordContact(home.orgId, tx);
      if (!contact || (!contact.phone && !contact.email)) {
        throw new ConflictException({ code: 'no_contact', message: 'This landlord has no phone or email on file yet. Try again later.' });
      }
      const reveal = await this.repo.insertReveal(tx, { brokerId: broker.id, unitId, contact });
      if (!reveal) throw new Error('A reveal vanished after it was written.');
      return { unitId, contact: contactOf(reveal), first: true };
    });
  }

  /**
   * "I have a tenant for this unit." Needs the landlord revealed first, so the
   * broker has spoken to them; a second press returns the open placement. The
   * placement keeps the unit's fee as it stood, and the landlord is told.
   */
  async startPlacement(ws: WorkspaceAccess, unitId: string, body: StartPlacementRequest): Promise<BrokerPlacement> {
    const broker = await this.brokerOf(ws);
    this.assertActive(broker);
    const scope = await this.plans.scopeFor(broker.id);
    const { id, created } = await this.repo.withBrokerLock(broker.id, async (tx) => {
      const home = await this.repo.home(unitId, scope, tx);
      if (!home) throw new NotFoundException(NOT_HERE);
      const revealed = (await this.repo.reveals(broker.id, tx)).some((r) => r.orgId === home.orgId);
      if (!revealed) {
        throw new ConflictException({ code: 'reveal_first', message: 'Reveal the landlord first, so you can agree the tenant with them.' });
      }
      const open = await this.repo.openPlacementOn(tx, broker.id, unitId);
      if (open) return { id: open, created: false };
      return {
        id: await this.repo.insertPlacement(tx, {
          brokerId: broker.id,
          home,
          tenantName: body.tenantName?.trim() || null,
          note: body.note?.trim() || null,
        }),
        created: true,
      };
    });
    if (created) await this.tellLandlord(id);
    const placement = (await this.placements(ws)).placements.find((p) => p.id === id);
    if (!placement) throw new Error(`Placement ${id} vanished after it was written.`);
    return placement;
  }

  async placements(ws: WorkspaceAccess): Promise<BrokerPlacementList> {
    const broker = await this.brokerOf(ws);
    const rows = await this.repo.placements(broker.id);
    return {
      placements: rows.map((r) => {
        const recordTerms = brokerFeeFrom(r.recordKind, r.recordPercent, r.recordRwf);
        const fee: BrokerFeeRecord | null =
          recordTerms && r.recordRwf !== null && r.recordStatus
            ? {
                terms: recordTerms,
                amountRwf: r.recordRwf,
                status: r.recordStatus === 'disbursed' ? 'paid' : r.leaseStatus === 'cancelled' ? 'void' : 'owed',
                paidAt: r.disbursedAt?.toISOString() ?? null,
              }
            : null;
        return {
          id: r.id,
          status: r.status,
          startedAt: r.initiatedAt.toISOString(),
          unit: r.unitId && r.unitLabel ? { id: r.unitId, label: r.unitLabel, propertyName: r.propertyName ?? '', district: r.district } : null,
          landlordName: r.landlordName,
          tenantName: r.tenantName,
          note: r.note,
          terms: brokerFeeFrom(r.feeKind, r.feePercent, r.feeRwf),
          lease:
            r.leaseId && r.leaseReference && r.leaseStartDate
              ? { id: r.leaseId, reference: r.leaseReference, tenantName: r.leaseTenantName ?? '', status: r.leaseStatus ?? 'draft', startDate: r.leaseStartDate }
              : null,
          fee,
        };
      }),
    };
  }

  /** What landlords recorded as owed and paid. Injishi moves none of this money. */
  async earnings(ws: WorkspaceAccess, now = new Date()): Promise<BrokerEarnings> {
    const broker = await this.brokerOf(ws);
    const rows = await this.repo.fees(broker.id);
    const today = kigaliToday(now);
    const year = today.slice(0, 4);
    const fees = rows.map((f) => {
      const terms = brokerFeeFrom(f.kind, f.percent, f.amountRwf) ?? { kind: 'fixed' as const, amountRwf: f.amountRwf };
      const status: BrokerFeeRecord['status'] = f.status === 'disbursed' ? 'paid' : f.leaseStatus === 'cancelled' ? 'void' : 'owed';
      return {
        leaseId: f.leaseId,
        reference: f.reference,
        tenantName: f.tenantName,
        unitLabel: f.unitLabel,
        propertyName: f.propertyName,
        landlordName: f.landlordName,
        startDate: f.startDate,
        fee: { terms, amountRwf: f.amountRwf, status, paidAt: f.disbursedAt?.toISOString() ?? null },
      };
    });
    const months = lastMonths(today, 12);
    const byMonth = months.map((month) => ({
      month,
      paidRwf: fees.filter((f) => f.fee.status === 'paid' && (f.fee.paidAt ? kigaliToday(new Date(f.fee.paidAt)) : f.startDate).startsWith(month)).reduce((s, f) => s + f.fee.amountRwf, 0),
      owedRwf: fees.filter((f) => f.fee.status === 'owed' && f.startDate.startsWith(month)).reduce((s, f) => s + f.fee.amountRwf, 0),
    }));
    return {
      owedRwf: fees.filter((f) => f.fee.status === 'owed').reduce((s, f) => s + f.fee.amountRwf, 0),
      paidRwf: fees.filter((f) => f.fee.status === 'paid').reduce((s, f) => s + f.fee.amountRwf, 0),
      paidThisYearRwf: fees
        .filter((f) => f.fee.status === 'paid' && (f.fee.paidAt ? kigaliToday(new Date(f.fee.paidAt)) : f.startDate).startsWith(year))
        .reduce((s, f) => s + f.fee.amountRwf, 0),
      byMonth,
      fees,
    };
  }

  async reviews(ws: WorkspaceAccess): Promise<BrokerReviews> {
    const broker = await this.brokerOf(ws);
    const { placedCount, reviews } = await this.repo.reviews(broker.id);
    const count = reviews.length;
    const average = count ? Math.round((reviews.reduce((a, r) => a + r.stars, 0) / count) * 10) / 10 : null;
    return {
      average,
      count,
      breakdown: [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => r.stars === n).length),
      placedCount,
      reviews: reviews.map((r) => ({ ...r, ratedAt: r.ratedAt.toISOString() })),
    };
  }

  // --- Helpers -------------------------------------------------------------------

  private async present(
    row: HomeRow,
    reveal: RevealRow | null,
    placement: { id: string; status: BrokerPlacement['status'] } | null,
    photos = PHOTOS_PER_HOME,
  ): Promise<BrokerHome> {
    const fee = brokerFeeFrom(row.feeKind, row.feePercent, row.feeRwf) ?? { kind: 'fixed' as const, amountRwf: 0 };
    return {
      unitId: row.unitId,
      unitLabel: row.unitLabel,
      propertyName: row.propertyName,
      landlordName: row.landlordName,
      districtId: row.districtId,
      district: row.district,
      sector: row.sector,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      kitchen: row.kitchen,
      furnished: row.furnished,
      sizeSqm: row.sizeSqm,
      rentRwf: row.rentRwf,
      depositRwf: row.depositRwf,
      availableFrom: row.availableFrom,
      latitude: row.latitude,
      longitude: row.longitude,
      fee,
      feeRwf: brokerFeeAmount(fee, row.rentRwf),
      photos: await Promise.all(row.photoKeys.slice(0, photos).map((k) => this.storage.signedUrl(k, 3600))),
      video:
        row.videoKey && row.videoDurationS !== null
          ? {
              url: await this.storage.signedUrl(row.videoKey, 3600),
              posterUrl: row.videoPosterKey ? await this.storage.signedUrl(row.videoPosterKey, 3600) : null,
              durationS: row.videoDurationS,
            }
          : null,
      contact: reveal ? contactOf(reveal) : null,
      placement,
    };
  }

  /** The landlord hears it at once: who the broker is, for which unit, and the fee they set. */
  private async tellLandlord(placementId: string): Promise<void> {
    const notice = await this.repo.placementNotice(placementId);
    if (!notice?.email || !this.mailer) return;
    const who = notice.brokerName ?? 'A broker';
    const lines = [
      `${who}, a broker on Injishi, has a tenant for unit ${notice.unitLabel} at ${notice.propertyName}.`,
      ...(notice.brokerPhone ? [`Phone: ${notice.brokerPhone}`] : []),
      'When you write the lease, name them as the broker who brought the tenant. The fee you set is recorded on it.',
    ];
    void this.mailer
      .send(`Placement ${placementId}`, notice.email, {
        subject: `${who} has a tenant for ${notice.unitLabel}`,
        heading: `${who} has a tenant for ${notice.unitLabel}`,
        lines,
        action: { label: 'See brokers', url: new URL('/brokers', this.mailer.appUrl).toString() },
      })
      .catch((cause: unknown) => this.log.warn(`Placement mail not sent: ${cause instanceof Error ? cause.message : cause}`));
  }

  /** The broker this workspace stands for. Resolved from the workspace, never from the request. */
  async brokerOf(ws: WorkspaceAccess): Promise<BrokerSelfRow> {
    if (ws.kind !== 'broker') throw new ForbiddenException('This is not a broker workspace.');
    const broker = await this.repo.brokerForWorkspace(ws.workspaceId);
    if (!broker) throw new NotFoundException('This broker workspace has no broker registration behind it. Register as a broker first.');
    return broker;
  }

  /** A suspended broker reads, and is refused every write. */
  private assertActive(broker: BrokerSelfRow): void {
    if (broker.status !== 'active') {
      throw new UnprocessableEntityException('Your broker account is suspended, so you cannot reveal landlords or start placements. Contact Injishi support.');
    }
  }
}

function contactOf(reveal: RevealRow): BrokerContact {
  return { name: reveal.name, phone: reveal.phone, email: reveal.email, revealedAt: reveal.revealedAt.toISOString() };
}

/** The last `n` months up to this one, oldest first, as `yyyy-mm`. */
function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

