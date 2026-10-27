import {
  FAULT_APP_PATHS,
  FAULT_REOPEN_DAYS,
  FAULT_STATUS_LABEL,
  formatRwf,
  longDate,
  type MaintenanceStatus,
} from '@injishi/contracts';

import { homeWords, type RentalsMail } from './rentals-mail';

/**
 * The fault emails (WP 4.1): one fact each, plain words, one link. Pure, so a
 * test reads exactly what a tenant or a landlord gets.
 */

export interface FaultMailHome {
  unitLabel: string;
  propertyName: string;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function tenantFaultsLink(appUrl: string, leaseId: string): string {
  return new URL(FAULT_APP_PATHS.tenantFaults(leaseId), appUrl).toString();
}

export function landlordFaultLink(appUrl: string, ticketId: string): string {
  return new URL(FAULT_APP_PATHS.landlordFault(ticketId), appUrl).toString();
}

/** What the tenant is told when their fault moves. */
export function faultMovedTenantMail(input: {
  appUrl: string;
  leaseId: string;
  tenantName: string;
  landlordName: string;
  home: FaultMailHome;
  title: string;
  to: MaintenanceStatus;
  /** Who is fixing it, for an assignment. */
  assigneeName?: string | null;
  /** The landlord's note, or the reason for "won't fix". */
  note?: string | null;
}): RentalsMail {
  const what = `"${input.title}"`;
  const where = homeWords(input.home);
  const sentence: Record<MaintenanceStatus, string> = {
    open: `${input.landlordName} reopened your report ${what} for ${where}.`,
    acknowledged: `${input.landlordName} has seen your report ${what} for ${where}.`,
    assigned: input.assigneeName
      ? `${input.assigneeName} is assigned to fix ${what} at ${where}.`
      : `Someone is assigned to fix ${what} at ${where}.`,
    in_progress: `Work has started on ${what} at ${where}.`,
    resolved: `${input.landlordName} marked ${what} at ${where} fixed.`,
    closed: `${input.landlordName} closed ${what} at ${where}.`,
    wont_fix: `${input.landlordName} won't fix ${what} at ${where}.`,
    cancelled: `${input.landlordName} cancelled ${what} at ${where}.`,
  };
  const lines = [`Hello ${firstName(input.tenantName)},`, sentence[input.to]];
  if (input.note?.trim()) lines.push(`${input.to === 'wont_fix' ? 'The reason they gave' : 'Their note'}: ${input.note.trim()}`);
  if (input.to === 'resolved' || input.to === 'wont_fix') {
    lines.push(`If it is not right, you can reopen it on Injishi within ${FAULT_REOPEN_DAYS} days.`);
  }
  return {
    subject: `Your repair: ${FAULT_STATUS_LABEL[input.to]}`,
    heading: input.to === 'resolved' ? 'Marked fixed' : 'Your repair has moved on',
    lines,
    action: { label: 'See your repairs', url: tenantFaultsLink(input.appUrl, input.leaseId) },
  };
}

/** The landlord replied on a fault, for the tenant. */
export function faultReplyTenantMail(input: {
  appUrl: string;
  leaseId: string;
  tenantName: string;
  landlordName: string;
  title: string;
  body: string;
}): RentalsMail {
  return {
    subject: `A reply about "${input.title}"`,
    heading: 'A reply about your repair',
    lines: [`Hello ${firstName(input.tenantName)},`, `${input.landlordName} wrote about "${input.title}":`, input.body],
    action: { label: 'See your repairs', url: tenantFaultsLink(input.appUrl, input.leaseId) },
  };
}

/** A tenant reported a fault, for the landlord. */
export function faultReportedLandlordMail(input: {
  appUrl: string;
  ticketId: string;
  tenantName: string;
  home: FaultMailHome;
  title: string;
  urgencyWords: string;
  description: string | null;
  photoCount: number;
  reportedOn: string;
}): RentalsMail {
  const lines = [
    `${input.tenantName} reported a fault at ${homeWords(input.home)} on ${longDate(input.reportedOn)}: "${input.title}".`,
    `How urgent: ${input.urgencyWords}.`,
  ];
  if (input.description) lines.push(input.description);
  if (input.photoCount > 0) lines.push(`${input.photoCount} ${input.photoCount === 1 ? 'photo is' : 'photos are'} attached to the report.`);
  lines.push('Mark it seen so the tenant knows you have it.');
  return {
    subject: `New fault at ${homeWords(input.home)}: ${input.title}`,
    heading: 'A fault was reported',
    lines,
    action: { label: 'Open the fault', url: landlordFaultLink(input.appUrl, input.ticketId) },
  };
}

/** The tenant reopened a fault, for the landlord. */
export function faultReopenedLandlordMail(input: {
  appUrl: string;
  ticketId: string;
  tenantName: string;
  home: FaultMailHome;
  title: string;
  reason: string;
}): RentalsMail {
  return {
    subject: `Reopened at ${homeWords(input.home)}: ${input.title}`,
    heading: 'A fault was reopened',
    lines: [`${input.tenantName} says "${input.title}" at ${homeWords(input.home)} is not fixed.`, `What they wrote: ${input.reason}`],
    action: { label: 'Open the fault', url: landlordFaultLink(input.appUrl, input.ticketId) },
  };
}

/** The tenant wrote on a fault, for the landlord. */
export function faultMessageLandlordMail(input: {
  appUrl: string;
  ticketId: string;
  tenantName: string;
  home: FaultMailHome;
  title: string;
  body: string;
}): RentalsMail {
  return {
    subject: `${input.tenantName} wrote about "${input.title}"`,
    heading: 'A message about a fault',
    lines: [`${input.tenantName} wrote about "${input.title}" at ${homeWords(input.home)}:`, input.body],
    action: { label: 'Open the fault', url: landlordFaultLink(input.appUrl, input.ticketId) },
  };
}

// --- Paying the fixer (WP 4.3) ---------------------------------------------------------

/** The landlord's phone approved, and the fixer has the money. */
export function fixerPaidLandlordMail(input: {
  appUrl: string;
  ticketId: string;
  title: string;
  home: FaultMailHome;
  amountRwf: number;
  payeeName: string;
  destination: string | null;
  paidOn: string;
}): RentalsMail {
  return {
    subject: `You paid ${input.payeeName} ${formatRwf(input.amountRwf)} for "${input.title}"`,
    heading: 'The fixer was paid',
    lines: [
      `${formatRwf(input.amountRwf)} went to ${input.payeeName}${input.destination ? ` (${input.destination})` : ''} on ${longDate(input.paidOn)} for "${input.title}" at ${homeWords(input.home)}.`,
      'It is written down as a repairs expense, so it shows in your expenses and on your tax page.',
    ],
    action: { label: 'Open the fault', url: landlordFaultLink(input.appUrl, input.ticketId) },
  };
}

/** The payment to the fixer did not go through. */
export function fixerPaymentFailedLandlordMail(input: {
  appUrl: string;
  ticketId: string;
  title: string;
  amountRwf: number;
  payeeName: string;
  reason: string;
}): RentalsMail {
  return {
    subject: `Your payment to ${input.payeeName} did not go through`,
    heading: 'The payment did not go through',
    lines: [
      `Your payment of ${formatRwf(input.amountRwf)} to ${input.payeeName} for "${input.title}" did not go through.`,
      input.reason,
      'You can pay again from the fault, or record a payment you made another way.',
    ],
    action: { label: 'Open the fault', url: landlordFaultLink(input.appUrl, input.ticketId) },
  };
}
