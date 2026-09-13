import { randomBytes } from 'node:crypto';

/**
 * The owner claim's fixed facts: the token, its lifetime, the link and the mail
 * (FL02, ADR-053).
 *
 * **Runs under Node's type stripping as well as under Nest.** The one time
 * script `scripts/issue-obo-claim-invitations.mjs` imports this file directly,
 * so an invitation it issues is the same token shape, the same 7 days and the
 * same mail as one the create transaction issues. That only works while this
 * file imports nothing but Node built ins and uses no syntax type stripping
 * cannot erase: no `enum`, no parameter properties, no decorators. A copy in the
 * script was the alternative, and two copies of a mail drift.
 */

/**
 * How long a claim invitation stays usable: 7 days from issue, the single use
 * and 7 day rule `architecture-schema.md` sets for every `org_invitations` row.
 * The column is NOT NULL with no default, so the application supplies it.
 */
export const CLAIM_INVITATION_TTL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 32 random bytes, base64url: 43 characters, unguessable, safe in a URL. */
export function newClaimToken(): string {
  return randomBytes(32).toString('base64url');
}

export function claimInvitationExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + CLAIM_INVITATION_TTL_DAYS * DAY_MS);
}

/**
 * `${WEB_URL}/claim-org?org=<orgId>&token=<token>`. The origin is configuration
 * and the path and query are code, so only the origin differs by environment.
 */
export function claimLink(webUrl: string, orgId: string, token: string): string {
  const url = new URL('/claim-org', webUrl);
  url.searchParams.set('org', orgId);
  url.searchParams.set('token', token);
  return url.toString();
}

export interface ClaimInvitationMailInput {
  legalName: string;
  intendedOwnerName: string;
  registrantName: string | null;
  link: string;
  expiresAt: Date;
}

export interface ClaimInvitationMail {
  subject: string;
  text: string;
  html: string;
}

/**
 * The invitation mail. It names the business and who registered it, because the
 * claim preview shows the same two facts to whoever holds the token and a mail
 * that said less would make the page look like a surprise. It never carries the
 * national id: that is what the claim checks, and a mail is forwardable.
 */
export function claimInvitationMail(
  input: ClaimInvitationMailInput,
): ClaimInvitationMail {
  const by = input.registrantName ?? 'Someone';
  const until = input.expiresAt.toISOString().slice(0, 10);
  const subject = `Claim ${input.legalName} on Injishi`;
  const text = [
    `Hello ${input.intendedOwnerName},`,
    '',
    `${by} registered ${input.legalName} on Injishi on your behalf. To become its owner, open this link and sign in with the account that holds your national ID:`,
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
        <h1 style="margin:0 0 8px;font-size:20px;color:#042330;">Claim ${escapeHtml(input.legalName)}</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#4a5c62;">Hello ${escapeHtml(input.intendedOwnerName)}, ${escapeHtml(by)} registered this business on Injishi on your behalf.</p>
        <p style="margin:0 0 24px;font-size:14px;color:#4a5c62;">To become its owner, sign in with the account that holds your national ID and confirm the claim.</p>
        <p style="margin:0 0 24px;"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#042330;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">Claim the business</a></p>
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
