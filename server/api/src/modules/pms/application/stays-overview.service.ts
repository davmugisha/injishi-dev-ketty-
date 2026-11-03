import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  addDays,
  BusinessKind,
  isStayKind,
  kigaliToday,
  staySize,
  type StayActivityItem,
  type StayActivityStatus,
  type StaysActivity,
  type StaysSummary,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { type StayActivityRow, StaysOverviewRepository } from '../infrastructure/stays-overview.repository';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The widest period the home asks for: last year and this one, plus a month ahead for the calendar. */
const MAX_DAYS = 800;

/**
 * A short-stay business's home (2026-10-29): how the business is run (`compact` up to twelve rooms, `full`
 * above), today's arrivals, departures and guests in house, and a period's stays and money for the home's
 * charts and calendar. Stay businesses only: a residence or a bar answers 404.
 */
@Injectable()
export class StaysOverviewService {
  constructor(private readonly reads: StaysOverviewRepository) {}

  async summary(ws: ScopedWorkspace, now: Date = new Date()): Promise<StaysSummary> {
    const properties = ws.branchScope.propertyIds;
    const today = kigaliToday(now);
    const [business, counts] = await Promise.all([
      this.reads.business(ws.workspaceId, properties),
      this.reads.counts(ws.workspaceId, properties, today),
    ]);
    const kind = this.stayKindOf(business?.kind);
    if (!business || !kind) throw new NotFoundException('This is not a stay business.');
    return {
      today,
      business: {
        orgName: business.orgName,
        kind,
        size: staySize(business.rooms),
        rooms: business.rooms,
        roomTypes: business.roomTypes,
        properties: business.properties,
        propertyName: business.propertyName,
      },
      counts,
    };
  }

  async activity(ws: ScopedWorkspace, query: { from?: string; to?: string }, now: Date = new Date()): Promise<StaysActivity> {
    const properties = ws.branchScope.propertyIds;
    const today = kigaliToday(now);
    const [y] = today.split('-').map(Number) as [number];
    const from = query.from ?? `${y - 1}-01-01`;
    const to = query.to ?? addDays(today, 45);
    if (!DAY.test(from) || !DAY.test(to) || from > to) throw new BadRequestException('from and to must be days, from first.');
    if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > MAX_DAYS) {
      throw new BadRequestException(`Ask for at most ${MAX_DAYS} days at a time.`);
    }
    const [business, stays, payments] = await Promise.all([
      this.reads.business(ws.workspaceId, properties),
      this.reads.stays(ws.workspaceId, properties, from, to),
      this.reads.payments(ws.workspaceId, properties, from, to),
    ]);
    if (!business || !this.stayKindOf(business.kind)) throw new NotFoundException('This is not a stay business.');
    return { from, to, today, rooms: business.rooms, stays: stays.map(present), payments };
  }

  private stayKindOf(kind: string | undefined): BusinessKind | null {
    const parsed = BusinessKind.safeParse(kind);
    return parsed.success && isStayKind(parsed.data) ? parsed.data : null;
  }
}

function statusOf(r: StayActivityRow): StayActivityStatus {
  if (r.stayLifecycle === 'open') return 'in_house';
  if (r.stayLifecycle === 'closed') return 'checked_out';
  if (r.bookingStatus === 'pending_approval') return 'requested';
  if (r.bookingStatus === 'cancelled' || r.bookingStatus === 'declined') return 'cancelled';
  if (r.bookingStatus === 'no_show') return 'no_show';
  return 'confirmed';
}

function present(r: StayActivityRow): StayActivityItem {
  return {
    id: r.id,
    source: r.source,
    reference: r.reference,
    guestName: r.guestName?.trim() || 'Guest',
    roomTypeName: r.roomTypeName,
    roomLabel: r.roomLabel,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    status: statusOf(r),
    channel: r.channel,
    nightlyRwf: Math.max(0, r.nightlyRwf),
    totalRwf: Math.max(0, r.totalRwf),
  };
}
