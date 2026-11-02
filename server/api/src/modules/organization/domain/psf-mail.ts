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

/**
 * Where an owner with an account follows its PSF membership when it has no docID to track (2026-11-02):
 * Compliance in the app, which shows its PSF standing. The old `/w/<id>/psf-membership` on web opened
 * nothing: web has no such page, and it fell through to the person's home.
 */
export function psfMembershipLink(appUrl: string): string {
  return new URL('/compliance', appUrl).toString();
}

/** The public tracking page an applicant with no account follows (2026-10-19). */
export function psfTrackLink(webUrl: string, docId: string): string {
  return new URL(`/psf/track/${encodeURIComponent(docId)}`, webUrl).toString();
}

/** A membership's card (2026-11-02): the page the certificate's QR code opens, by membership number. */
export function psfCardLink(webUrl: string, membershipNumber: string): string {
  const url = new URL('/psf/card', webUrl);
  url.searchParams.set('number', membershipNumber);
  return url.toString();
}

/** One application in the PSF console (2026-11-02), where the officer decides it. The app, not web. */
export function psfApplicationLink(appUrl: string, applicationId: string): string {
  return new URL(`/psf/${encodeURIComponent(applicationId)}`, appUrl).toString();
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
        ? 'It is now with a PSF District Manager, who will review it.'
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
  /** Where it was sent from (2026-11-02): the public PSF form, or Injishi's business registration. */
  origin: 'psf_form' | 'registration';
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
      ['Sent from', input.origin === 'psf_form' ? 'The PSF form (no Injishi account)' : 'Injishi business registration'],
    ],
    cta: { label: 'Open the application', href: input.link },
  });
}

/** PSF approved: the business now pays, from the link. */
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
      `A PSF District Manager approved ${input.legalName} as ${input.tierName}.`,
      'Pay the membership fee by mobile money from the link below. Your membership starts the day you pay, and lasts a year.',
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
      'A PSF District Manager declined this application. Your business keeps its code.',
      'You can correct it and apply again.',
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
      'To stay a member, renew before then. Renewing early loses nothing: the new year starts the day this one ends.',
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
      'You can renew at any time: the new year starts on the day you pay, under the same membership number.',
    ],
    cta: { label: 'Renew membership', href: input.link },
  });
}

/** An officer's reminder (2026-11-02): the application is saved, and PSF reviews it once it is paid. */
export function psfPaymentReminderMail(input: { to: Addressee; legalName: string; amountRwf: number | null; link: string }): RegistrationMail {
  return compose({
    subject: `Your PSF application for ${input.legalName} is waiting for its payment`,
    heading: 'One step left: the payment',
    greeting: greeting(input.to),
    paragraphs: [
      `Your application to join PSF for ${input.legalName} is saved, but the payment did not go through. PSF reviews only paid applications.`,
      'Open your application, pay by mobile money, and it goes straight to your district’s PSF office.',
    ],
    details: input.amountRwf ? [['To pay', money(input.amountRwf)]] : [],
    cta: { label: 'Pay and send to PSF', href: input.link },
  });
}

/** A renewal was paid (2026-11-02): the membership carries on, with no officer's decision. */
export function psfRenewedMail(input: {
  to: Addressee;
  legalName: string;
  membershipNumber: string;
  tierName: string;
  amountRwf: number;
  startsOn: string;
  expiresOn: string;
  paymentReference: string;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `Your PSF membership for ${input.legalName} is renewed until ${input.expiresOn}`,
    heading: 'Your PSF membership is renewed',
    greeting: greeting(input.to),
    paragraphs: [`Thank you. ${input.legalName} stays a PSF member, under the same membership number.`],
    details: [
      ['Membership number', input.membershipNumber],
      ['Tier', input.tierName],
      ['Paid', money(input.amountRwf)],
      ['Payment reference', input.paymentReference],
      ['Valid', `${input.startsOn} to ${input.expiresOn}`],
    ],
    after: ['The fee goes to PSF. Injishi keeps none of it.'],
    cta: { label: 'See your membership', href: input.link },
  });
}

/** PSF confirmed the membership number a business typed (0121): it now shows as a member. */
export function psfClaimConfirmedMail(input: {
  to: Addressee;
  legalName: string;
  membershipNumber: string;
  expiresOn: string;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `PSF confirmed the membership of ${input.legalName}`,
    heading: 'Your PSF membership is confirmed',
    greeting: greeting(input.to),
    paragraphs: [
      `PSF has checked membership number ${input.membershipNumber} against its records. ${input.legalName} now shows as a PSF member on Injishi, until ${input.expiresOn}.`,
    ],
    cta: { label: 'See your membership', href: input.link },
  });
}

/** PSF could not confirm the number a business typed (0121): why, and how to become a member. */
export function psfClaimRejectedMail(input: {
  to: Addressee;
  legalName: string;
  membershipNumber: string;
  reason: string;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `PSF could not confirm the membership of ${input.legalName}`,
    heading: 'PSF could not confirm your membership number',
    greeting: greeting(input.to),
    paragraphs: [
      `PSF checked membership number ${input.membershipNumber} for ${input.legalName} and could not confirm it.`,
      `PSF's reason: ${input.reason}`,
      'If the number was mistyped, contact your PSF district office. You can also apply for membership from your portal.',
    ],
    cta: { label: 'Apply for membership', href: input.link },
  });
}

/** The membership certificate, attached as a PDF, sent when the member or an officer asks. */
export function psfCertificateMail(input: {
  to: Addressee;
  legalName: string;
  tierName: string;
  membershipNumber: string;
  expiresOn: string | null;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `PSF membership certificate for ${input.legalName}`,
    heading: 'Your PSF certificate',
    greeting: greeting(input.to),
    paragraphs: [`The membership certificate for ${input.legalName} is attached as a PDF. Print it, or keep it to show.`],
    details: [
      ['Membership', input.tierName],
      ['Membership number', input.membershipNumber],
      ...(input.expiresOn ? ([['Valid until', input.expiresOn]] as [string, string][]) : []),
    ],
    cta: { label: 'See it online', href: input.link },
  });
}
