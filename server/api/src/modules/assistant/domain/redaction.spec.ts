import { redact } from './redaction';

describe('redact (ADR-061 D-g)', () => {
  it.each([
    ['email', 'write to aline.uwase+hotel@example.rw please', 'write to [email] please'],
    ['international phone', 'call +250 788 123 456 now', 'call [phone] now'],
    ['compact international phone', 'call +250788123456', 'call [phone]'],
    ['local mobile', 'my number is 0788123456.', 'my number is [phone].'],
    ['grouped local mobile', 'or 078 812 3456', 'or [phone]'],
    ['national id', 'ID 1199080012345678 here', 'ID [national-id] here'],
    ['grouped national id', 'ID 1 1990 8 0012345 6 78', 'ID [national-id]'],
    ['tin', 'our TIN is 999031001', 'our TIN is [tin]'],
  ])('removes a %s', (_label, input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it.each([
    ['a price with separators', 'Room 204 costs 60,000 RWF, rising to 70,000 RWF'],
    ['a bare price', 'the rate is 70000 a night'],
    ['a date', 'arriving 2026-09-30 and leaving 2026-10-02'],
    ['a uuid', 'booking 550e8400-e29b-41d4-a716-446655440000'],
    ['a uuid made of decimal digits', 'property 11111111-1111-4111-8111-111111111111'],
    ['a run of dates', 'nights 2026-10-10 2026-10-11 2026-10-12'],
    ['a booking reference', 'reference BK-7F3K2Q'],
    ['a short count', 'we have 12 rooms and 3 staff'],
  ])('keeps %s', (_label, input) => {
    expect(redact(input)).toBe(input);
  });

  it('redacts every occurrence, not only the first', () => {
    expect(redact('a@x.rw and b@y.rw')).toBe('[email] and [email]');
  });
});
