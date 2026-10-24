import { LEASE_TAX_FILING_DAYS, RENTALS_APP_PATHS, formatRwf, longDate } from '@injishi/contracts';

/**
 * The rentals emails, as text (WP 1.5b): one fact each, short sentences in
 * plain English a Kinyarwanda speaker reads easily, no dashes for pauses, and
 * one link to the page in the app where the next step is.
 *
 * Pure: the mailer resolves the app's origin and sends; these only word the
 * mail, so a test can read exactly what a tenant gets.
 */

/** One email: what it says, and the one thing to do next. */
export interface RentalsMail {
  subject: string;
  heading: string;
  /** Short paragraphs, in order. */
  lines: string[];
  /** The one button. */
  action: { label: string; url: string };
  /** A small closing line under the button, when one is needed. */
  footnote?: string;
}

/** The app's pages a mail opens, on `appUrl`. */
export function invitationLink(appUrl: string, token: string): string {
  return new URL(RENTALS_APP_PATHS.invitation(token), appUrl).toString();
}

export function tenantLeaseLink(appUrl: string, leaseId: string): string {
  return new URL(RENTALS_APP_PATHS.tenantLease(leaseId), appUrl).toString();
}

export function landlordLeaseLink(appUrl: string, leaseId: string): string {
  return new URL(RENTALS_APP_PATHS.landlordLease(leaseId), appUrl).toString();
}

/** The home in a few words: `unit B-07 at Kacyiru Court`. */
export function homeWords(home: { unitLabel: string; propertyName: string }): string {
  return `unit ${home.unitLabel} at ${home.propertyName}`;
}

/** The first word of a name, for "Hello Aline,". */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** `RWF 400,000 a month, from 1 November 2026 to 31 October 2027.` */
function termsLine(terms: { monthlyRentRwf: number; startDate: string; endDate: string }): string {
  return `Rent is ${formatRwf(terms.monthlyRentRwf)} a month, from ${longDate(terms.startDate)} to ${longDate(terms.endDate)}.`;
}

// --- The signing code -------------------------------------------------------------

export function signingCodeMail(input: { code: string; home: string; minutes: number }): {
  subject: string;
  text: string;
  html: string;
} {
  const text = [
    `Your code to sign the lease for ${input.home} is ${input.code}.`,
    '',
    `It works for ${input.minutes} minutes. Type it on Injishi to add your signature.`,
    '',
    'If you are not signing a lease, ignore this email. Nobody can sign for you without this code.',
  ].join('\n');
  const html = page(
    'Your signing code',
    [
      paragraph(`To sign the lease for ${input.home}, type this code on Injishi.`),
      `<p style="margin:0 0 16px;font-size:28px;font-weight:700;letter-spacing:6px;color:${INK};">${escapeHtml(input.code)}</p>`,
    ].join('\n'),
    `It works for ${input.minutes} minutes. If you are not signing a lease, ignore this email. Nobody can sign for you without this code.`,
  );
  return { subject: 'Your code to sign the lease', text, html };
}

// --- The invitation -----------------------------------------------------------------

export interface InvitationMailInput {
  appUrl: string;
  leaseId: string;
  /** The raw token: only ever in this mail, never stored. Null when the tenant already has the lease on their account. */
  token: string | null;
  tenantName: string;
  landlordName: string;
  home: { unitLabel: string; propertyName: string };
  terms: { monthlyRentRwf: number; depositRwf: number; startDate: string; endDate: string };
  expiresAt: Date;
}

/**
 * The lease is out for the tenant's signature. A tenant new to Injishi gets
 * the invitation link (they sign in with this address, accept, then sign); a
 * tenant whose account already holds this landlord's tenant record is sent
 * straight to the lease.
 */
export function invitationMail(input: InvitationMailInput): RentalsMail {
  const where = homeWords(input.home);
  const lines = [
    `Hello ${firstName(input.tenantName)},`,
    `${input.landlordName} signed a lease for ${where} and is waiting for your signature.`,
    termsLine(input.terms),
    input.terms.depositRwf > 0
      ? `The deposit is ${formatRwf(input.terms.depositRwf)}, due on ${longDate(input.terms.startDate)}.`
      : 'There is no deposit.',
  ];
  if (input.token) {
    lines.push(
      'Open the lease to read it. You sign in with this email address, then you sign.',
      `The link works until ${longDate(input.expiresAt.toISOString().slice(0, 10))}.`,
    );
    return {
      subject: `${input.landlordName} sent you a lease to sign`,
      heading: 'A lease is waiting for you',
      lines,
      action: { label: 'Open the lease', url: invitationLink(input.appUrl, input.token) },
      footnote: 'If you were not expecting this, you can ignore this email. Nothing is agreed until you sign.',
    };
  }
  lines.push('Sign in to Injishi to read the lease and sign it.');
  return {
    subject: `${input.landlordName} sent you a lease to sign`,
    heading: 'A lease is waiting for you',
    lines,
    action: { label: 'Read and sign', url: tenantLeaseLink(input.appUrl, input.leaseId) },
    footnote: 'Nothing is agreed until you sign.',
  };
}

// --- The signed copy ------------------------------------------------------------------

export interface SignedCopyMailInput {
  appUrl: string;
  leaseId: string;
  reference: string;
  tenantName: string;
  landlordName: string;
  home: { unitLabel: string; propertyName: string };
  startDate: string;
  depositRwf: number;
  /** The landlord lets Injishi start leases on their start date. */
  autoStart: boolean;
}

/** To the tenant, with the signed PDF attached. */
export function signedCopyTenantMail(input: SignedCopyMailInput): RentalsMail {
  const where = homeWords(input.home);
  return {
    subject: `Your signed lease for ${where}`,
    heading: 'Your lease is signed',
    lines: [
      `You and ${input.landlordName} have both signed the lease for ${where}. The signed lease is attached. Keep it safe.`,
      `Your tenancy starts on ${longDate(input.startDate)}.`,
      input.depositRwf > 0
        ? `Your deposit of ${formatRwf(input.depositRwf)} is due on ${longDate(input.startDate)}.`
        : 'There is no deposit to pay.',
    ],
    action: { label: 'Open my lease', url: tenantLeaseLink(input.appUrl, input.leaseId) },
  };
}

/** To the landlord, with the signed PDF attached. */
export function signedCopyLandlordMail(input: SignedCopyMailInput): RentalsMail {
  const where = homeWords(input.home);
  return {
    subject: `${input.tenantName} signed the lease for ${where}`,
    heading: 'The lease is signed',
    lines: [
      `${input.tenantName} and ${input.landlordName} have both signed lease ${input.reference} for ${where}. The signed lease is attached.`,
      `File a copy with the Rwanda Revenue Authority within ${LEASE_TAX_FILING_DAYS} days.`,
      input.autoStart
        ? `Injishi starts the tenancy on ${longDate(input.startDate)}. You can also start it yourself that day.`
        : `Start the tenancy on ${longDate(input.startDate)}. The first rent is raised when you do.`,
    ],
    action: { label: 'Open the lease', url: landlordLeaseLink(input.appUrl, input.leaseId) },
  };
}

// --- The tenancy started -----------------------------------------------------------------

export interface StartedMailInput {
  appUrl: string;
  leaseId: string;
  tenantName: string;
  landlordName: string;
  home: { unitLabel: string; propertyName: string };
  /** The landlord pressed Start; false when Injishi started it on its start date. */
  byLandlord: boolean;
  /** What is open on the lease now, oldest due first. */
  charges: { kind: 'rent' | 'deposit'; periodStart: string | null; dueOn: string; owedRwf: number }[];
}

export function tenancyStartedMail(input: StartedMailInput): RentalsMail {
  const where = homeWords(input.home);
  const lines = [
    `Hello ${firstName(input.tenantName)},`,
    input.byLandlord
      ? `${input.landlordName} started your tenancy for ${where}. Welcome home.`
      : `Your tenancy for ${where} started today. Welcome home.`,
  ];
  if (input.charges.length > 0) {
    lines.push('What you owe now:');
    for (const c of input.charges) {
      const what = c.kind === 'deposit' ? 'Deposit' : `Rent for ${monthWords(c.periodStart ?? c.dueOn)}`;
      lines.push(`${what}: ${formatRwf(c.owedRwf)}, due on ${longDate(c.dueOn)}.`);
    }
  } else {
    lines.push('Nothing is owed yet. We email you before each rent is due.');
  }
  return {
    subject: 'Your tenancy has started',
    heading: 'Your tenancy has started',
    lines,
    action: { label: 'Open my lease', url: tenantLeaseLink(input.appUrl, input.leaseId) },
  };
}

// --- The lease was cancelled ----------------------------------------------------------

export function leaseCancelledMail(input: {
  appUrl: string;
  leaseId: string;
  tenantName: string;
  landlordName: string;
  home: { unitLabel: string; propertyName: string };
  reason: string;
}): RentalsMail {
  const where = homeWords(input.home);
  return {
    subject: `${input.landlordName} cancelled the lease for ${where}`,
    heading: 'The lease was cancelled',
    lines: [
      `Hello ${firstName(input.tenantName)},`,
      `${input.landlordName} cancelled the lease for ${where}. You owe nothing on it.`,
      `The reason they gave: ${input.reason}`,
    ],
    action: { label: 'Open the lease', url: tenantLeaseLink(input.appUrl, input.leaseId) },
  };
}

// --- Rendering ------------------------------------------------------------------------

/** `2026-11-01` as `November 2026`. */
export function monthWords(iso: string): string {
  return longDate(iso).split(' ').slice(1).join(' ');
}

const INK = '#111827';
const MUTED = '#4B5563';
const FAINT = '#6B7280';

/** A mail as text and HTML: the paragraphs, the one button, the footnote. */
export function renderRentalsMail(mail: RentalsMail): { subject: string; text: string; html: string } {
  const text = [
    ...mail.lines.flatMap((line) => [line, '']),
    `${mail.action.label}: ${mail.action.url}`,
    ...(mail.footnote ? ['', mail.footnote] : []),
  ].join('\n');
  const body = [
    ...mail.lines.map(paragraph),
    `<p style="margin:8px 0 0;"><a href="${escapeHtml(mail.action.url)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(mail.action.label)}</a></p>`,
  ].join('\n');
  return { subject: mail.subject, text, html: page(mail.heading, body, mail.footnote ?? null) };
}

function paragraph(line: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:${MUTED};">${escapeHtml(line)}</p>`;
}

function page(heading: string, body: string, footnote: string | null): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#F3F4F6;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${INK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:20px;color:${INK};">${escapeHtml(heading)}</h1>
        ${body}
        ${footnote ? `<p style="margin:20px 0 0;font-size:12px;color:${FAINT};">${escapeHtml(footnote)}</p>` : ''}
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
