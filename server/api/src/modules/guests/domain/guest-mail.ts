import { LEADER_ROLE_LABEL, type LeaderRole, longDate } from '@injishi/contracts';

/**
 * The guest emails to local leaders (P5): one fact each, short plain
 * sentences, one link to the console. No ID number and no phone number ever
 * goes in a mail: the console shows those to a signed in leader.
 */

export interface GuestMail {
  subject: string;
  text: string;
  html: string;
}

/** Where a leader reads their guests, on the app's origin. */
export const LEADER_CONSOLE_PATH = '/officer/guests';

export function leaderConsoleLink(appUrl: string, registrationId?: string): string {
  const url = new URL(LEADER_CONSOLE_PATH, appUrl);
  if (registrationId) url.searchParams.set('guest', registrationId);
  return url.toString();
}

const INK = '#042330';
const MUTED = '#4a5c62';
const FAINT = '#8a999e';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(heading: string, paragraphs: string[], action: { label: string; url: string }, footnote: string): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 12px;font-size:14px;color:${MUTED};">${escapeHtml(p)}</p>`)
    .join('\n');
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f6f6;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${INK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 12px;font-size:20px;color:${INK};">${escapeHtml(heading)}</h1>
${body}
        <p style="margin:12px 0 24px;"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">${escapeHtml(action.label)}</a></p>
        <p style="margin:0;font-size:12px;color:${FAINT};">${escapeHtml(footnote)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function mail(subject: string, heading: string, lines: string[], action: { label: string; url: string }, footnote: string): GuestMail {
  const text = [...lines, '', `${action.label}: ${action.url}`, '', footnote].join('\n');
  return { subject, text, html: page(heading, lines, action, footnote) };
}

const FOOTNOTE = 'You get this email because you hold a local leader post on Injishi for this area.';

export interface GuestMailInput {
  appUrl: string;
  registrationId: string;
  guestName: string;
  /** The country's name for a guest from abroad; null for a Rwandan. */
  fromCountry: string | null;
  arrivalOn: string;
  departureOn: string;
  hostKind: 'tenant' | 'landlord';
  /** The home's place in words, village up to district. */
  area: string;
  role: LeaderRole;
}

function stayLine(input: GuestMailInput): string {
  const host = input.hostKind === 'tenant' ? 'A tenant' : 'A landlord';
  const where = input.area ? ` in ${input.area}` : '';
  const dates =
    input.arrivalOn === input.departureOn
      ? `on ${longDate(input.arrivalOn)}`
      : `from ${longDate(input.arrivalOn)} to ${longDate(input.departureOn)}`;
  return `${host}${where} registered a guest staying ${dates}.`;
}

/** A guest was filed in the leader's area: one per registration, per leader. */
export function newGuestMail(input: GuestMailInput): GuestMail {
  const who = input.fromCountry ? `${input.guestName}, from ${input.fromCountry}.` : `${input.guestName}.`;
  return mail(
    `New guest in your area: ${input.guestName}`,
    'A guest is staying in your area',
    [stayLine(input), who, `You receive it as the ${LEADER_ROLE_LABEL[input.role].toLowerCase()}.`],
    { label: 'Open the guest', url: leaderConsoleLink(input.appUrl, input.registrationId) },
    FOOTNOTE,
  );
}

/** The host changed a guest before arrival. */
export function changedGuestMail(input: GuestMailInput): GuestMail {
  const who = input.fromCountry ? `${input.guestName}, from ${input.fromCountry}.` : `${input.guestName}.`;
  return mail(
    `Guest details changed: ${input.guestName}`,
    'A guest registration changed',
    [stayLine(input).replace('registered a guest', 'changed the details of a guest'), who],
    { label: 'Open the guest', url: leaderConsoleLink(input.appUrl, input.registrationId) },
    FOOTNOTE,
  );
}

/** Guests that waited for nobody in the post were handed to a new leader: one mail, the count. */
export function handOverMail(input: { appUrl: string; role: LeaderRole; area: string; count: number }): GuestMail {
  const guests = input.count === 1 ? 'One guest' : `${input.count} guests`;
  return mail(
    `${guests} waiting for you in ${input.area}`,
    'Guests were waiting for a leader',
    [
      `${guests} staying in ${input.area} ${input.count === 1 ? 'was' : 'were'} registered while nobody held the post of ${LEADER_ROLE_LABEL[input.role].toLowerCase()}.`,
      'They are now in your guest list.',
    ],
    { label: 'Open the guest list', url: leaderConsoleLink(input.appUrl) },
    FOOTNOTE,
  );
}

/** A person was appointed: what the post is and how to sign in. */
export function appointmentMail(input: { appUrl: string; roleLabel: string; area: string; next: string }): GuestMail {
  const url = new URL('/sign-in', input.appUrl);
  url.searchParams.set('next', input.next);
  return mail(
    `You are now the ${input.roleLabel.toLowerCase()} for ${input.area} on Injishi`,
    'You have a new post on Injishi',
    [
      `Injishi appointed you ${input.roleLabel.toLowerCase()} for ${input.area}.`,
      'Sign in with this email address. We send you a code each time, so there is no password to remember.',
    ],
    { label: 'Sign in', url: url.toString() },
    'If you did not expect this, reply to this email and we will look into it.',
  );
}
