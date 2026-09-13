import { REJECTION_REASON_LABEL } from '@injishi/contracts';

import {
  fieldVerificationPassedMail,
  officerQueueMail,
  officersCoveringDistrict,
  oversightQueueLink,
  registrationApprovedMail,
  registrationLink,
  registrationReceivedMail,
  registrationRejectedMail,
  registrationSubmittedMail,
  workspaceSetupLink,
  type OfficerAssignmentRow,
  type RegistrationMail,
} from './registration-mail';

const WEB = 'https://www.injishi.com';
const NAME = 'Hotel des Mille Collines Ltd';
const WS = '5b0b8f0e-2f7a-4c36-9d7e-0e7a3c1d2b11';

/** A subject reaches a header, so it must never carry a line break. */
function expectWellFormed(mail: RegistrationMail): void {
  expect(mail.subject).not.toMatch(/[\r\n]/);
  expect(mail.text.length).toBeGreaterThan(0);
  expect(mail.html).toContain('<!doctype html>');
}

describe('registration mail · links', () => {
  it('builds every link on the configured origin', () => {
    expect(registrationLink(WEB)).toBe('https://www.injishi.com/register');
    expect(workspaceSetupLink(WEB, WS)).toBe(`https://www.injishi.com/w/${WS}/setup`);
    expect(oversightQueueLink(WEB, 'business_field_verifier')).toBe(
      'https://www.injishi.com/oversight/verifier/queue',
    );
    expect(oversightQueueLink(WEB, 'business_approver')).toBe(
      'https://www.injishi.com/oversight/approver/queue',
    );
  });
});

describe('registration mail · registrant', () => {
  it('received: names the business, both owed steps, the fee and the link', () => {
    const mail = registrationReceivedMail({
      to: { name: 'Aline Uwase' },
      legalName: NAME,
      amountDueRwf: 50000,
      link: registrationLink(WEB),
    });
    expectWellFormed(mail);
    expect(mail.subject).toBe(`We received your registration for ${NAME}`);
    expect(mail.text).toContain('Hello Aline Uwase,');
    expect(mail.text).toContain('operator contract');
    expect(mail.text).toContain('RWF 50,000');
    expect(mail.text).toContain('https://www.injishi.com/register');
    expect(mail.html).toContain('href="https://www.injishi.com/register"');
  });

  it('received: still reads when no fee amount is known and no name is held', () => {
    const mail = registrationReceivedMail({
      to: { name: null },
      legalName: NAME,
      amountDueRwf: null,
      link: registrationLink(WEB),
    });
    expect(mail.text.startsWith('Hello,')).toBe(true);
    expect(mail.text).toContain('Pay the registration fee.');
  });

  it('submitted: explains the three gates in order', () => {
    const mail = registrationSubmittedMail({
      to: { name: null },
      legalName: NAME,
      hasTin: true,
      resubmitted: false,
      link: registrationLink(WEB),
    });
    expectWellFormed(mail);
    expect(mail.subject).toBe(`Registration submitted — ${NAME}`);
    const rra = mail.text.indexOf('Rwanda Revenue Authority');
    const field = mail.text.indexOf('Field verification');
    const approval = mail.text.indexOf('Approval:');
    expect(rra).toBeGreaterThan(-1);
    expect(field).toBeGreaterThan(rra);
    expect(approval).toBeGreaterThan(field);
  });

  it('submitted: a residence skips the RRA step, a resubmission says no fee is due', () => {
    const mail = registrationSubmittedMail({
      to: { name: null },
      legalName: NAME,
      hasTin: false,
      resubmitted: true,
      link: registrationLink(WEB),
    });
    expect(mail.text).not.toContain('Rwanda Revenue Authority');
    expect(mail.text).toContain('No further fee is due');
  });

  it('field verification passed: says the approver decides next', () => {
    const mail = fieldVerificationPassedMail({
      to: { name: null },
      legalName: NAME,
      link: registrationLink(WEB),
    });
    expectWellFormed(mail);
    expect(mail.subject).toBe(`Field verification passed — ${NAME}`);
    expect(mail.text).toContain('approver');
  });

  it('rejected: quotes the reason label and the officer notes verbatim', () => {
    const mail = registrationRejectedMail({
      to: { name: null },
      legalName: NAME,
      gate: 'field_verified',
      reasonCode: 'documents_expired',
      notes: 'Fire safety certificate expired in March.',
      link: registrationLink(WEB),
    });
    expectWellFormed(mail);
    expect(mail.subject).toBe(`Registration not approved — ${NAME}`);
    expect(mail.text).toContain(REJECTION_REASON_LABEL.documents_expired);
    expect(mail.text).toContain('Fire safety certificate expired in March.');
    expect(mail.text).toContain('was not approved at the final approval stage.');
    expect(mail.text).toContain('nothing more is charged');
  });

  it('rejected: an RRA failure names the TIN reason, and blank notes are left out', () => {
    const mail = registrationRejectedMail({
      to: { name: null },
      legalName: NAME,
      gate: 'tin_check',
      reasonCode: null,
      notes: '   ',
      link: registrationLink(WEB),
    });
    expect(mail.text).toContain(REJECTION_REASON_LABEL.tin_not_found);
    expect(mail.text).not.toContain('Officer notes');
  });

  it('approved: links to the workspace setup screen', () => {
    const mail = registrationApprovedMail({
      to: { name: null },
      legalName: NAME,
      awaitingClaim: false,
      setupLink: workspaceSetupLink(WEB, WS),
    });
    expectWellFormed(mail);
    expect(mail.subject).toBe(`${NAME} is approved — set up your property`);
    expect(mail.text).toContain(`/w/${WS}/setup`);
  });

  it('approved on behalf of an owner: no setup link, says it waits for the claim', () => {
    const mail = registrationApprovedMail({
      to: { name: null },
      legalName: NAME,
      awaitingClaim: true,
      statusLink: registrationLink(WEB),
    });
    expect(mail.subject).toBe(`${NAME} is approved — waiting for the owner to claim it`);
    expect(mail.text).not.toContain('/setup');
    expect(mail.text).toContain('claim');
  });

  it('escapes markup a registrant typed into the business name', () => {
    const mail = registrationReceivedMail({
      to: { name: '<b>x</b>' },
      legalName: 'A & B <script>',
      amountDueRwf: 1,
      link: registrationLink(WEB),
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('A &amp; B &lt;script&gt;');
    expect(mail.html).not.toContain('<b>x</b>');
  });
});

describe('registration mail · officers', () => {
  it('names the business, its place, the TIN and the queue link', () => {
    const mail = officerQueueMail({
      to: { name: 'Jean Bosco' },
      role: 'business_field_verifier',
      legalName: NAME,
      districtName: 'Gasabo',
      sectorName: 'Bumbogo',
      tin: '123456789',
      link: oversightQueueLink(WEB, 'business_field_verifier'),
    });
    expectWellFormed(mail);
    expect(mail.subject).toBe(`Field verification needed — ${NAME}`);
    expect(mail.text).toContain('Bumbogo, Gasabo');
    expect(mail.text).toContain('123456789');
    expect(mail.text).toContain('/oversight/verifier/queue');
  });

  it('words the approval queue as a final decision', () => {
    const mail = officerQueueMail({
      to: { name: null },
      role: 'business_approver',
      legalName: NAME,
      districtName: null,
      sectorName: null,
      tin: null,
      link: oversightQueueLink(WEB, 'business_approver'),
    });
    expect(mail.subject).toBe(`Approval needed — ${NAME}`);
    expect(mail.text).not.toContain('Location');
    expect(mail.text).not.toContain('TIN:');
  });
});

describe('officersCoveringDistrict', () => {
  const row = (
    userId: string,
    scope: Pick<OfficerAssignmentRow, 'scopeLevel' | 'provinceId' | 'districtId'>,
  ): OfficerAssignmentRow => ({ userId, email: `${userId}@example.test`, name: null, ...scope });
  const provinces = new Map<number, number[]>([[1, [101, 102, 103]]]);

  it('keeps district, province and country scopes that reach the district', () => {
    const got = officersCoveringDistrict(
      [
        row('district', { scopeLevel: 'district', provinceId: null, districtId: 102 }),
        row('elsewhere', { scopeLevel: 'district', provinceId: null, districtId: 301 }),
        row('province', { scopeLevel: 'province', provinceId: 1, districtId: null }),
        row('other-province', { scopeLevel: 'province', provinceId: 3, districtId: null }),
        row('country', { scopeLevel: 'country', provinceId: null, districtId: null }),
      ],
      provinces,
      102,
    );
    expect(got.map((o) => o.userId).sort()).toEqual(['country', 'district', 'province']);
  });

  it('mails an officer with several covering assignments once', () => {
    const got = officersCoveringDistrict(
      [
        row('both', { scopeLevel: 'district', provinceId: null, districtId: 301 }),
        row('both', { scopeLevel: 'district', provinceId: null, districtId: 102 }),
        row('both', { scopeLevel: 'province', provinceId: 1, districtId: null }),
      ],
      provinces,
      102,
    );
    expect(got).toEqual([{ userId: 'both', email: 'both@example.test', name: null }]);
  });

  it('a business with no district reaches only a country scope', () => {
    const got = officersCoveringDistrict(
      [
        row('district', { scopeLevel: 'district', provinceId: null, districtId: 102 }),
        row('country', { scopeLevel: 'country', provinceId: null, districtId: null }),
      ],
      provinces,
      null,
    );
    expect(got.map((o) => o.userId)).toEqual(['country']);
  });
});
