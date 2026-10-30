import { describe, expect, it } from 'vitest';

import { CLAIM_CODE_PATTERN } from '@injishi/contracts';

import { mintClaimCode } from './stay-claim';
import { stayInvitationLink, stayInvitationMail } from './stay-invitation';

/**
 * What a guest is actually told when a front desk registers them (§6.8).
 *
 * Not spelling tests. This is the ONLY message that turns a record somebody
 * typed at a counter into something the guest can use, and it is read on a
 * phone, in a lobby, by somebody who has just handed over a passport. Each
 * assertion below pins a promise the product makes in writing at that moment.
 */
describe('the claim invitation mail', () => {
  const facts = {
    propertyName: 'Umurage Guesthouse',
    roomLabel: '204',
    guestName: 'Aline Uwase',
    claimCode: 'UMWE-7241',
    link: 'https://www.injishi.com/activate?code=UMWE-7241',
  };

  it('names the property in the subject, because that is what a guest searches for', () => {
    const mail = stayInvitationMail(facts);
    expect(mail.subject).toContain('Umurage Guesthouse');
  });

  it('puts the code in the plain-text body, on its own, not only behind a link', () => {
    // A guest reads this on one bar of signal. The fallback has to be "type
    // these nine characters", which is why the code has a sayable shape at all.
    const mail = stayInvitationMail(facts);
    expect(mail.text).toContain('UMWE-7241');
    expect(mail.html).toContain('UMWE-7241');
  });

  it('names the room, so a guest can catch a mistake before they go upstairs', () => {
    expect(stayInvitationMail(facts).text).toContain('room 204');
  });

  it('works for a stay with no room label', () => {
    const mail = stayInvitationMail({ ...facts, roomLabel: null });
    expect(mail.text).toContain('Umurage Guesthouse');
    expect(mail.text).not.toContain('room null');
  });

  it('greets a guest with no name without addressing them as null', () => {
    const mail = stayInvitationMail({ ...facts, guestName: null });
    expect(mail.text.startsWith('Hi,')).toBe(true);
  });

  it('leads with what the guest can DO, not with our word for it', () => {
    // "Claim your stay" is our vocabulary. Theirs is: message the desk, order
    // to the room, see the bill, raise a problem. Those are the reason anybody
    // opens the app.
    const mail = stayInvitationMail(facts);
    for (const promise of ['Message the front desk', 'Order food', 'bill', 'money back']) {
      expect(mail.text).toContain(promise);
    }
  });

  it('never states what the guest is spending', () => {
    // A balance in an email is a balance in a notification preview, on a lock
    // screen, at a table with other people. The bill lives behind a sign-in.
    // The claim code carries four digits of its own, so this looks for money:
    // a currency tag, or a grouped amount like `40,000`.
    const mail = stayInvitationMail(facts);
    expect(mail.text).not.toMatch(/RWF|\d{1,3}(,\d{3})+/);
  });

  it('tells somebody who was not checked in here what to do', () => {
    expect(stayInvitationMail(facts).text).toContain('ignore this email');
  });

  it('escapes a property name that carries markup, so the html cannot be steered', () => {
    const mail = stayInvitationMail({
      ...facts,
      propertyName: '<script>alert(1)</script>',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});

describe('stayInvitationLink', () => {
  it('points at web’s /activate with the code prefilled', () => {
    const link = stayInvitationLink('https://www.injishi.com', 'UMWE-7241');
    expect(link).toBe('https://www.injishi.com/activate?code=UMWE-7241');
  });

  it('builds a link a minted code actually fits', () => {
    // The page validates against `CLAIM_CODE_PATTERN` before it calls the API.
    // A generator and a form that disagree is an invitation nobody can redeem.
    for (let i = 0; i < 200; i += 1) {
      const code = mintClaimCode();
      expect(CLAIM_CODE_PATTERN.test(code)).toBe(true);
      expect(stayInvitationLink('https://www.injishi.com', code)).toContain(code);
    }
  });
});
