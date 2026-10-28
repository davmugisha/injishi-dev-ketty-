import { inflateSync } from 'node:zlib';

import { buildLeaseContract, contractHash, type LeaseContractInput } from '@injishi/contracts';

import { pdfText, renderLeasePdf, stamp } from './lease-pdf';

/**
 * The lease PDF renders, and what it prints is the contract's text: the
 * parties by name, the home down to its village, and, once anyone signed, an
 * audit trail page with the fingerprint.
 *
 * pdfkit compresses each page and writes text as hex glyph runs, so the test
 * inflates every stream and decodes the runs back to text before searching it.
 */
function textOf(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  let out = '';
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const body = pdf.subarray(start, end);
    let content: string;
    try {
      content = inflateSync(body).toString('latin1');
    } catch {
      continue;
    }
    // Each text line is one `[...] TJ` array of hex runs and kerning numbers.
    for (const tj of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const runs = [...(tj[1] ?? '').matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => Buffer.from(h[1] ?? '', 'hex').toString('latin1'));
      out += runs.join('') + '\n';
    }
  }
  return out;
}

const input: LeaseContractInput = {
  landlord: {
    legalName: 'Kacyiru Court Ltd',
    signatoryName: 'Jean Mugabo',
    idNumber: '1198080012345012',
    phone: '+250788000111',
    email: 'jean@kacyiru.rw',
  },
  tenant: {
    fullName: 'Aimée Uwera',
    idKind: 'national_id',
    idNumber: '1199070012345012',
    nationality: 'RW',
    phone: '+250788123456',
    email: 'aimee@example.rw',
  },
  premises: {
    property: 'Kacyiru Court',
    unit: 'B-07',
    block: 'B',
    street: 'KG 11 Ave',
    village: 'Rebero',
    cell: 'Kamatamu',
    sector: 'Kacyiru',
    district: 'Gasabo',
    province: 'Kigali City',
  },
  terms: {
    startDate: '2026-11-01',
    endDate: '2027-10-31',
    billingStartsOn: null,
    monthlyRentRwf: 400_000,
    depositRwf: 800_000,
    rentDueDay: 5,
    graceDays: 5,
    noticeDays: 30,
    occupants: ['Ines Habineza'],
    otherTerms: 'Parking for one car.',
  },
};

describe('renderLeasePdf', () => {
  const contract = buildLeaseContract(input, '2026-10-24T08:00:00.000Z');
  const hash = contractHash(contract);

  it('renders a preview with the parties, the home and every clause', async () => {
    const pdf = await renderLeasePdf({
      reference: 'L-0001',
      leaseId: '33333333-3333-4333-8333-333333333333',
      version: 2,
      contract,
      documentHash: hash,
      signatures: [],
      signed: false,
      generatedAt: new Date('2026-10-24T08:00:00Z'),
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = textOf(pdf);
    expect(text).toContain('Kacyiru Court Ltd');
    expect(text).toContain('Represented by Jean Mugabo');
    expect(text).toContain('Aimée Uwera');
    expect(text).toContain('Rebero village');
    expect(text).toContain('RWF 400,000');
    expect(text).toContain('Preview, not signed');
    expect(text).toContain('Parking for one car.');
    for (const clause of contract.clauses) expect(text).toContain(clause.heading);
    // No signature yet: no audit trail page.
    expect(text).not.toContain('Audit trail');
  });

  it('adds the audit trail page with the fingerprint once someone signed', async () => {
    const pdf = await renderLeasePdf({
      reference: 'L-0001',
      leaseId: '33333333-3333-4333-8333-333333333333',
      version: 2,
      contract,
      documentHash: hash,
      signatures: [
        {
          role: 'landlord',
          typedName: 'Jean Mugabo',
          email: 'jean@kacyiru.rw',
          ip: '197.243.0.10',
          userAgent: 'Mozilla/5.0',
          signedAt: new Date('2026-10-24T09:00:00Z'),
          verifiedAt: new Date('2026-10-24T09:00:00Z'),
          method: 'email_code',
          drawing: null,
        },
      ],
      signed: false,
      generatedAt: new Date('2026-10-24T09:05:00Z'),
    });
    const text = textOf(pdf);
    expect(text).toContain('Audit trail');
    expect(text).toContain(hash);
    expect(text).toContain('with a code emailed to them');
    expect(text).toContain('24 October 2026, 11:00 Kigali time');
  });
});

describe('pdf words', () => {
  it('a moment is said in Kigali time without locale tables', () => {
    expect(stamp(new Date('2026-10-24T22:30:00Z'))).toBe('25 October 2026, 00:30 Kigali time');
  });

  it('keeps accents Helvetica can print and plains what it cannot', () => {
    expect(pdfText('Aimée’s “home” – ok…')).toBe('Aimée\'s "home" - ok...');
    expect(pdfText('Ştefan Ćosić')).toBe('Stefan Cosic');
  });
});
