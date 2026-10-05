import { csvCell, toCsv } from './csv';

/**
 * The export file (058-list-framework AC-LF7). What matters is what a
 * spreadsheet does on opening it, so these assert the bytes.
 */

describe('csvCell', () => {
  it('neutralises a cell a spreadsheet would run as a formula', () => {
    for (const typed of ['=HYPERLINK("http://x")', '+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd']) {
      expect(csvCell(typed).replace(/^"|"$/g, '').startsWith("'")).toBe(true);
    }
  });

  it('writes a negative number as a number, not as text', () => {
    expect(csvCell(-2500)).toBe('-2500');
  });

  it('quotes commas, quotes and line breaks, doubling inner quotes', () => {
    expect(csvCell('Uwase, Aline')).toBe('"Uwase, Aline"');
    expect(csvCell('the "night" cook')).toBe('"the ""night"" cook"');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('leaves an empty cell for nothing and spells booleans', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(true)).toBe('yes');
  });
});

describe('toCsv', () => {
  it('starts with a byte order mark and ends every line with CRLF', () => {
    const csv = toCsv(
      [
        { header: 'Name', value: (r: { name: string; days: number }) => r.name },
        { header: 'Days', value: (r: { name: string; days: number }) => r.days },
      ],
      [{ name: 'Mukamana Béatrice', days: 2.5 }],
    );
    expect(csv).toBe('﻿Name,Days\r\nMukamana Béatrice,2.5\r\n');
  });
});
