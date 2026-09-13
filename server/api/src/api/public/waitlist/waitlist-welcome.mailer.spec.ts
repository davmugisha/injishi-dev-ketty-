import type { ConfigService } from '@nestjs/config';

import type { MailMessage, MailerPort } from '../../../modules/mailer/domain/mailer-port';
import { WaitlistWelcomeMailer, type WaitlistWelcome } from './waitlist-welcome.mailer';

/**
 * The welcome note (ADR-048 copy.md §9, AC-11, AC-12).
 *
 * The mailer port is the boundary, so it is the only thing stood in for: the
 * message this builds is captured exactly as it would reach SMTP.
 */

const TOKEN = '8f14e45f-ceea-467a-9f5b-2f7c6d1e0a11';

const TRAVELLER: WaitlistWelcome = {
  email: 'amani@example.com',
  fullName: 'Amani Uwase',
  unsubscribeToken: TOKEN,
};

const OWNER: WaitlistWelcome = {
  email: 'owner@example.com',
  fullName: 'Grace Mukamana',
  unsubscribeToken: TOKEN,
  businessName: 'Umurage Guest House',
  districtName: 'Musanze',
};

// `null` stands for "NEXT_PUBLIC_WEB_URL is unset"; a default parameter would swallow `undefined`.
async function sent(
  welcome: WaitlistWelcome,
  webUrlSetting: string | null = 'https://www.injishi.com',
): Promise<MailMessage> {
  const webUrl = webUrlSetting ?? undefined;
  const send = jest.fn(async () => undefined);
  const config = { get: jest.fn((key: string) => (key === 'NEXT_PUBLIC_WEB_URL' ? webUrl : undefined)) };
  const mailer = new WaitlistWelcomeMailer(
    { send } as unknown as MailerPort,
    config as unknown as ConfigService,
  );

  await mailer.send(welcome);

  expect(send).toHaveBeenCalledTimes(1);
  return (send.mock.calls[0] as unknown as [MailMessage])[0];
}

describe('WaitlistWelcomeMailer · the envelope', () => {
  it('sends one message to the address that joined, with the copy.md subject (covers: AC-11)', async () => {
    const message = await sent(TRAVELLER);

    expect(message.to).toBe('amani@example.com');
    expect(message.subject).toBe('You are on the Injishi waitlist');
  });

  it('greets the person by the name they gave, in both parts', async () => {
    const message = await sent(TRAVELLER);

    expect(message.text).toContain('Hello Amani Uwase,');
    expect(message.html).toContain('Hello Amani Uwase,');
  });

  it('carries the hidden preheader line in the html part', async () => {
    const message = await sent(TRAVELLER);

    expect(message.html).toContain('We will email you the day we open.');
  });
});

describe('WaitlistWelcomeMailer · unsubscribe link', () => {
  it('puts the row token under the web origin in the plain text part (covers: AC-12)', async () => {
    const message = await sent(TRAVELLER);

    expect(message.text).toContain(`Unsubscribe: https://www.injishi.com/waitlist/unsubscribe/${TOKEN}`);
  });

  it('links the same address from the html part (covers: AC-12)', async () => {
    const message = await sent(TRAVELLER);

    expect(message.html).toContain(`<a href="https://www.injishi.com/waitlist/unsubscribe/${TOKEN}">Unsubscribe</a>`);
  });

  it('includes the link in an owner email too, from the first send (covers: AC-12)', async () => {
    const message = await sent(OWNER);

    expect(message.text).toContain(`/waitlist/unsubscribe/${TOKEN}`);
    expect(message.html).toContain(`/waitlist/unsubscribe/${TOKEN}`);
  });

  it('falls back to the local web origin when NEXT_PUBLIC_WEB_URL is unset', async () => {
    const message = await sent(TRAVELLER, null);

    expect(message.text).toContain(`http://localhost:3000/waitlist/unsubscribe/${TOKEN}`);
  });
});

describe('WaitlistWelcomeMailer · the owner paragraph', () => {
  it('tells an owner which business and district they registered', async () => {
    const message = await sent(OWNER);

    expect(message.text).toContain('You told us about Umurage Guest House in Musanze.');
    expect(message.html).toContain('You told us about Umurage Guest House in Musanze.');
  });

  it('never mentions a property to a traveller', async () => {
    const message = await sent(TRAVELLER);

    expect(message.text).not.toContain('You told us about');
    expect(message.html).not.toContain('You told us about');
  });

  it('says "your district" rather than "null" when the district name is missing', async () => {
    const message = await sent({ ...OWNER, districtName: null });

    expect(message.text).toContain('You told us about Umurage Guest House in your district.');
    expect(message.text).not.toMatch(/null|undefined/);
  });

  it('treats an empty business name as a traveller', async () => {
    const message = await sent({ ...OWNER, businessName: '' });

    expect(message.text).not.toContain('You told us about');
  });
});

describe('WaitlistWelcomeMailer · what the copy must never contain', () => {
  const DATE_PATTERNS: [string, RegExp][] = [
    ['a year', /\b(19|20)\d{2}\b/],
    ['a month name', /\b(January|February|March|April|June|July|August|September|October|November|December)\b/],
    ['a quarter', /\bQ[1-4]\b|\bquarter\b/i],
    ['a numeric date', /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/],
  ];

  it('the date patterns catch a real date, so their silence below means something', () => {
    const control = 'We open on 12 March 2027, in Q2, around 12/03/2027.';

    for (const [, pattern] of DATE_PATTERNS) {
      expect(control).toMatch(pattern);
    }
  });

  it.each([
    ['traveller', TRAVELLER],
    ['owner', OWNER],
  ])('a %s email contains no date, month, quarter or year (covers: AC-11)', async (_label, welcome) => {
    const message = await sent(welcome);
    const everything = `${message.subject}\n${message.text}\n${message.html}`;

    for (const [name, pattern] of DATE_PATTERNS) {
      expect({ name, found: everything.match(pattern)?.[0] ?? null }).toEqual({ name, found: null });
    }
  });
});

describe('WaitlistWelcomeMailer · values from a public form', () => {
  it('escapes a name that tries to close a tag in the html part', async () => {
    const message = await sent({ ...TRAVELLER, fullName: '<script>alert("x")</script> & Co' });

    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co');
  });

  it('escapes a business name in the owner paragraph of the html part', async () => {
    const message = await sent({ ...OWNER, businessName: '<img src=x onerror=alert(1)>' });

    expect(message.html).not.toContain('<img src=x');
    expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('keeps the plain text part literal, since it is never rendered as markup', async () => {
    const message = await sent({ ...TRAVELLER, fullName: 'Amani & <Co>' });

    expect(message.text).toContain('Hello Amani & <Co>,');
  });
});

describe('WaitlistWelcomeMailer · a failed send', () => {
  it('lets the mailer error reach the queue so the job is retried (covers: AC-11)', async () => {
    const send = jest.fn(async () => {
      throw new Error('SMTP delivery failed: Greeting never received');
    });
    const mailer = new WaitlistWelcomeMailer(
      { send } as unknown as MailerPort,
      { get: () => 'https://www.injishi.com' } as unknown as ConfigService,
    );

    await expect(mailer.send(TRAVELLER)).rejects.toThrow('Greeting never received');
  });
});
