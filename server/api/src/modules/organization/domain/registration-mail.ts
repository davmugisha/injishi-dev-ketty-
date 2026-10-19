import {
  REJECTION_REASON_LABEL,
  districtScopeOf,
  scopeCoversDistrict,
  type OversightGrant,
  type RegistrationRejectionReason,
} from '@injishi/contracts';

/**
 * What a registrant, and the officers who review them, are told as a business
 * moves through registration (F-S03, D23, D25).
 *
 * ## The gap this closes
 *
 * Registration sent no mail at all except the OBO claim invitation. A person
 * who registered a property, paid for it and waited on two government gates was
 * told nothing at any step, and an officer learned that a business was waiting
 * on them only by opening the console. Every mail here is sent AFTER the state
 * change it describes has committed, so none of them can claim a move that did
 * not happen.
 *
 * ## The rules the copy follows
 *
 * - **The legal name is in every subject.** It is the one fact that tells a
 *   registrant holding two businesses which one a mail is about.
 * - **Every mail says what happens next and who acts.** A registrant waiting on
 *   a district officer is told they have nothing to do, so silence is not read
 *   as a stall.
 * - **Nothing is invented.** A refusal quotes the reason label the officer
 *   picked and the officer's own notes, never a paraphrase.
 * - **No identity data.** No national ID and no phone number: a mail is
 *   forwardable. The TIN appears only in the officer mail and in a TIN refusal,
 *   where it is the subject of the decision.
 *
 * Pure functions: text in, `{ subject, text, html }` out. The mailer resolves
 * recipients and links and owns delivery.
 */

export interface RegistrationMail {
  /** A single line; the mail port refuses a line break. */
  subject: string;
  text: string;
  html: string;
}

/** Who a registrant mail is addressed to. Null reads as a plain greeting. */
export interface Addressee {
  name: string | null;
}

// ---------------------------------------------------------------------------
// Links. The origin is configuration, the path is code.
// ---------------------------------------------------------------------------

/** The registration wizard on web, which also shows where a business got to. */
export function registrationLink(webUrl: string): string {
  return new URL('/register', webUrl).toString();
}

/**
 * The operator workspace's setup screen. The operator app is a zone under web's
 * origin (web rewrites `/w/*` to it), so the origin is web's.
 */
export function workspaceSetupLink(webUrl: string, workspaceId: string): string {
  return new URL(`/w/${encodeURIComponent(workspaceId)}/setup`, webUrl).toString();
}

/**
 * An officer's own queue. `/oversight` is also a zone path under web's origin,
 * and each function owns one console segment (`CONSOLE_SEGMENT` in the operator
 * app).
 */
export function oversightQueueLink(
  webUrl: string,
  role: 'business_field_verifier' | 'business_approver',
): string {
  const segment = role === 'business_field_verifier' ? 'verifier' : 'approver';
  return new URL(`/oversight/${segment}/queue`, webUrl).toString();
}

// ---------------------------------------------------------------------------
// Registrant mails
// ---------------------------------------------------------------------------

/** 1. Created at `pending_payment`: two things are still owed. */
export function registrationReceivedMail(input: {
  to: Addressee;
  legalName: string;
  amountDueRwf: number | null;
  link: string;
}): RegistrationMail {
  const fee =
    input.amountDueRwf === null
      ? 'Pay the registration fee.'
      : `Pay the registration fee of ${money(input.amountDueRwf)}.`;
  return compose({
    subject: `We received your registration for ${input.legalName}`,
    heading: 'Registration received',
    greeting: greeting(input.to),
    paragraphs: [
      `Thank you for registering ${input.legalName} on Injishi. Your registration is saved, and your business is not yet under review.`,
      'To send it for review, finish these two steps:',
    ],
    steps: ['Read and accept the Injishi operator contract.', fee],
    after: [
      'Once the fee is paid, your registration goes to the Rwanda Revenue Authority (RRA) for a TIN check and then to your district for review. The fee is charged once and is not refunded if the registration is not approved.',
    ],
    cta: { label: 'Continue your registration', href: input.link },
  });
}

/**
 * THE PSF PATH. A business of any sector is registered the moment its fee is
 * paid and its TIN, if it gave one, is confirmed: no district visit, no
 * approval. The mail gives it its code and its next step, PSF membership.
 */
export function psfBusinessRegisteredMail(input: {
  to: Addressee;
  legalName: string;
  businessCode: string | null;
  districtName: string | null;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `${input.legalName} is registered${input.businessCode ? `: ${input.businessCode}` : ''}`,
    heading: 'Your business is registered',
    greeting: greeting(input.to),
    paragraphs: [
      `${input.legalName} is registered on Injishi, and the Private Sector Federation (PSF) can now find it.`,
      'Your next step is PSF membership: pick the tier your business can afford and apply from your portal. PSF reviews it, and you pay the membership fee there once it is approved.',
    ],
    details: [
      ...(input.businessCode ? ([['Business code', input.businessCode]] as [string, string][]) : []),
      ...(input.districtName ? ([['District', input.districtName]] as [string, string][]) : []),
    ],
    after: ['Quote your business code whenever you deal with PSF. It never changes.'],
    cta: { label: 'Apply for PSF membership', href: input.link },
  });
}

/**
 * 2. Paid (or corrected and resubmitted): the business is in the pipeline and
 * the registrant has nothing to do but wait.
 */
export function registrationSubmittedMail(input: {
  to: Addressee;
  legalName: string;
  /** A residence carries no TIN, so it skips the RRA check. */
  hasTin: boolean;
  resubmitted: boolean;
  link: string;
}): RegistrationMail {
  const steps = [
    ...(input.hasTin
      ? ['Tax check: the Rwanda Revenue Authority (RRA) confirms your TIN. This is automatic.']
      : []),
    'Field verification: a district officer confirms that the business exists at the address you gave and that your documents are valid.',
    'Approval: a district approver reviews the verified registration and makes the final decision.',
  ];
  return compose({
    subject: `Registration submitted — ${input.legalName}`,
    heading: input.resubmitted ? 'Registration resubmitted' : 'Registration submitted',
    greeting: greeting(input.to),
    paragraphs: [
      input.resubmitted
        ? `Your corrected registration for ${input.legalName} has been resubmitted for review. No further fee is due.`
        : `Your registration fee is paid and ${input.legalName} has been submitted for review.`,
      'Here is what happens next:',
    ],
    steps,
    after: [
      'You do not need to do anything while it is reviewed. We will email you after each decision, and you can follow its progress at any time.',
    ],
    cta: { label: 'View registration status', href: input.link },
  });
}

/** 3a. The field verifier passed the business. */
export function fieldVerificationPassedMail(input: {
  to: Addressee;
  legalName: string;
  link: string;
}): RegistrationMail {
  return compose({
    subject: `Field verification passed — ${input.legalName}`,
    heading: 'Field verification passed',
    greeting: greeting(input.to),
    paragraphs: [
      `A district officer has verified ${input.legalName}: the business was confirmed at its address and its documents were accepted.`,
      'Your registration is now with a district approver for the final decision. You do not need to do anything; we will email you when it is decided.',
    ],
    cta: { label: 'View registration status', href: input.link },
  });
}

/** Which gate a refusal was taken at, in the registrant's words. */
export type RejectionGate = 'tin_check' | 'tin_verified' | 'field_verified';

const GATE_WORDS: Readonly<Record<RejectionGate, string>> = {
  tin_check: 'the automatic tax check with the Rwanda Revenue Authority (RRA)',
  tin_verified: 'the field verification stage',
  field_verified: 'the final approval stage',
};

/**
 * 3b. Refused, at a human gate or by RRA. Quotes the reason label and the
 * officer's notes as written, and says the fee is not charged again.
 */
export function registrationRejectedMail(input: {
  to: Addressee;
  legalName: string;
  gate: RejectionGate;
  reasonCode: RegistrationRejectionReason | null;
  notes: string | null;
  link: string;
}): RegistrationMail {
  const reason = input.reasonCode
    ? REJECTION_REASON_LABEL[input.reasonCode]
    : input.gate === 'tin_check'
      ? REJECTION_REASON_LABEL.tin_not_found
      : 'No reason was recorded.';
  const notes = input.notes?.trim() || null;
  return compose({
    subject: `Registration not approved — ${input.legalName}`,
    heading: 'Registration not approved',
    greeting: greeting(input.to),
    paragraphs: [
      `Your registration for ${input.legalName} was not approved at ${GATE_WORDS[input.gate]}.`,
    ],
    details: [
      ['Reason', reason],
      ...(notes ? ([['Officer notes', notes]] as [string, string][]) : []),
    ],
    after: [
      'You can correct your registration and resubmit it. The registration fee you already paid covers the new review, so nothing more is charged.',
    ],
    cta: { label: 'Correct and resubmit', href: input.link },
  });
}

/**
 * 3c. Approved. An owner's business is active and has a workspace to set up; an
 * OBO registration is approved but waits, payout locked, for its owner to claim
 * it (F-S03 §8), so it gets no setup link.
 */
export function registrationApprovedMail(
  input:
    | { to: Addressee; legalName: string; awaitingClaim: false; setupLink: string }
    | { to: Addressee; legalName: string; awaitingClaim: true; statusLink: string },
): RegistrationMail {
  if (input.awaitingClaim) {
    return compose({
      subject: `${input.legalName} is approved — waiting for the owner to claim it`,
      heading: 'Registration approved',
      greeting: greeting(input.to),
      paragraphs: [
        `${input.legalName} has been approved by the district.`,
        'Because you registered it on behalf of its owner, it stays on hold until the owner accepts the claim invitation we emailed them. Payouts stay locked until then.',
      ],
      cta: { label: 'View registration status', href: input.statusLink },
    });
  }
  return compose({
    subject: `${input.legalName} is approved — set up your property`,
    heading: `${input.legalName} is approved`,
    greeting: greeting(input.to),
    paragraphs: [
      `Congratulations. ${input.legalName} has been approved by the district and is now active on Injishi.`,
      'Your workspace is open. Set up your property, its rooms and its rates so guests can find and book it.',
    ],
    cta: { label: 'Set up your property', href: input.setupLink },
  });
}

// ---------------------------------------------------------------------------
// Officer mails
// ---------------------------------------------------------------------------

/**
 * 4. A business has entered an officer's queue. Says which gate, where, and
 * links to the queue; the decision itself happens only in the console.
 */
export function officerQueueMail(input: {
  to: Addressee;
  role: 'business_field_verifier' | 'business_approver';
  legalName: string;
  districtName: string | null;
  sectorName: string | null;
  tin: string | null;
  link: string;
}): RegistrationMail {
  const verifier = input.role === 'business_field_verifier';
  const place = [input.sectorName, input.districtName].filter(Boolean).join(', ');
  return compose({
    subject: verifier
      ? `Field verification needed — ${input.legalName}`
      : `Approval needed — ${input.legalName}`,
    heading: verifier ? 'A business needs field verification' : 'A business needs your approval',
    greeting: greeting(input.to),
    paragraphs: [
      verifier
        ? `${input.legalName} has paid its registration fee${input.tin ? ' and passed the RRA TIN check' : ''}. It is now in your field verification queue.`
        : `${input.legalName} has passed field verification. It is now in your approval queue for a final decision.`,
    ],
    details: [
      ['Business', input.legalName],
      ...(place ? ([['Location', place]] as [string, string][]) : []),
      ...(input.tin ? ([['TIN', input.tin]] as [string, string][]) : []),
    ],
    after: [
      'Open your queue in the Injishi oversight console to review it. You received this because your assignment covers this district.',
    ],
    cta: { label: 'Open your queue', href: input.link },
  });
}

/** One live oversight assignment, with the officer it belongs to. */
export interface OfficerAssignmentRow {
  userId: string;
  email: string;
  name: string | null;
  scopeLevel: OversightGrant['scopeLevel'];
  provinceId: number | null;
  districtId: number | null;
}

/**
 * The officers whose region reaches this district, once each.
 *
 * Scope is read through `districtScopeOf` and `scopeCoversDistrict` from
 * `@injishi/contracts`, the one definition the queue and the gate already use,
 * so a mail reaches exactly the people whose queue now lists the business. An
 * officer holding several assignments is judged on all of them together and
 * mailed once.
 */
export function officersCoveringDistrict(
  rows: readonly OfficerAssignmentRow[],
  provinceDistricts: ReadonlyMap<number, readonly number[]>,
  districtId: number | null,
): { userId: string; email: string; name: string | null }[] {
  const byUser = new Map<string, OfficerAssignmentRow[]>();
  for (const row of rows) {
    byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
  }
  const out: { userId: string; email: string; name: string | null }[] = [];
  for (const [userId, grants] of byUser) {
    const scope = districtScopeOf(grants, provinceDistricts);
    if (!scopeCoversDistrict(scope, districtId)) continue;
    const first = grants[0];
    if (first) out.push({ userId, email: first.email, name: first.name });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/** `50000` → `RWF 50,000`. */
export function money(amountRwf: number): string {
  return `RWF ${amountRwf.toLocaleString('en-US')}`;
}

export function greeting(to: Addressee): string {
  const name = to.name?.trim();
  return name ? `Hello ${name},` : 'Hello,';
}

export interface MailParts {
  subject: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  steps?: string[];
  details?: [string, string][];
  after?: string[];
  cta: { label: string; href: string };
}

const SIGN_OFF = 'The Injishi team';
const FOOTER =
  'You are receiving this email because of a business registration on Injishi.';

/**
 * One layout for every registration mail, in plain text and in HTML. Exported
 * so PSF membership mail (ADR-056, `psf-mail.ts`) looks the same.
 */
export function compose(parts: MailParts): RegistrationMail {
  const subject = parts.subject.replace(/[\r\n]+/g, ' ').trim();

  const text = [
    parts.greeting,
    '',
    ...parts.paragraphs.flatMap((p) => [p, '']),
    ...(parts.steps?.length
      ? [...parts.steps.map((s, i) => `  ${i + 1}. ${s}`), '']
      : []),
    ...(parts.details?.length
      ? [...parts.details.map(([k, v]) => `  ${k}: ${v}`), '']
      : []),
    ...(parts.after ?? []).flatMap((p) => [p, '']),
    `${parts.cta.label}: ${parts.cta.href}`,
    '',
    SIGN_OFF,
    '',
    FOOTER,
  ].join('\n');

  const p = (s: string): string =>
    `<p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#4a5c62;">${escapeHtml(s)}</p>`;
  const steps = parts.steps?.length
    ? `<ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:22px;color:#4a5c62;">${parts.steps
        .map((s) => `<li style="margin:0 0 8px;">${escapeHtml(s)}</li>`)
        .join('')}</ol>`
    : '';
  const details = parts.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;background:#f4f6f6;border-radius:10px;">${parts.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 14px;font-size:13px;color:#8a999e;vertical-align:top;white-space:nowrap;">${escapeHtml(k)}</td><td style="padding:10px 14px;font-size:14px;color:#042330;white-space:pre-line;">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f6f6;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#042330;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:20px;color:#042330;">${escapeHtml(parts.heading)}</h1>
        ${p(parts.greeting)}
        ${parts.paragraphs.map(p).join('\n        ')}
        ${steps}
        ${details}
        ${(parts.after ?? []).map(p).join('\n        ')}
        <p style="margin:8px 0 24px;"><a href="${escapeHtml(parts.cta.href)}" style="display:inline-block;background:#042330;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">${escapeHtml(parts.cta.label)}</a></p>
        <p style="margin:0 0 16px;font-size:14px;color:#4a5c62;">${SIGN_OFF}</p>
        <p style="margin:0;font-size:12px;color:#8a999e;">${FOOTER}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
