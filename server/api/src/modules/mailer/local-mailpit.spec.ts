import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SMTP_TIMEOUTS } from './infrastructure/smtp-mailer.adapter';

/**
 * The local SMTP catcher must greet inside the adapter's bound.
 *
 * Mailpit resolves the client's reverse DNS before it sends 220, and under
 * Docker Desktop that took about eight seconds. The adapter gives a greeting
 * five. So a Mailpit started from the compose file as it was failed every
 * local mail: OTP codes, booking mails, the waitlist note and every training
 * mail, each one only visible as a retry in the queue (found by the waitlist
 * rehearsal, fixed by hand on one laptop, and still missing from the file at
 * the training mail run on 2026-09-13).
 *
 * The file is read as text rather than parsed as YAML: no YAML parser is a
 * dependency of this service, and the assertion is about one service block.
 */
describe('local compose Mailpit', () => {
  const compose = readFileSync(
    resolve(__dirname, '../../../../../infra/docker/docker-compose.yml'),
    'utf8',
  ).replace(/\r\n/g, '\n');
  const block = compose.match(/\n {2}mailpit:\n([\s\S]*?)(?=\n {2}\S|\n\S|$)/)?.[1] ?? '';

  it('has a mailpit service to check', () => {
    expect(block).toMatch(/image: axllent\/mailpit/);
  });

  it('disables the reverse DNS lookup that outlasts the greeting timeout', () => {
    expect(SMTP_TIMEOUTS.greetingTimeout).toBeLessThan(8_000);
    expect(block).toMatch(/MP_SMTP_DISABLE_RDNS:\s*"?true"?/);
  });
});
