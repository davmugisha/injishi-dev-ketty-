/**
 * PSF membership mail (ADR-056 AC-9, AC-11, AC-12, AC-18, and the PSF path).
 *
 * Seven messages, in the same layout as registration mail (`compose`). Since
 * the PSF path, the business pays its membership fee through Injishi: the
 * approval mail asks for it, and the member mail is the receipt.
 */
import { PSF_FEE_NOTICE } from '@injishi/contracts';

import {
  compose,
  greeting,
  money,
  type Addressee,
  type RegistrationMail,
} from './registration-mail';

/** The business's PSF membership page, inside the operator zone on web's origin. */
export function psfMembershipLink(webUrl: string, workspaceId: string | null): string {
  return workspaceId
    ? new URL(`/w/${workspaceId}/psf-membership`, webUrl).toString()
    : new URL('/start', webUrl).toString();
}

/** The PSF membership officer's queue. */
export function psfQueueLink(webUrl: string): string {
  return new URL('/oversight/membership/queue', webUrl).toString();
}

export function psfApplicationReceivedMail(input: {
  to: Addressee;
  legalName: string;
  tierName: string;
  withPsf: boolean;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `We received your PSF membership application for ${input.legalName}`,
    heading: 'PSF application received',
    greeting: greeting(input.to),
    paragraphs: [
      `Your application to join the Private Sector Federation (PSF) as ${input.tierName} is saved.`,
      input.withPsf
        ? 'It is now with a PSF membership officer, who will review it.'
        : 'It goes to PSF as soon as the Rwanda Revenue Authority has checked your TIN. You do not need to do anything.',
      PSF_FEE_NOTICE,
    ],
    cta: { label: 'See your application', href: input.link },
  });
}

export function psfOfficerQueueMail(input: {
  to: Addressee;
  legalName: string;
  districtName: string | null;
  tierName: string;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `New PSF membership application: ${input.legalName}`,
    heading: 'A membership application is waiting',
    greeting: greeting(input.to),
    paragraphs: ['A business has applied to join PSF and is waiting in your membership queue.'],
    details: [
      ['Business', input.legalName],
      ['District', input.districtName ?? 'Not recorded'],
      ['Tier asked for', input.tierName],
    ],
    cta: { label: 'Open the membership queue', href: input.link },
  });
}

/** PSF approved: the business now pays, from its portal. */
export function psfApprovedMail(input: {
  to: Addressee;
  legalName: string;
  tierName: string;
  membershipNumber: string;
  feeRwf: number;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `PSF approved ${input.legalName}: pay to become a member`,
    heading: 'PSF approved your application',
    greeting: greeting(input.to),
    paragraphs: [
      `A PSF membership officer approved ${input.legalName} as ${input.tierName}.`,
      'Pay the membership fee by mobile money from your portal. Your membership starts the day you pay, and lasts a year.',
    ],
    details: [
      ['Tier', input.tierName],
      ['Membership number', input.membershipNumber],
      ['To pay', money(input.feeRwf)],
    ],
    after: [PSF_FEE_NOTICE],
    cta: { label: 'Pay your membership', href: input.link },
  });
}

/** Paid, and so a member: the receipt and the welcome in one. */
export function psfMemberMail(input: {
  to: Addressee;
  legalName: string;
  tierName: string;
  membershipNumber: string;
  annualFeeRwf: number;
  startsOn: string;
  expiresOn: string;
  /** The payment reference, when the fee was paid through Injishi. */
  paymentReference: string | null;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `${input.legalName} is now a PSF member`,
    heading: 'Welcome to PSF',
    greeting: greeting(input.to),
    paragraphs: [
      input.paymentReference
        ? `We received your payment, and ${input.legalName} is now a member of the Private Sector Federation.`
        : `PSF has accepted ${input.legalName} as a member.`,
    ],
    details: [
      ['Tier', input.tierName],
      ['Membership number', input.membershipNumber],
      [input.paymentReference ? 'Paid' : 'Annual fee', money(input.annualFeeRwf)],
      ...(input.paymentReference ? ([['Payment reference', input.paymentReference]] as [string, string][]) : []),
      ['Valid', `${input.startsOn} to ${input.expiresOn}`],
    ],
    after: ['The fee goes to PSF. Injishi keeps none of it.'],
    cta: { label: 'See your membership', href: input.link },
  });
}

export function psfDeclinedMail(input: {
  to: Addressee;
  legalName: string;
  reasonLabel: string;
  note: string | null;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `Your PSF membership application for ${input.legalName} was declined`,
    heading: 'PSF application declined',
    greeting: greeting(input.to),
    paragraphs: [
      'A PSF membership officer declined this application.',
      'You can correct it and apply again from your workspace.',
    ],
    details: [
      ['Reason', input.reasonLabel],
      ...(input.note ? ([['From the officer', input.note]] as [string, string][]) : []),
    ],
    cta: { label: 'Apply again', href: input.link },
  });
}

export function psfExpiringMail(input: {
  to: Addressee;
  legalName: string;
  membershipNumber: string;
  expiresOn: string;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `Your PSF membership for ${input.legalName} ends on ${input.expiresOn}`,
    heading: 'Your PSF membership ends soon',
    greeting: greeting(input.to),
    paragraphs: [
      `Membership ${input.membershipNumber} ends on ${input.expiresOn}.`,
      'To stay a member, apply again from your workspace before then.',
    ],
    cta: { label: 'Renew your membership', href: input.link },
  });
}

export function psfExpiredMail(input: {
  to: Addressee;
  legalName: string;
  membershipNumber: string;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `Your PSF membership for ${input.legalName} has ended`,
    heading: 'Your PSF membership has ended',
    greeting: greeting(input.to),
    paragraphs: [
      `Membership ${input.membershipNumber} has reached its end date, so ${input.legalName} is no longer shown as a PSF member.`,
      'You can apply again from your workspace at any time.',
    ],
    cta: { label: 'Apply again', href: input.link },
  });
}
