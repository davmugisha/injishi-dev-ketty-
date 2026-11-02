import { describe, expect, it } from 'vitest';

import type { LeaderGuest } from '@injishi/contracts';
import ExcelJS from 'exceljs';

import { writeXlsx } from '../infrastructure/xlsx-workbook';
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
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes as unknown as ArrayBuffer);
    expect(book.worksheets.map((w) => w.name)).toEqual(['Summary', 'Guests']);
    expect(book.getWorksheet('Summary')?.getCell('A1').value).toBe('Guests in Urugwiro');

    const ws = book.getWorksheet('Guests');
    if (!ws) throw new Error('no Guests sheet');
    const header = ws.getRow(1);
    const col = (name: string): number => (header.values as unknown[]).indexOf(name);
    expect(header.font?.bold).toBe(true);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();

    const phone = ws.getRow(2).getCell(col('Phone'));
    expect(phone.value).toBe('+250788301452');
    expect(typeof phone.value).toBe('string');
    expect(String(phone.value).startsWith("'")).toBe(false);
    expect(phone.numFmt).toBe('@');
    expect(ws.getRow(2).getCell(col('ID number')).value).toBe('1199080045672312');

    const arrives = ws.getRow(2).getCell(col('Arrives')).value;
    expect(arrives).toBeInstanceOf(Date);
    expect((arrives as Date).toISOString()).toBe('2026-10-30T00:00:00.000Z');
    // The check in reads as the Kigali clock: 12:30 UTC is 14:30 in Kigali.
    expect((ws.getRow(3).getCell(col('Checked in')).value as Date).toISOString()).toBe('2026-10-29T14:30:00.000Z');
    expect(ws.getRow(3).getCell(col('Nights')).value).toBe(3);
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
