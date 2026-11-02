import { describe, expect, it } from 'vitest';

import type { LeaderGuest } from '@injishi/contracts';
import { inflateRawSync } from 'node:zlib';

import { columnName, excelDay, writeXlsx } from '../infrastructure/xlsx-workbook';
import { exportOrder, guestSheet, guestSummary, hostWords } from './guest-export';
import { renderGuestListPdf } from './guest-list-pdf';
import { csvCell } from './guest-words';

function guest(over: Partial<LeaderGuest> = {}): LeaderGuest {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Grace Mutoni',
    nationality: 'RW',
    nationalityName: 'Rwanda',
    fromAbroad: false,
    idKind: 'national_id',
    idNumber: '1199080045672312',
    phone: '+250788301452',
    relationshipLabel: 'Friend',
    originWords: 'Musanze',
    arrivalOn: '2026-10-30',
    departureOn: '2026-11-02',
    nights: 3,
    stay: 'staying',
    host: { kind: 'tenant', name: 'Aline Uwimana', phone: '+250788000111' },
    place: { type: 'residence', kindLabel: 'Residence', name: 'Amani Residences', room: 'A-01' },
    checkedInAt: null,
    home: {
      propertyName: 'Amani Residences',
      unitLabel: 'A-01',
      address: 'KG 7 Ave, Urugwiro village, Kamatamu cell',
      villageName: 'Urugwiro',
      cellName: 'Kamatamu',
      villageId: 1,
      cellId: 2,
      sectorId: 3,
      districtId: 4,
    },
    chain: [],
    seenByMe: true,
    flagged: false,
    changedAt: null,
    createdAt: '2026-10-29T08:00:00.000Z',
    ...over,
  };
}

const kenyan = guest({
  id: '22222222-2222-4222-8222-222222222222',
  fullName: 'John Kamau',
  nationality: 'KE',
  nationalityName: 'Kenya',
  fromAbroad: true,
  idKind: 'passport',
  idNumber: 'AK1234567',
  phone: '+254712345678',
  arrivalOn: '2026-10-29',
  host: { kind: 'hotel', name: 'Umuco Guest House', phone: null },
  place: { type: 'guest_house', kindLabel: 'Guest house', name: 'Umuco Guest House', room: '12' },
  checkedInAt: '2026-10-29T12:30:00.000Z',
});
const french = guest({ id: '33333333-3333-4333-8333-333333333333', fullName: 'Camille Dubois', nationality: 'FR', nationalityName: 'France', fromAbroad: true, arrivalOn: '2026-10-31' });

describe('the guest list as a file', () => {
  it('local government: Rwandan guests first, then foreign ones by nationality, under a Group column', () => {
    expect(exportOrder([kenyan, french, guest()], 'local').map((g) => g.fullName)).toEqual(['Grace Mutoni', 'Camille Dubois', 'John Kamau']);
    const sheet = guestSheet([kenyan, guest()], 'local');
    expect(sheet.columns.slice(0, 3).map((c) => c.header)).toEqual(['Group', 'Guest', 'Nationality']);
    expect(sheet.columns.map((c) => c.header)).toEqual(expect.arrayContaining(['Type of place', 'Place', 'Host', 'Room or unit']));
    expect(sheet.rows.map((r) => r[0])).toEqual(['Rwandan', 'Foreign']);
  });

  it('DGIE: no Rwandan or foreign column, the document and the check in near the name', () => {
    const sheet = guestSheet([french, kenyan], 'dgie');
    const headers = sheet.columns.map((c) => c.header);
    expect(headers).not.toContain('Group');
    expect(headers.slice(0, 5)).toEqual(['Guest', 'Nationality', 'Country code', 'Document', 'Document number']);
    expect(headers).toEqual(expect.arrayContaining(['Checked in', 'Nights', 'Host', 'Type of place']));
    expect(sheet.rows.map((r) => r[0])).toEqual(['Camille Dubois', 'John Kamau']);
  });

  it('names the host: the business for a hotel, the tenant or landlord for a residence', () => {
    expect(hostWords(kenyan)).toBe('Umuco Guest House');
    expect(hostWords(guest())).toBe('Aline Uwimana (tenant)');
    expect(hostWords(guest({ host: { kind: 'landlord', name: 'Emmanuel', phone: null } }))).toBe('Emmanuel (landlord)');
  });

  it('heads the file with the counts each reader needs', () => {
    const local = guestSummary([guest(), kenyan, french], 'local');
    expect(local[0]?.rows.slice(0, 3)).toEqual([
      ['Guests', 3],
      ['Rwandan', 1],
      ['Foreign', 2],
    ]);
    const dgie = guestSummary([kenyan, french], 'dgie');
    expect(dgie[0]?.rows.slice(0, 2)).toEqual([
      ['Foreign guests', 2],
      ['Nationalities', 2],
    ]);
    expect(dgie.find((s) => s.title === 'By nationality')?.rows).toEqual([
      ['France', 1],
      ['Kenya', 1],
    ]);
  });

  it('writes a real .xlsx: phones and IDs as text with no apostrophe, real dates, a bold frozen filtered header', async () => {
    const sheet = guestSheet([guest(), kenyan], 'local');
    const bytes = await writeXlsx({ title: 'Guests in Urugwiro', meta: [['Prepared by', 'Jeanne']], summary: guestSummary([guest(), kenyan], 'local'), sheets: [sheet] });
    const files = unzip(bytes);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']));
    expect(files['xl/workbook.xml']).toContain('<sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="Guests" sheetId="2" r:id="rId2"/>');
    expect(files['xl/worksheets/sheet1.xml']).toContain('Guests in Urugwiro');

    const ws = files['xl/worksheets/sheet2.xml'] ?? '';
    const col = (name: string): string => columnName(sheet.columns.findIndex((c) => c.header === name) + 1);
    // The header: bold on a fill (style 5), frozen below, with a filter over the whole table.
    expect(ws).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(ws).toContain(`<autoFilter ref="A1:${columnName(sheet.columns.length)}3"/>`);
    expect(ws).toMatch(/<c r="A1" s="5" t="inlineStr"><is><t xml:space="preserve">Group<\/t>/);
    expect(files['xl/styles.xml']).toMatch(/<font><b\/>/);
    // A phone is a text cell (style 1, format @), exactly as typed: no apostrophe, no number.
    expect(ws).toContain(`<c r="${col('Phone')}2" s="1" t="inlineStr"><is><t xml:space="preserve">+250788301452</t></is></c>`);
    expect(ws).not.toContain("'+250");
    expect(ws).toContain(`<c r="${col('ID number')}2" s="1" t="inlineStr"><is><t xml:space="preserve">1199080045672312</t></is></c>`);
    // Days are date numbers in a date format; the check in is the Kigali clock (12:30 UTC is 14:30).
    expect(ws).toContain(`<c r="${col('Arrives')}2" s="2"><v>${excelDay('2026-10-30')}</v></c>`);
    const checkedIn = new RegExp(`<c r="${col('Checked in')}3" s="3"><v>([0-9.]+)</v>`).exec(ws);
    expect(Number(checkedIn?.[1])).toBeCloseTo((excelDay('2026-10-29') ?? 0) + 14.5 / 24, 6);
    expect(ws).toContain(`<c r="${col('Nights')}3" s="4"><v>3</v></c>`);
  });

  it('keeps a CSV phone readable: no guard on an E.164 number, the guard still on a formula', () => {
    expect(csvCell('+250788301452')).toBe('+250788301452');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1+2')).toBe("'+1+2");
    expect(csvCell('-5')).toBe("'-5");
  });

  it('prints the list as a PDF, summary first', async () => {
    const pdf = await renderGuestListPdf({ title: 'Guests in Urugwiro', meta: [['Prepared by', 'Jeanne']], guests: [guest(), kenyan], audience: 'local' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

/** The parts of a zip, as text: enough of the format to read back what `writeXlsx` wrote. */
function unzip(bytes: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < bytes.readUInt16LE(end + 10); i++) {
    const size = bytes.readUInt32LE(at + 20);
    const nameLength = bytes.readUInt16LE(at + 28);
    const extra = bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
    const local = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    out[name] = inflateRawSync(bytes.subarray(start, start + size)).toString('utf8');
    at += 46 + nameLength + extra;
  }
  return out;
}
