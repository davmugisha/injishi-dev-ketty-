/**
 * Ownership transfer: the fixed facts (migration 0155).
 *
 * A business's owner asks for it to pass to another active, identity-verified member of its team; that member accepts
 * or declines. Both sides prove they hold their mailbox at that moment with the existing email step-up, which must be
 * fresh: within `OWNERSHIP_STEP_UP_SECONDS`, the same ten minutes the platform asks before an admin grants authority
 * (`STAFF_GRANT_STEP_UP_SECONDS`). Nothing changes hands until the member accepts, and then all at once.
 *
 * The request carries no secret: the person it names must be signed in as themselves, identity-verified and freshly
 * stepped up to accept it, and it can be decided once. So the mail that announces it carries no link worth stealing.
 */

/** How long a request stays open: 7 days, the life of every invitation (`CLAIM_INVITATION_TTL_DAYS`). */
export const OWNERSHIP_TRANSFER_TTL_DAYS = 7;

/** How recent the email step-up must be to ask for, or accept, a transfer: ten minutes. */
export const OWNERSHIP_STEP_UP_SECONDS = 10 * 60;

/** Every refusal a recipient could use to probe is this one sentence (the owner claim's rule, ADR-053). */
export const NO_OPEN_TRANSFER = 'That ownership transfer is not open any more.';

export const STEP_UP_STALE_MESSAGE =
  'Confirm it is you first: ask for a code, enter the code we email you, then try again within ten minutes.';

const DAY_MS = 24 * 60 * 60 * 1000;

export function transferExpiresAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + OWNERSHIP_TRANSFER_TTL_DAYS * DAY_MS);
}

export interface OwnershipTransferMailInput {
  legalName: string;
  toName: string;
  fromName: string;
  previousOwnerRoleLabel: string;
  appUrl: string;
  expiresAt: Date;
}

/** The mail to the member asked to become owner. It names who asked and what happens; it carries no token. */
export function ownershipTransferMail(input: OwnershipTransferMailInput): { subject: string; text: string; html: string } {
  const until = input.expiresAt.toISOString().slice(0, 10);
  const signIn = new URL('/sign-in', input.appUrl).toString();
  const subject = `${input.fromName} wants to make you the owner of ${input.legalName}`;
  const text = [
    `Hello ${input.toName},`,
    '',
    `${input.fromName}, the owner of ${input.legalName} on Injishi, has asked to make you its owner. If you accept, you get every permission of the business, its plan and billing, and the right to transfer it again; ${input.fromName} stays on the team as ${input.previousOwnerRoleLabel}.`,
    '',
    `To accept or decline, sign in to Injishi with this email address. The request is waiting on your screen; you confirm it with a code we email you.`,
    '',
    signIn,
    '',
    `The request expires on ${until}. Nothing changes unless you accept. If you did not expect this, you can ignore this email or decline it.`,
  ].join('\n');
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f6f6;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#042330;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 8px;font-size:20px;color:#042330;">Become the owner of ${escapeHtml(input.legalName)}?</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#4a5c62;">Hello ${escapeHtml(input.toName)}, ${escapeHtml(input.fromName)} has asked to make you the owner. You would get every permission, the plan and billing, and the right to transfer it again; ${escapeHtml(input.fromName)} stays on the team as ${escapeHtml(input.previousOwnerRoleLabel)}.</p>
        <p style="margin:0 0 24px;font-size:14px;color:#4a5c62;">Sign in with this email address: the request is waiting on your screen, and you confirm it with a code we email you.</p>
        <p style="margin:0 0 24px;"><a href="${escapeHtml(signIn)}" style="display:inline-block;background:#042330;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">Sign in to Injishi</a></p>
        <p style="margin:0;font-size:12px;color:#8a999e;">The request expires on ${until}. Nothing changes unless you accept.</p>
      </td></tr>
    </table>
  </body>
</html>`;
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
