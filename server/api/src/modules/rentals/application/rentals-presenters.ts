import {
  brokerFeeFrom,
  kigaliToday,
  leaseTab,
  type LeaseListItem,
  type LeaseVersionSummary,
  type PayoutAccountView,
  type RentalUnitView,
  type TenantLeaseSummary,
  type TenantView,
} from '@injishi/contracts';

import { leaseNextAction } from '../domain/lease-words';
import { destinationOf } from '../domain/payout-accounts';
import { unitOccupancy, type UnitLeaseFacts } from '../domain/units';
import type { LeaseRecord, VersionRow } from '../infrastructure/leases.repository';
import type { PayoutAccountRow } from '../infrastructure/payout-accounts.repository';
import type { TenantLeaseRow, TenantRow } from '../infrastructure/tenants.repository';
import type { UnitListRow } from '../infrastructure/units.repository';

/** The wire shapes of the rentals rows: one place, so every route answers alike. */

export function presentUnit(row: UnitListRow, leases: readonly UnitLeaseFacts[]): RentalUnitView {
  const occ = unitOccupancy(leases);
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    blockId: row.blockId,
    blockCode: row.blockCode,
    blockName: row.blockName,
    label: row.label,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    kitchen: row.kitchen,
    furnished: row.furnished,
    floor: row.floor,
    sizeSqm: row.sizeSqm,
    askingRentRwf: row.askingRentRwf,
    askingDepositRwf: row.askingDepositRwf,
    state: row.state,
    listed: row.listed,
    brokerOffer: row.brokerOffer,
    brokerFee: brokerFeeFrom(row.brokerFeeKind, row.brokerFeePercent, row.brokerFeeRwf),
    availableFrom: row.availableFrom,
    note: row.note,
    occupancy: occ.occupancy,
    currentLease: occ.current
      ? {
          id: occ.current.id,
          reference: occ.current.reference,
          status: occ.current.status,
          tenantName: occ.current.tenantName,
          startDate: occ.current.startDate,
          endDate: occ.current.endDate,
        }
      : null,
    vacantSince: occ.vacantSince,
    retiredAt: row.retiredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function presentTenant(row: TenantRow, leases: readonly TenantLeaseRow[], editable: boolean): TenantView {
  return {
    ...presentTenantRecord(row, editable),
    leases: leases.map(
      (l): TenantLeaseSummary => ({
        id: l.id,
        reference: l.reference,
        status: l.status,
        unitLabel: l.unitLabel,
        startDate: l.startDate,
        endDate: l.endDate,
      }),
    ),
  };
}

export function presentTenantRecord(row: TenantRow, editable: boolean): Omit<TenantView, 'leases'> {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    idKind: row.idKind,
    idNumber: row.idNumber,
    nationality: row.nationality,
    hasAccount: row.userId !== null,
    editable,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function presentLeaseListItem(r: LeaseRecord): LeaseListItem {
  return {
    id: r.lease.id,
    reference: r.lease.reference,
    status: r.lease.status,
    tab: leaseTab(r.lease.status),
    tenant: { id: r.tenant.id, fullName: r.tenant.fullName, email: r.tenant.email },
    unit: { id: r.lease.unitId, label: r.unitLabel, blockCode: r.blockCode, propertyName: r.propertyName },
    monthlyRentRwf: r.lease.monthlyRentRwf,
    startDate: r.lease.startDate,
    endDate: r.lease.endDate,
    nextAction: leaseNextAction(r.lease.status, { startDate: r.lease.startDate, today: kigaliToday() }),
    createdAt: r.lease.createdAt.toISOString(),
    updatedAt: r.lease.updatedAt.toISOString(),
  };
}

export function presentVersion(v: VersionRow): LeaseVersionSummary {
  return {
    id: v.id,
    version: v.version,
    templateVersion: v.templateVersion,
    contentHash: v.contentHash,
    createdAt: v.createdAt.toISOString(),
  };
}

export function presentPayoutAccount(row: PayoutAccountRow): PayoutAccountView {
  return {
    id: row.id,
    kind: row.kind,
    accountName: row.accountName,
    bankName: row.bankName,
    accountLast4: row.accountLast4,
    momoNetwork: row.momoNetwork,
    momoPhone: row.momoPhone,
    merchantCode: row.merchantCode,
    destination: destinationOf(row),
    isPrimary: row.isPrimary,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
