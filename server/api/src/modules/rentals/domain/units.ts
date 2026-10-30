import { addDays, type LeaseStatus, type UnitOccupancy, type UnitTab } from '@injishi/contracts';

/** A lease on a unit, as much as occupancy needs. */
export interface UnitLeaseFacts {
  id: string;
  reference: string;
  status: LeaseStatus;
  tenantName: string;
  startDate: string;
  endDate: string;
  endedOn: string | null;
}

export interface UnitOccupancyView {
  occupancy: UnitOccupancy;
  current: UnitLeaseFacts | null;
  vacantSince: string | null;
}

/**
 * Whether a unit is lived in, promised, or free, worked out from its leases
 * (blueprint 1.1: never stored).
 *
 *   occupied   a tenancy has started on it and not ended (active or ending)
 *   reserved   none has, but one is signed or out for signing
 *   vacant     neither; `vacantSince` is the day after the last tenancy ended
 *
 * Drafts and cancelled leases hold nothing.
 */
export function unitOccupancy(leases: readonly UnitLeaseFacts[]): UnitOccupancyView {
  const living = leases.find((l) => l.status === 'active' || l.status === 'ending');
  if (living) return { occupancy: 'occupied', current: living, vacantSince: null };
  const promised = leases
    .filter((l) => l.status === 'pending_signature' || l.status === 'signed')
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
  const lastEnd = leases
    .filter((l) => l.status === 'ended')
    .map((l) => l.endedOn ?? l.endDate)
    .sort()
    .at(-1);
  return {
    occupancy: promised ? 'reserved' : 'vacant',
    current: promised ?? null,
    vacantSince: lastEnd ? addDays(lastEnd, 1) : null,
  };
}

/** Which tabs of the units list a unit shows under, besides `all`. */
export function unitTabsOf(state: 'active' | 'off_market' | 'retired', occupancy: UnitOccupancy): UnitTab[] {
  if (state === 'retired') return ['retired'];
  const tabs: UnitTab[] = ['all'];
  if (state === 'off_market') tabs.push('off_market');
  if (occupancy === 'occupied') tabs.push('occupied');
  else if (state === 'active' && occupancy === 'vacant') tabs.push('vacant');
  return tabs;
}

/** A unit label as it is compared: case and spacing do not make two units different. */
export function comparableLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}
