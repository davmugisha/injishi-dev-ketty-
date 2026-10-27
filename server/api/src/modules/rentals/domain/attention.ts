import type { RentalsAttentionItem, RentalsSummary } from '@injishi/contracts';

import type { BranchScope } from '../../../shared/auth/branch-scope';

/** The buildings a branch scope covers, as a list for a read; null for every building of the workspace. */
export function buildingIdsOf(scope: BranchScope): readonly string[] | null {
  if (scope.selectedPropertyId) return [scope.selectedPropertyId];
  if (scope.coverage === 'all') return null;
  return scope.propertyIds;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const rwf = (n: number): string => `RWF ${Math.round(n).toLocaleString('en-US')}`;

/**
 * "Needs attention" on the landlord's home, from the summary's counts, in the order it is worked:
 * setup and getting paid first (nothing else works without them), then money late, then what waits
 * on the landlord, then what waits on someone else. Only kinds with something to do are listed.
 */
export function attentionItems(
  counts: RentalsSummary['counts'],
  setup: RentalsSummary['setup'],
  hasPayoutAccount: boolean,
): RentalsAttentionItem[] {
  const items: RentalsAttentionItem[] = [];
  const left = setup.total - setup.done;
  if (!setup.complete && left > 0) {
    items.push({
      kind: 'setup_incomplete',
      count: left,
      amountRwf: null,
      title: `Finish setting up: ${plural(left, 'step', 'steps')} left`,
      detail: `${setup.done} of ${setup.total} done`,
      tone: 'warning',
    });
  }
  if (!hasPayoutAccount) {
    items.push({
      kind: 'no_payout_account',
      count: 1,
      amountRwf: null,
      title: 'Add where rent is paid out',
      detail: 'Rent paid through Injishi is held until you do.',
      tone: 'warning',
    });
  }
  if (counts.overdueCharges > 0) {
    items.push({
      kind: 'overdue_rent',
      count: counts.overdueCharges,
      amountRwf: counts.overdueRwf,
      title: `${rwf(counts.overdueRwf)} of rent is overdue`,
      detail: plural(counts.overdueCharges, 'charge', 'charges') + ' past the grace days',
      tone: 'danger',
    });
  }
  if (counts.filingsLate > 0 || counts.filingsDue > 0) {
    const late = counts.filingsLate;
    items.push({
      kind: 'filings_due',
      count: counts.filingsDue,
      amountRwf: null,
      title: late > 0 ? `${plural(late, 'lease', 'leases')} late to file with RRA` : `${plural(counts.filingsDue, 'lease', 'leases')} to file with RRA`,
      detail: 'File a copy within 15 days of signing.',
      tone: late > 0 ? 'danger' : 'warning',
    });
  }
  if (counts.leasesToSign > 0) {
    items.push({
      kind: 'leases_to_sign',
      count: counts.leasesToSign,
      amountRwf: null,
      title: `${plural(counts.leasesToSign, 'lease waits', 'leases wait')} for your signature`,
      detail: null,
      tone: 'warning',
    });
  }
  if (counts.readyToStart > 0) {
    items.push({
      kind: 'ready_to_start',
      count: counts.readyToStart,
      amountRwf: null,
      title: `${plural(counts.readyToStart, 'tenancy is', 'tenancies are')} ready to start`,
      detail: 'Signed by both sides.',
      tone: 'warning',
    });
  }
  if (counts.noticesToAcknowledge > 0) {
    items.push({
      kind: 'notices_to_acknowledge',
      count: counts.noticesToAcknowledge,
      amountRwf: null,
      title: `${plural(counts.noticesToAcknowledge, 'move out notice', 'move out notices')} to acknowledge`,
      detail: null,
      tone: 'warning',
    });
  }
  if (counts.waitingForTenant > 0) {
    items.push({
      kind: 'waiting_for_tenant',
      count: counts.waitingForTenant,
      amountRwf: null,
      title: `${plural(counts.waitingForTenant, 'lease waits', 'leases wait')} for the tenant to sign`,
      detail: null,
      tone: 'info',
    });
  }
  return items;
}
