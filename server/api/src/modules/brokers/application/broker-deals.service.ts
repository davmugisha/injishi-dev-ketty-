import {
  BUSINESS_KIND_LABEL,
  kigaliToday,
  type BrokerDeal,
  type BrokerDealList,
  type BrokerHotels,
  type DecideBrokerDealRequest,
  type EndBrokerDealRequest,
  type ProposeBrokerDealRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { effectiveStatus, moveProblem, proposalDatesProblem, termColumns, termsFromColumns } from '../domain/broker-deal-rules';
import { BrokersRepository, type BrokerSelfRow } from '../infrastructure/brokers.repository';
import { BrokerDealsRepository, type DealRow, type HotelRow } from '../infrastructure/broker-deals.repository';
import { BrokerPlansService } from './broker-plans.service';

const NO_HOTEL = 'That hotel is not open to you for a deal.';
const NO_DEAL = 'There is no such deal.';

/**
 * Broker deals with hotels (0124, 2026-11-02): a broker proposes commission
 * terms to a hotel inside their plan's area, the hotel's owner accepts or
 * declines, and either side ends a running deal. No money moves here; the
 * commission on a stay is the next phase.
 *
 * Two doors, each closed in its own way:
 * - The broker's (`/ops/broker/*`): a broker workspace holds no permissions,
 *   so the control is here, as in `BrokerHomesService`. The workspace must be
 *   a broker workspace with a broker behind it, and a hotel outside the plan
 *   is not found (404).
 * - The hotel's (`/ops/broker-deals/*`): `payout.manage`, declared on the
 *   routes, because a deal decides what the hotel is paid. Every deal is read
 *   through the workspace's own org, so another hotel's deal is not found.
 */
@Injectable()
export class BrokerDealsService {
  constructor(
    private readonly brokers: BrokersRepository,
    private readonly repo: BrokerDealsRepository,
    private readonly plans: BrokerPlansService,
  ) {}

  // --- The broker's side ------------------------------------------------------

  async hotels(ws: WorkspaceAccess): Promise<BrokerHotels> {
    const broker = await this.brokerOf(ws);
    const scope = await this.plans.scopeFor(broker.id);
    const [hotels, deals, described] = await Promise.all([
      this.repo.hotels(scope),
      this.repo.forBroker(broker.id),
      this.plans.describeScope(broker.id, scope),
    ]);
    const today = kigaliToday();
    const live = new Map<string, BrokerDeal>();
    for (const row of deals) {
      const deal = this.present(row, today);
      if ((deal.status === 'proposed' || deal.status === 'active') && !live.has(row.orgId)) live.set(row.orgId, deal);
    }
    return {
      brokerStatus: broker.status,
      hotels: hotels.map((h) => ({ ...this.presentHotel(h), deal: live.get(h.orgId) ?? null })),
      scope: described,
    };
  }

  async brokerDeals(ws: WorkspaceAccess): Promise<BrokerDealList> {
    const broker = await this.brokerOf(ws);
    const today = kigaliToday();
    return { deals: (await this.repo.forBroker(broker.id)).map((row) => this.present(row, today)) };
  }

  async propose(ws: WorkspaceAccess, orgId: string, body: ProposeBrokerDealRequest, userId: string): Promise<BrokerDeal> {
    const broker = await this.brokerOf(ws);
    if (broker.status !== 'active') {
      throw new ForbiddenException('Your broker registration is suspended, so you cannot propose deals.');
    }
    const hotel = await this.repo.hotel(orgId, await this.plans.scopeFor(broker.id));
    if (!hotel) throw new NotFoundException(NO_HOTEL);
    const today = kigaliToday();
    const startsOn = body.startsOn ?? null;
    const endsOn = body.endsOn ?? null;
    const datesProblem = proposalDatesProblem(startsOn, endsOn, today);
    if (datesProblem) throw new UnprocessableEntityException(datesProblem);

    // A running deal past its end date still holds the pair in the table; write it down as ended first.
    for (const row of await this.repo.forBroker(broker.id)) {
      if (row.orgId === orgId && row.status === 'active' && effectiveStatus(row.status, row.endsOn, today) === 'ended') {
        await this.repo.expire(row.id);
      }
    }
    const id = await this.repo.insert({
      brokerId: broker.id,
      orgId,
      terms: termColumns(body.terms),
      startsOn,
      endsOn,
      note: body.note?.trim() || null,
      userId,
    });
    if (!id) {
      throw new ConflictException(
        `You already have a deal with ${hotel.name} that is waiting for an answer or running. Withdraw or end it first.`,
      );
    }
    return this.mustRead(id, today);
  }

  async withdraw(ws: WorkspaceAccess, id: string, body: EndBrokerDealRequest, userId: string): Promise<BrokerDeal> {
    const broker = await this.brokerOf(ws);
    const row = await this.ownDeal(id, (r) => r.brokerId === broker.id);
    return this.close(row, 'withdraw', 'broker', body, userId);
  }

  async endByBroker(ws: WorkspaceAccess, id: string, body: EndBrokerDealRequest, userId: string): Promise<BrokerDeal> {
    const broker = await this.brokerOf(ws);
    const row = await this.ownDeal(id, (r) => r.brokerId === broker.id);
    return this.close(row, 'end', 'broker', body, userId);
  }

  // --- The hotel's side -------------------------------------------------------

  async hotelDeals(ws: WorkspaceAccess): Promise<BrokerDealList> {
    const orgId = this.orgOf(ws);
    const today = kigaliToday();
    return { deals: (await this.repo.forOrg(orgId)).map((row) => this.present(row, today)) };
  }

  async decide(ws: WorkspaceAccess, id: string, body: DecideBrokerDealRequest, userId: string): Promise<BrokerDeal> {
    const orgId = this.orgOf(ws);
    const row = await this.ownDeal(id, (r) => r.orgId === orgId);
    const problem = moveProblem('decide', row.status);
    if (problem) throw new ConflictException(problem);
    const moved = await this.repo.decide(row.id, body.decision === 'accept', body.note?.trim() || null, userId);
    if (!moved) throw new ConflictException('This proposal changed while you were answering it. Reload to see it now.');
    return this.mustRead(row.id, kigaliToday());
  }

  async endByHotel(ws: WorkspaceAccess, id: string, body: EndBrokerDealRequest, userId: string): Promise<BrokerDeal> {
    const orgId = this.orgOf(ws);
    const row = await this.ownDeal(id, (r) => r.orgId === orgId);
    return this.close(row, 'end', 'hotel', body, userId);
  }

  // --- For bookings (0125) ----------------------------------------------------

  /** The broker behind a broker workspace, for the bookings service. */
  brokerFor(ws: WorkspaceAccess): Promise<BrokerSelfRow> {
    return this.brokerOf(ws);
  }

  /** This broker's running deal with a hotel today, or null: the only deal a booking is made under. */
  async runningDeal(brokerId: string, orgId: string): Promise<BrokerDeal | null> {
    const today = kigaliToday();
    const row = (await this.repo.forBroker(brokerId)).find(
      (r) => r.orgId === orgId && effectiveStatus(r.status, r.endsOn, today) === 'active',
    );
    return row ? this.present(row, today) : null;
  }

  // --- Shared -----------------------------------------------------------------

  private async close(
    row: DealRow,
    move: 'withdraw' | 'end',
    by: 'broker' | 'hotel',
    body: EndBrokerDealRequest,
    userId: string,
  ): Promise<BrokerDeal> {
    const today = kigaliToday();
    const status = effectiveStatus(row.status, row.endsOn, today);
    const problem = moveProblem(move, status);
    if (problem) throw new ConflictException(problem);
    const from = move === 'withdraw' ? 'proposed' : 'active';
    const moved = await this.repo.close(row.id, from, move === 'withdraw' ? 'withdrawn' : 'ended', by, body.note?.trim() || null, userId);
    if (!moved) throw new ConflictException('This deal changed in the meantime. Reload to see it now.');
    return this.mustRead(row.id, today);
  }

  private async brokerOf(ws: WorkspaceAccess): Promise<BrokerSelfRow> {
    if (ws.kind !== 'broker') throw new ForbiddenException('This is not a broker workspace.');
    const broker = await this.brokers.brokerForWorkspace(ws.workspaceId);
    if (!broker) throw new ForbiddenException('There is no broker registration here.');
    return broker;
  }

  private orgOf(ws: WorkspaceAccess): string {
    if (ws.kind !== 'business' || !ws.orgId) throw new ForbiddenException('This is not a business workspace.');
    return ws.orgId;
  }

  /** A deal the caller is a side of; anyone else's is not found. */
  private async ownDeal(id: string, mine: (row: DealRow) => boolean): Promise<DealRow> {
    const row = await this.repo.deal(id);
    if (!row || !mine(row)) throw new NotFoundException(NO_DEAL);
    return row;
  }

  private async mustRead(id: string, today: string): Promise<BrokerDeal> {
    const row = await this.repo.deal(id);
    if (!row) throw new NotFoundException(NO_DEAL);
    return this.present(row, today);
  }

  private present(row: DealRow, today: string): BrokerDeal {
    return {
      id: row.id,
      status: effectiveStatus(row.status, row.endsOn, today),
      terms: termsFromColumns(row),
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      note: row.note,
      broker: { id: row.brokerId, name: row.brokerName, phone: row.brokerPhone, email: row.brokerEmail },
      hotel: { orgId: row.orgId, name: row.hotelName, district: row.hotelDistrict },
      proposedAt: row.proposedAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      decisionNote: row.decisionNote,
      closedAt: row.closedAt?.toISOString() ?? null,
      closedBy: row.closedBy,
      closeNote: row.closeNote,
    };
  }

  private presentHotel(h: HotelRow): Omit<BrokerHotels['hotels'][number], 'deal'> {
    const label = h.businessKind ? (BUSINESS_KIND_LABEL as Record<string, string>)[h.businessKind] : undefined;
    return {
      orgId: h.orgId,
      name: h.name,
      kindLabel: label ?? null,
      stars: h.stars,
      district: h.district,
      sector: h.sector,
      roomTypes: h.roomTypes,
      fromRwf: h.fromRwf,
    };
  }
}
