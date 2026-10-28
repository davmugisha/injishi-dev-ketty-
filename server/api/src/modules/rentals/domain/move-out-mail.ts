import { MOVE_OUT_APP_PATHS, formatRwf, longDate } from '@injishi/contracts';

import { homeWords, type RentalsMail } from './rentals-mail';

/**
 * The moving out emails (WP 1.7): one fact each, plain words, RWF amounts,
 * one link. Pure, so a test reads exactly what a tenant or a landlord gets.
 */

export interface MoveOutMailHome {
  unitLabel: string;
  propertyName: string;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function tenantMoveOutLink(appUrl: string, leaseId: string): string {
  return new URL(MOVE_OUT_APP_PATHS.tenantMoveOut(leaseId), appUrl).toString();
}

export function landlordMoveOutsLink(appUrl: string, tab?: Parameters<typeof MOVE_OUT_APP_PATHS.landlordMoveOuts>[0]): string {
  return new URL(MOVE_OUT_APP_PATHS.landlordMoveOuts(tab), appUrl).toString();
}

/** The landlord hears that a tenant gave notice on Injishi. */
export function noticeFiledLandlordMail(input: {
  appUrl: string;
  tenantName: string;
  reference: string;
  home: MoveOutMailHome;
  moveOutOn: string;
  reason: string;
  message: string | null;
}): RentalsMail {
  const lines = [
    `${input.tenantName} gave notice on lease ${input.reference} for ${homeWords(input.home)}.`,
    `They plan to move out on ${longDate(input.moveOutOn)}.`,
    `Reason: ${input.reason}.`,
  ];
  if (input.message) lines.push(`Their message: ${input.message}`);
  lines.push('Acknowledge it so they know you have it.');
  return {
    subject: `${input.tenantName} gave notice to move out`,
    heading: 'A tenant gave notice',
    lines,
    action: { label: 'Open move-outs', url: landlordMoveOutsLink(input.appUrl, 'to_acknowledge') },
  };
}

/** The landlord hears that a tenant took their notice back. */
export function noticeWithdrawnLandlordMail(input: { appUrl: string; tenantName: string; reference: string; home: MoveOutMailHome }): RentalsMail {
  return {
    subject: `${input.tenantName} withdrew their notice`,
    heading: 'A notice was withdrawn',
    lines: [`${input.tenantName} withdrew their notice on lease ${input.reference} for ${homeWords(input.home)}. The lease runs on as before.`],
    action: { label: 'Open move-outs', url: landlordMoveOutsLink(input.appUrl) },
  };
}

/** A reminder about a notice still to acknowledge after 3 days. */
export function noticeNudgeLandlordMail(input: {
  appUrl: string;
  tenantName: string;
  reference: string;
  home: MoveOutMailHome;
  filedOn: string;
  moveOutOn: string;
}): RentalsMail {
  return {
    subject: `Acknowledge ${input.tenantName}'s notice`,
    heading: 'A notice is waiting for you',
    lines: [
      `${input.tenantName} gave notice on ${longDate(input.filedOn)} for ${homeWords(input.home)} (lease ${input.reference}).`,
      `They plan to move out on ${longDate(input.moveOutOn)}. Acknowledge it so they know you have it.`,
    ],
    action: { label: 'Acknowledge the notice', url: landlordMoveOutsLink(input.appUrl, 'to_acknowledge') },
  };
}

/** The tenant hears that the landlord acknowledged their notice. */
export function noticeAcknowledgedTenantMail(input: {
  appUrl: string;
  leaseId: string;
  tenantName: string;
  landlordName: string;
  home: MoveOutMailHome;
  moveOutOn: string;
  depositHeldRwf: number;
}): RentalsMail {
  const lines = [
    `Hello ${firstName(input.tenantName)},`,
    `${input.landlordName} acknowledged your notice for ${homeWords(input.home)}.`,
    `Your move out date is ${longDate(input.moveOutOn)}.`,
  ];
  if (input.depositHeldRwf > 0) {
    lines.push(`Your landlord holds your deposit of ${formatRwf(input.depositHeldRwf)}. They settle it after you move out.`);
  }
  return {
    subject: 'Your notice was acknowledged',
    heading: 'Your notice was acknowledged',
    lines,
    action: { label: 'See moving out', url: tenantMoveOutLink(input.appUrl, input.leaseId) },
  };
}

/** The tenant hears that the landlord recorded a notice for them (a letter, an email, in person). */
export function noticeRecordedTenantMail(input: {
  appUrl: string;
  leaseId: string;
  tenantName: string;
  landlordName: string;
  home: MoveOutMailHome;
  moveOutOn: string;
  givenBy: 'tenant' | 'landlord';
}): RentalsMail {
  const line =
    input.givenBy === 'tenant'
      ? `${input.landlordName} recorded your notice for ${homeWords(input.home)}.`
      : `${input.landlordName} gave you notice for ${homeWords(input.home)}.`;
  return {
    subject: input.givenBy === 'tenant' ? 'Your notice was recorded' : 'You were given notice',
    heading: input.givenBy === 'tenant' ? 'Your notice was recorded' : 'You were given notice',
    lines: [`Hello ${firstName(input.tenantName)},`, line, `The move out date is ${longDate(input.moveOutOn)}.`],
    action: { label: 'See moving out', url: tenantMoveOutLink(input.appUrl, input.leaseId) },
  };
}

/** The tenant hears the landlord recorded their move out. */
export function movedOutTenantMail(input: {
  appUrl: string;
  leaseId: string;
  tenantName: string;
  landlordName: string;
  home: MoveOutMailHome;
  movedOutOn: string;
  waivedRwf: number;
  depositHeldRwf: number;
}): RentalsMail {
  const lines = [
    `Hello ${firstName(input.tenantName)},`,
    `${input.landlordName} recorded that you moved out of ${homeWords(input.home)} on ${longDate(input.movedOutOn)}. The lease has ended.`,
  ];
  if (input.waivedRwf > 0) lines.push(`Rent of ${formatRwf(input.waivedRwf)} for after that day was cancelled.`);
  if (input.depositHeldRwf > 0) lines.push(`Your deposit of ${formatRwf(input.depositHeldRwf)} is settled next. You will get the breakdown by email.`);
  return {
    subject: 'Your move out was recorded',
    heading: 'You moved out',
    lines,
    action: { label: 'See moving out', url: tenantMoveOutLink(input.appUrl, input.leaseId) },
  };
}

/** The tenant gets the deposit breakdown. */
export function depositSettledTenantMail(input: {
  appUrl: string;
  leaseId: string;
  tenantName: string;
  landlordName: string;
  home: MoveOutMailHome;
  paidRwf: number;
  deductions: { label: string; amountRwf: number }[];
  keptRwf: number;
  refundedRwf: number;
  refund: { method: 'gateway' | 'recorded' | 'none'; destination?: string | null; reference?: string | null };
}): RentalsMail {
  const lines = [
    `Hello ${firstName(input.tenantName)},`,
    `${input.landlordName} settled your deposit of ${formatRwf(input.paidRwf)} for ${homeWords(input.home)}.`,
  ];
  if (input.deductions.length > 0) {
    lines.push(`Kept: ${formatRwf(input.keptRwf)}.`);
    for (const d of input.deductions) lines.push(`${d.label}: ${formatRwf(d.amountRwf)}`);
  } else {
    lines.push('Nothing was kept.');
  }
  if (input.refundedRwf > 0) {
    if (input.refund.method === 'gateway') {
      lines.push(`Refunded: ${formatRwf(input.refundedRwf)} to ${input.refund.destination ?? 'your MoMo'}, through Injishi.`);
    } else {
      lines.push(
        `Refunded: ${formatRwf(input.refundedRwf)}, paid to you outside Injishi${input.refund.reference ? ` (reference ${input.refund.reference})` : ''}.`,
      );
    }
  } else {
    lines.push('Nothing was refunded.');
  }
  lines.push('If you do not agree, you can say so on the moving out page.');
  return {
    subject: 'Your deposit was settled',
    heading: 'Your deposit was settled',
    lines,
    action: { label: 'See the breakdown', url: tenantMoveOutLink(input.appUrl, input.leaseId) },
  };
}

/** The landlord hears that the refund through Injishi was refused or expired. */
export function depositRefundFailedLandlordMail(input: {
  appUrl: string;
  tenantName: string;
  reference: string;
  amountRwf: number;
  reason: string;
}): RentalsMail {
  return {
    subject: `The deposit refund to ${input.tenantName} did not go through`,
    heading: 'The refund did not go through',
    lines: [
      `The refund of ${formatRwf(input.amountRwf)} to ${input.tenantName} on lease ${input.reference} did not go through.`,
      input.reason,
      'Settle the deposit again to retry, or record a refund you paid outside Injishi.',
    ],
    action: { label: 'Open move-outs', url: landlordMoveOutsLink(input.appUrl, 'moved_out') },
  };
}

/** The landlord hears that the tenant disputes the settlement. */
export function depositDisputedLandlordMail(input: {
  appUrl: string;
  tenantName: string;
  reference: string;
  home: MoveOutMailHome;
  note: string;
}): RentalsMail {
  return {
    subject: `${input.tenantName} disputes the deposit settlement`,
    heading: 'A deposit settlement is disputed',
    lines: [
      `${input.tenantName} does not agree with the deposit settlement on lease ${input.reference} for ${homeWords(input.home)}.`,
      `What they said: ${input.note}`,
      'Talk it through with them in Messages.',
    ],
    action: { label: 'Open move-outs', url: landlordMoveOutsLink(input.appUrl, 'settled') },
  };
}
