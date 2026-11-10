/**
 * The emails an applicant receives (058-talent): each step of their application, in plain words,
 * with what they still have to send and a link to their own progress page. Built here as text and
 * HTML from facts the caller looked up; nothing in this file sends anything.
 */

export type TalentMailEvent =
  | { kind: 'received' }
  | { kind: 'screening' }
  | { kind: 'interview_stage' }
  | { kind: 'interview_booked'; startsAt: Date; place: string | null; interviewerName: string | null }
  | { kind: 'offer'; amountRwf: number; startsOn: string | null }
  | { kind: 'agreed'; amountRwf: number; startsOn: string | null }
  | { kind: 'hired'; startsOn: string | null }
  | { kind: 'closed'; reason: string | null }
  | { kind: 'code'; code: string };

export interface TalentMailFacts {
  firstName: string;
  role: string;
  /** The branch when the role has one, else the business's name. */
  business: string;
  link: string;
  /** Documents the role asks for that they have not sent yet. */
  documentsToSend: readonly string[];
}

const KIGALI = 'Africa/Kigali';
const rwf = (n: number): string => `RWF ${n.toLocaleString('en-US')}`;
const day = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
const when = (at: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KIGALI,
  }).format(at);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The heading, the lines under it and any facts as label and value, for one event. */
function wordsFor(event: TalentMailEvent, f: TalentMailFacts): { subject: string; heading: string; lines: string[]; facts: [string, string][] } {
  const at = `${f.role} at ${f.business}`;
  switch (event.kind) {
    case 'received':
      return {
        subject: `We received your application · ${f.role}`,
        heading: 'We received your application',
        lines: [`Thank you for applying for ${at}. We will write to you at each step.`],
        facts: [],
      };
    case 'screening':
      return {
        subject: `Your application is being reviewed · ${f.role}`,
        heading: 'Your application is being reviewed',
        lines: [`Good news: your application for ${at} has moved to the next round.`],
        facts: [],
      };
    case 'interview_stage':
      return {
        subject: `You are through to the interview · ${f.role}`,
        heading: 'You are through to the interview',
        lines: [`Your application for ${at} has moved to the interview round. We will send you the day and time.`],
        facts: [],
      };
    case 'interview_booked':
      return {
        subject: `Your interview · ${f.role}`,
        heading: 'Your interview is booked',
        lines: [`Here are the details of your interview for ${at}.`],
        facts: [
          ['When', when(event.startsAt)],
          ...(event.place ? ([['Where', event.place]] as [string, string][]) : []),
          ...(event.interviewerName ? ([['With', event.interviewerName]] as [string, string][]) : []),
        ],
      };
    case 'offer':
      return {
        subject: `Our offer · ${f.role}`,
        heading: 'We would like to offer you the job',
        lines: [`We are pleased to offer you the role of ${at}. Open your page to accept it, or to ask for another figure.`],
        facts: [
          ['Monthly wage', rwf(event.amountRwf)],
          ...(event.startsOn ? ([['First day', day(event.startsOn)]] as [string, string][]) : []),
        ],
      };
    case 'agreed':
      return {
        subject: `Your wage is agreed · ${f.role}`,
        heading: 'Your wage is agreed',
        lines: [`We agreed your wage for ${at}. We will be in touch about your first day.`],
        facts: [
          ['Monthly wage', rwf(event.amountRwf)],
          ...(event.startsOn ? ([['First day', day(event.startsOn)]] as [string, string][]) : []),
        ],
      };
    case 'hired':
      return {
        subject: `Welcome to ${f.business}`,
        heading: `Welcome to ${f.business}`,
        lines: [`You have the job of ${f.role}. We look forward to working with you.`],
        facts: event.startsOn ? [['First day', day(event.startsOn)]] : [],
      };
    case 'closed':
      return {
        subject: `Your application · ${f.role}`,
        heading: 'Thank you for applying',
        lines: [
          `Thank you for your interest in ${at}. This time we chose another candidate.`,
          ...(event.reason ? [event.reason] : []),
          'We wish you well in your search.',
        ],
        facts: [],
      };
    case 'code':
      return {
        subject: `Your code: ${event.code}`,
        heading: 'Your code to open your application',
        lines: [`Enter this code on the page to see your application for ${at}. It works for 10 minutes.`],
        facts: [['Code', event.code]],
      };
  }
}

export function talentMail(event: TalentMailEvent, f: TalentMailFacts): { subject: string; text: string; html: string } {
  const w = wordsFor(event, f);
  // A code mail is only the code; a turn-down asks for nothing more.
  const showDocuments = event.kind !== 'code' && event.kind !== 'closed' && f.documentsToSend.length > 0;
  const showLink = event.kind !== 'code';

  const text = [
    `Hi ${f.firstName},`,
    '',
    ...w.lines,
    ...(w.facts.length ? ['', ...w.facts.map(([k, v]) => `  ${k}: ${v}`)] : []),
    ...(showDocuments ? ['', 'Please send us:', ...f.documentsToSend.map((d) => `  · ${d}`)] : []),
    ...(showLink ? ['', 'See your application, send documents and answer our offer here:', f.link] : []),
    '',
    `${f.business}`,
  ].join('\n');

  const facts = w.facts
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#4a5c62;font-size:13px;">${escapeHtml(k)}</td><td style="padding:4px 0;font-size:15px;font-weight:600;color:#172522;">${escapeHtml(v)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#e8f3f0;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;color:#4a5c62;">${escapeHtml(f.business)} · ${escapeHtml(f.role)}</p>
        <h1 style="margin:0 0 16px;font-size:20px;color:#172522;">${escapeHtml(w.heading)}</h1>
        <p style="margin:0 0 12px;font-size:15px;color:#172522;">Hi ${escapeHtml(f.firstName)},</p>
        ${w.lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:22px;color:#172522;">${escapeHtml(l)}</p>`).join('')}
        ${facts ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;">${facts}</table>` : ''}
        ${
          showDocuments
            ? `<p style="margin:8px 0 6px;font-size:14px;font-weight:600;color:#172522;">Please send us</p><ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#172522;">${f.documentsToSend.map((d) => `<li style="margin:2px 0;">${escapeHtml(d)}</li>`).join('')}</ul>`
            : ''
        }
        ${
          showLink
            ? `<a href="${escapeHtml(f.link)}" style="display:inline-block;margin:8px 0 4px;background:#006b55;color:#fcfcfc;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:999px;">See your application</a>`
            : ''
        }
        <p style="margin:20px 0 0;font-size:12px;color:#4a5c62;">Reply to this email to write to us.</p>
      </td></tr>
    </table>
  </body>
</html>`;
  return { subject: w.subject, text, html };
}

/** "a•••@gmail.com", so the page can say where the code went without showing the address. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '•••';
  return `${user.slice(0, 1)}•••@${domain}`;
}

export function applicationLink(appUrl: string, token: string): string {
  return new URL(`/apply/${token}`, appUrl).toString();
}
