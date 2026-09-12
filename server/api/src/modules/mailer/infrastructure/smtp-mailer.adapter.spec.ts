// Nodemailer is stood in for by a recorder: this spec pins what the adapter
// ASKS the transport for (URL, bounds, message fields) and what it lets out of
// a failure. Delivery to a real server, and the bounds actually firing, are
// the integration spec's job (`smtp-mailer.integration-spec.ts`).
const mockSendMail = jest.fn();
const mockClose = jest.fn();
const mockCreateTransport = jest.fn<
  { sendMail: jest.Mock; close: jest.Mock },
  unknown[]
>(() => ({ sendMail: mockSendMail, close: mockClose }));
jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

import {
  SMTP_TIMEOUTS,
  SmtpMailerAdapter,
  UnconfiguredMailerAdapter,
} from './smtp-mailer.adapter';

const FROM = 'Injishi <no-reply@injishi.com>';
const MESSAGE = {
  to: 'guest@example.com',
  subject: 'Your Injishi sign-in code',
  text: 'Your Injishi code is 482913.',
  html: '<p>482913</p>',
};

beforeEach(() => {
  mockSendMail.mockReset().mockResolvedValue({ messageId: '<id@test>' });
  mockClose.mockReset();
  mockCreateTransport.mockClear();
});

describe('SmtpMailerAdapter · transport', () => {
  it('builds one transport from the URL with every stage bounded', () => {
    new SmtpMailerAdapter('smtp://mailpit:1025', FROM);
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockCreateTransport).toHaveBeenCalledWith({
      url: 'smtp://mailpit:1025',
      ...SMTP_TIMEOUTS,
    });
  });

  it('bounds every stage far below nodemailer’s own defaults', () => {
    // Nodemailer: 30 s DNS, 2 min connect, 30 s greeting, 10 min socket.
    expect(SMTP_TIMEOUTS.dnsTimeout).toBeLessThanOrEqual(5_000);
    expect(SMTP_TIMEOUTS.connectionTimeout).toBeLessThanOrEqual(5_000);
    expect(SMTP_TIMEOUTS.greetingTimeout).toBeLessThanOrEqual(5_000);
    expect(SMTP_TIMEOUTS.socketTimeout).toBeLessThanOrEqual(10_000);
  });

  it('closes the transport when the module is destroyed', () => {
    new SmtpMailerAdapter('smtp://mailpit:1025', FROM).onModuleDestroy();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});

describe('SmtpMailerAdapter · send', () => {
  it('hands the message to the transport from MAIL_FROM', async () => {
    await new SmtpMailerAdapter('smtp://mailpit:1025', FROM).send(MESSAGE);
    expect(mockSendMail).toHaveBeenCalledWith({ from: FROM, ...MESSAGE });
  });

  it('omits the HTML part when there is none', async () => {
    await new SmtpMailerAdapter('smtp://mailpit:1025', FROM).send({
      to: MESSAGE.to,
      subject: MESSAGE.subject,
      text: MESSAGE.text,
    });
    expect(mockSendMail.mock.calls[0][0]).not.toHaveProperty('html');
  });

  it.each([
    ['a list', 'guest@example.com, other@example.com'],
    ['a second list form', 'guest@example.com;other@example.com'],
    ['a display name', 'Guest <guest@example.com>'],
    ['an injected header', 'guest@example.com\r\nBcc: other@example.com'],
    ['a bare line feed', 'guest@example.com\nother@example.com'],
    ['no address at all', 'guest'],
    ['nothing', ''],
  ])('refuses a recipient that is %s, without sending', async (_label, to) => {
    await expect(
      new SmtpMailerAdapter('smtp://mailpit:1025', FROM).send({ ...MESSAGE, to }),
    ).rejects.toThrow('mail recipient must be one bare email address');
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('refuses a subject that would inject a header, without sending', async () => {
    await expect(
      new SmtpMailerAdapter('smtp://mailpit:1025', FROM).send({
        ...MESSAGE,
        subject: 'Your code\r\nBcc: other@example.com',
      }),
    ).rejects.toThrow('mail subject must be a single line');
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

describe('SmtpMailerAdapter · failure', () => {
  it('rejects with a plain error that carries only the reason', async () => {
    const cause = Object.assign(new Error('Greeting never received'), {
      code: 'ETIMEDOUT',
      response: '421 relay busy',
      command: 'CONN',
    });
    mockSendMail.mockRejectedValue(cause);
    const failure = await new SmtpMailerAdapter('smtp://mailpit:1025', FROM)
      .send(MESSAGE)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(
      'SMTP delivery failed: Greeting never received',
    );
    expect(failure).not.toHaveProperty('response');
    expect(failure).not.toHaveProperty('command');
  });

  it.each([
    ['plain', 'smtps://mailer:s3cret-relay-pw@relay.example.com:465', 's3cret-relay-pw'],
    ['percent-encoded', 'smtps://mailer:p%40ss%21word@relay.example.com:465', 'p@ss!word'],
  ])('scrubs a %s password out of a transport error', async (_label, url, password) => {
    mockSendMail.mockRejectedValue(
      new Error(`Invalid login: 535 rejected ${password} for mailer`),
    );
    const failure = (await new SmtpMailerAdapter(url, FROM)
      .send(MESSAGE)
      .catch((error: unknown) => error)) as Error;
    expect(failure.message).toBe(
      'SMTP delivery failed: Invalid login: 535 rejected *** for mailer',
    );
    expect(failure.message).not.toContain(password);
  });
});

describe('UnconfiguredMailerAdapter', () => {
  it('rejects every send and never touches a transport', async () => {
    await expect(new UnconfiguredMailerAdapter().send()).rejects.toThrow(
      'SMTP_URL is not set',
    );
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
