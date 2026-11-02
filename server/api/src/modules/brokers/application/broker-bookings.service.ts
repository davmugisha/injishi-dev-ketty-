import {
  kigaliToday,
  type BrokerBookingGroup,
  type BrokerBookingList,
  type BrokerRoomOffer,
  type CreateBrokerBookingRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { BrokerGroupBookingService, type BrokerBookingContext } from '../../pms/application/broker-group-booking.service';
import { BrokerDealsService } from './broker-deals.service';

/**
 * A broker's bookings at hotels (0125, phase 2): the broker's door to `BrokerGroupBookingService`. Here the
 * broker is resolved from their own workspace and the deal from what is running between them and the hotel;
 * the booking service never takes either from a request. A hotel without a running deal is not open for
 * booking, so a broker reads the rooms of a hotel only once it has accepted their terms.
 */
@Injectable()
export class BrokerBookingsService {
  constructor(
    private readonly deals: BrokerDealsService,
    private readonly bookings: BrokerGroupBookingService,
  ) {}

  async rooms(ws: WorkspaceAccess, orgId: string, checkIn: string, checkOut: string): Promise<BrokerRoomOffer> {
    return this.bookings.offer(await this.context(ws, orgId), checkIn, checkOut);
  }

  async create(ws: WorkspaceAccess, orgId: string, body: CreateBrokerBookingRequest): Promise<BrokerBookingGroup> {
    const ctx = await this.context(ws, orgId);
    if (ctx.deal.startsOn && ctx.deal.startsOn > kigaliToday()) {
      throw new ConflictException(`Your deal with ${ctx.deal.hotel.name} starts on ${ctx.deal.startsOn}. Book from then.`);
    }
    return this.bookings.create(ctx, body);
  }

  async list(ws: WorkspaceAccess): Promise<BrokerBookingList> {
    const broker = await this.deals.brokerFor(ws);
    return { groups: await this.bookings.list(broker.id) };
  }

  async get(ws: WorkspaceAccess, groupId: string): Promise<BrokerBookingGroup> {
    const broker = await this.deals.brokerFor(ws);
    return this.bookings.get(broker.id, groupId);
  }

  private async context(ws: WorkspaceAccess, orgId: string): Promise<BrokerBookingContext> {
    const broker = await this.deals.brokerFor(ws);
    if (broker.status !== 'active') {
      throw new ForbiddenException('Your broker registration is suspended, so you cannot book.');
    }
    const deal = await this.deals.runningDeal(broker.id, orgId);
    if (!deal) throw new NotFoundException('You have no running deal with that hotel. Agree one before you book.');
    return { brokerId: broker.id, brokerUserId: broker.userId, deal };
  }
}
