import { ORG_ROLE_LABEL, type OrgRole } from '@injishi/contracts';

import {
  claimInvitationExpiresAt,
  newClaimToken,
} from './owner-claim';

/**
 * A staff invitation's fixed facts: the token, its lifetime, the link and the
 * mail (setup after approval, 2026-09-13).
 *
 * The token and the 7 day life are the owner claim's, reused rather than
 * restated: `architecture-schema.md` sets one single use, 7 day rule for every
 * `org_invitations` row, whatever its purpose.
 */
export const newStaffInvitationToken = newClaimToken;
export const staffInvitationExpiresAt = claimInvitationExpiresAt;

/**
 * `${WEB_URL}/join-team?org=<orgId>&token=<token>`. Web owns the page, as it
 * owns sign-in: one account, one place a person accepts anything.
 */
export function staffInvitationLink(webUrl: string, orgId: string, token: string): string {
  const url = new URL('/join-team', webUrl);
  url.searchParams.set('org', orgId);
  url.searchParams.set('token', token);
  return url.toString();
}

export interface StaffInvitationMailInput {
  legalName: string;
  orgRole: OrgRole;
  inviterName: string | null;
  email: string;
  link: string;
  expiresAt: Date;
}

/**
 * The invitation mail. It names the business, the role and who sent it — the
 * three facts the join page repeats — and says which address must sign in,
 * because accepting refuses any other account.
 */
export function staffInvitationMail(input: StaffInvitationMailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const by = input.inviterName ?? 'The owner';
  const role = ORG_ROLE_LABEL[input.orgRole];
  const until = input.expiresAt.toISOString().slice(0, 10);
  const subject = `Join ${input.legalName} on Injishi as ${role}`;
  const text = [
    'Hello,',
    '',
    `${by} invited you to join ${input.legalName} on Injishi as ${role}.`,
    '',
    `Open this link and sign in with ${input.email} to accept:`,
    '',
    input.link,
    '',
    `The link works once and expires on ${until}. If you did not expect this, you can ignore this email.`,
  ].join('\n');
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f6f6;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#042330;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 8px;font-size:20px;color:#042330;">Join ${escapeHtml(input.legalName)}</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#4a5c62;">${escapeHtml(by)} invited you to work at this business on Injishi as <strong>${escapeHtml(role)}</strong>.</p>
        <p style="margin:0 0 24px;font-size:14px;color:#4a5c62;">Sign in with <strong>${escapeHtml(input.email)}</strong> to accept. Your role decides what you can see and do.</p>
        <p style="margin:0 0 24px;"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#042330;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">Accept the invitation</a></p>
        <p style="margin:0;font-size:12px;color:#8a999e;">The link works once and expires on ${until}. If you did not expect this, you can ignore this email.</p>
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
