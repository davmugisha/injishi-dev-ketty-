import type {
  BrokerContact,
  BrokerCredits,
  BrokerDirectory,
  BrokerDirectoryListing,
  BrokerEarnings,
  BrokerPlacement,
  BrokerPlacementList,
  BrokerReveal,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  type BrokerSelfRow,
  BrokerOpsRepository,
  type RevealRow,
} from '../infrastructure/broker-ops.repository';

/**
 * What one reveal spends (ADR-038 child 6, Consequences). One credit, hard
 * coded: a per district price or a tier is a product decision nobody has made,
 * and the ledger's shape does not stand in the way of one.
 */
export const REVEAL_COST = 1;

/**
 * The broker surface: directory, reveal, placements, credits and earnings
 * (ADR-038 child 6; flows FL18 and FL19).
 *
 * **Why there is no `@RequirePermission` on the two commands.** A broker
 * workspace resolves an empty permission set (`permissionsForWorkspace`): the
 * operator matrix is a business matrix, and inventing broker permissions is a
 * design decision. The child 6 spec assumed `unit.manage` — nothing grants it
 * here. So the control is this service instead: the workspace must BE a broker
 * workspace, it has exactly one holder, and that holder's `brokers` row must be
 * active. The exception is named in the API's lint config.
 */
@Injectable()
export class BrokerService {
  constructor(private readonly repo: BrokerOpsRepository) {}

  async directory(ws: WorkspaceAccess): Promise<BrokerDirectory> {
    const broker = await this.brokerOf(ws);
    const [rows, reveals, open, balance] = await Promise.all([
      this.repo.directory(),
      this.repo.reveals(broker.id),
      this.repo.openPlacements(broker.id),
      this.repo.balance(broker.id),
    ]);
    const revealed = new Map(reveals.map((r) => [r.listingId, r]));

    const listings = new Map<string, BrokerDirectoryListing>();
    for (const row of rows) {
      let listing = listings.get(row.listingId);
      if (!listing) {
        const reveal = revealed.get(row.listingId);
        listing = {
          listingId: row.listingId,
          propertyName: row.propertyName,
          landlordName: row.landlordName,
          district: row.district,
          units: [],
          // The server sends no contact at all until it is bought.
          contact: reveal ? contactOf(reveal) : null,
          openPlacementId: open.get(row.listingId) ?? null,
        };
        listings.set(row.listingId, listing);
      }
      if (row.roomTypeId && row.unitName) {
        listing.units.push({
          roomTypeId: row.roomTypeId,
          name: row.unitName,
          monthlyRentRwf: row.monthlyRentRwf,
          cautionRwf: row.cautionRwf,
          vacantUnits: row.vacantUnits,
          totalUnits: row.totalUnits,
        });
      }
    }

    return {
      brokerStatus: broker.status,
      balance,
      revealCost: REVEAL_COST,
      listings: [...listings.values()],
    };
  }

  /**
   * Spend one credit to see a listing's landlord contact (AC-B3, AC-B4).
   *
   * Idempotent by LISTING, not by attempt: a broker who opens the same listing
   * next week is shown what they already bought and charged nothing. Checked
   * inside the broker's lock, so two presses at once cannot both see "not yet
   * revealed".
   */
  async reveal(ws: WorkspaceAccess, listingId: string): Promise<BrokerReveal> {
    const broker = await this.brokerOf(ws);
    this.assertActive(broker);

    return this.repo.withBrokerLock(broker.id, async (tx) => {
      const existing = (await this.repo.reveals(broker.id, tx)).find((r) => r.listingId === listingId);
      if (existing) {
        return {
          listingId,
          contact: contactOf(existing),
          balance: await this.repo.balance(broker.id, tx),
          charged: false,
        };
      }

      const contact = await this.repo.listingContact(listingId, tx);
      if (!contact) {
        throw new NotFoundException('That listing is not on the broker directory.');
      }
      if (!contact.phone && !contact.email) {
        throw new ConflictException(
          'This landlord has no phone or email on file yet, so there is nothing to reveal. No credit was spent.',
        );
      }

      const balance = await this.repo.balance(broker.id, tx);
      if (balance < REVEAL_COST) {
        throw new HttpException(
          `Revealing a landlord costs ${REVEAL_COST} credit and you have ${balance}. No credit was spent.`,
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      const reveal = await this.repo.insertReveal(tx, { brokerId: broker.id, contact, cost: REVEAL_COST });
      return {
        listingId,
        contact: contactOf(reveal),
        balance: balance - REVEAL_COST,
        charged: true,
      };
    });
  }

  /**
   * Start a placement on a listing whose landlord this broker revealed (FL19).
   *
   * It stays `initiated` until the landlord records the broker on a lease; the
   * broker has no later step to take. A second press returns the open one.
   */
  async startPlacement(ws: WorkspaceAccess, listingId: string): Promise<BrokerPlacement> {
    const broker = await this.brokerOf(ws);
    this.assertActive(broker);

    const placementId = await this.repo.withBrokerLock(broker.id, async (tx) => {
      const contact = await this.repo.listingContact(listingId, tx);
      if (!contact) {
        throw new NotFoundException('That listing is not on the broker directory.');
      }
      const revealed = (await this.repo.reveals(broker.id, tx)).some((r) => r.listingId === listingId);
      if (!revealed) {
        throw new ConflictException('Reveal this landlord before starting a placement with them.');
      }
      return (
        (await this.repo.openPlacementOn(tx, broker.id, listingId)) ??
        (await this.repo.insertPlacement(tx, broker.id, contact))
      );
    });

    const placement = (await this.placements(ws)).placements.find((p) => p.id === placementId);
    if (!placement) throw new Error(`Placement ${placementId} vanished after it was written.`);
    return placement;
  }

  async credits(ws: WorkspaceAccess): Promise<BrokerCredits> {
    const broker = await this.brokerOf(ws);
    const entries = await this.repo.credits(broker.id);
    return {
      balance: entries.reduce((sum, e) => sum + e.delta, 0),
      entries: entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    };
  }

  async placements(ws: WorkspaceAccess): Promise<BrokerPlacementList> {
    const broker = await this.brokerOf(ws);
    const rows = await this.repo.placements(broker.id);
    return {
      placements: rows.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        propertyName: r.propertyName,
        landlordName: r.landlordName,
        status: r.status,
        initiatedAt: r.initiatedAt.toISOString(),
        lease: r.leaseId
          ? {
              id: r.leaseId,
              unitLabel: r.unitLabel,
              tenantName: r.tenantName,
              status: r.leaseStatus ?? 'draft',
              startDate: r.startDate,
            }
          : null,
        fee: r.feeStatus ? { amountRwf: r.feeAmountRwf, status: r.feeStatus } : null,
      })),
    };
  }

  async earnings(ws: WorkspaceAccess, now = new Date()): Promise<BrokerEarnings> {
    const broker = await this.brokerOf(ws);
    const [fees, balance] = await Promise.all([this.repo.fees(broker.id), this.repo.balance(broker.id)]);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return {
      disbursedThisYearRwf: fees
        .filter((f) => f.status === 'disbursed' && f.updatedAt >= yearStart)
        .reduce((sum, f) => sum + (f.amountRwf ?? 0), 0),
      pendingRwf: fees.filter((f) => f.status === 'pending').reduce((sum, f) => sum + (f.amountRwf ?? 0), 0),
      balance,
      fees: fees.map((f) => ({ ...f, updatedAt: f.updatedAt.toISOString() })),
    };
  }

  /**
   * The broker row this workspace stands for, or a refusal naming why not.
   *
   * Resolved from the workspace every time, never from the request: that is
   * what keeps one broker out of another's rows (AC-B8).
   */
  private async brokerOf(ws: WorkspaceAccess): Promise<BrokerSelfRow> {
    if (ws.kind !== 'broker') {
      throw new ForbiddenException('This is not a broker workspace.');
    }
    const broker = await this.repo.brokerForWorkspace(ws.workspaceId);
    if (!broker) {
      throw new NotFoundException(
        'This broker workspace has no broker registration behind it. Register as a broker first.',
      );
    }
    return broker;
  }

  /** AC-B10: a suspended broker reads, and is refused every write. */
  private assertActive(broker: BrokerSelfRow): void {
    if (broker.status !== 'active') {
      throw new UnprocessableEntityException(
        'Your broker account is suspended, so you cannot reveal landlords or start placements. Contact Injishi support.',
      );
    }
  }
}

function contactOf(reveal: RevealRow): BrokerContact {
  return { phone: reveal.phone, email: reveal.email, revealedAt: reveal.revealedAt.toISOString() };
}
