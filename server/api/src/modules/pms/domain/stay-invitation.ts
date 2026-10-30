/**
 * THE MAIL A GUEST GETS AT THE COUNTER (§6.8).
 *
 * The desk has just typed their name, their document and their address into a
 * screen they cannot see, and handed them a key. This message is the whole of
 * what turns that record into something the guest can use: it says which hotel,
 * which room, what the code is, and what opening the app gets them.
 *
 * ## The rules the copy follows
 *
 * **The code is in the body, in plain text, on its own line.** Not only behind
 * a link. A guest reads this on a phone with one bar of signal in a lobby, and
 * the fallback has to be "type these nine characters", which is exactly why the
 * code has a sayable shape in the first place.
 *
 * **It never says what the guest is spending.** A folio balance in an email is
 * a folio balance in a mail client's notification preview, on a lock screen, at
 * a table with other people. The bill lives behind a sign-in.
 *
 * **It leads with what they can DO.** "Claim your stay" is our word for it. The
 * guest's words are: message the front desk, order to the room, see the bill,
 * ask about a charge. Those are the four lines, and they are the reason anybody
 * opens the app at all.
 *
 * **Nothing here is a credential except the code.** No session, no magic token
 * that signs somebody in. The link opens a page; the page asks them to sign in
 * as themselves and then binds the stay. That extra step is deliberate: a
 * mailbox is not a person, and this mail names a room number.
 */

export interface StayInvitationMailInput {
  /** The hotel, as the guest thinks of it. */
  propertyName: string;
  /** Null when the room has no label worth printing. */
  roomLabel: string | null;
  /** The name on the registration card, for the greeting. */
  guestName: string | null;
  claimCode: string;
  /** `${WEB_URL}/activate?code=...` */
  link: string;
}

/**
 * `${WEB_URL}/activate?code=<code>`.
 *
 * Web owns `/activate`, as it owns sign-in: one account, one place a person
 * binds anything to it. The code rides in the query so the page can prefill the
 * field — the guest tapping a link should not then have to read the same code
 * back out of the same email.
 */
export function stayInvitationLink(webUrl: string, claimCode: string): string {
  const url = new URL('/activate', webUrl);
  url.searchParams.set('code', claimCode);
  return url.toString();
}

export function stayInvitationMail(input: StayInvitationMailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const where = input.roomLabel
    ? `${input.propertyName}, room ${input.roomLabel}`
    : input.propertyName;
  const hello = input.guestName
    ? `Hi ${input.guestName.split(' ')[0]},`
    : 'Hi,';
  const subject = `Your stay at ${input.propertyName} — continue on Injishi`;

  const text = [
    hello,
    '',
    `You have been checked in at ${where}. Open Injishi to carry on from your phone:`,
    '',
    '  · Message the front desk, housekeeping or any other desk in the building',
    '  · Order food and drink to your room',
    '  · See what is on your bill as it happens',
    '  · Raise a problem, or ask for money back, and get an answer in writing',
    '',
    'Open this link and sign in, then confirm the code below:',
    '',
    input.link,
    '',
    `  Claim code   ${input.claimCode}`,
    '',
    'The code works once and only for this stay. If you were not checked in at',
    'this property, ignore this email and tell the front desk.',
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f6f6;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#042330;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 8px;font-size:20px;color:#042330;">You are checked in at ${escapeHtml(input.propertyName)}</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#4a5c62;">${escapeHtml(where)}. Open Injishi to carry on from your phone.</p>
        <ul style="margin:0 0 24px;padding-left:18px;font-size:14px;color:#4a5c62;">
          <li style="margin-bottom:6px;">Message the front desk, housekeeping or any other desk in the building</li>
          <li style="margin-bottom:6px;">Order food and drink to your room</li>
          <li style="margin-bottom:6px;">See what is on your bill as it happens</li>
          <li>Raise a problem, or ask for money back, and get an answer in writing</li>
        </ul>
        <p style="margin:0 0 24px;"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#042330;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">Claim your stay</a></p>
        <p style="margin:0 0 8px;font-size:14px;color:#4a5c62;">Or type this code into the app:</p>
        <p style="margin:0 0 24px;font-size:22px;font-weight:700;letter-spacing:2px;color:#042330;">${escapeHtml(input.claimCode)}</p>
        <p style="margin:0;font-size:12px;color:#8a999e;">The code works once and only for this stay. If you were not checked in at this property, ignore this email and tell the front desk.</p>
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
