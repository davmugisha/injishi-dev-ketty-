/**
 * The booking stepper's logic, without a screen.
 *
 * The payment validation carries most of the weight here, because it is the
 * only place in the Guest flow where the app tells someone their input is
 * wrong. Every assertion below is a way that could go wrong for a guest holding
 * a correct number.
 */
import { en } from '@/i18n/messages';
import type { MessageKey, Translate } from '@/i18n/i18n';
import {
  blockedOnDates,
  blockedOnPay,
  blockedOnSummary,
  checkCardNumber,
  checkCvv,
  checkExpiry,
  checkHandset,
  confirmationFor,
  groupCard,
  groupExpiry,
  groupHandset,
  initialsOf,
  luhn,
  mintReference,
  nationalDigits,
  networkFor,
  nightsIn,
  payMethod,
  quote,
  uuidV4,
  type StepInput,
} from './book-format';

/** The real EN catalogue with real interpolation, so a note is asserted whole. */
const t: Translate = ((key: MessageKey, params?: Record<string, string | number>) => {
  const raw: string = en[key];
  return params
    ? raw.replace(/\{(\w+)\}/g, (_m, name: string) => String(params[name] ?? `{${name}}`))
    : raw;
}) as Translate;

/* ------------------------------------------------------------- the handset */

describe('nationalDigits', () => {
  // A Rwandan handset is written four ways and all four are correct. Rejecting
  // any of them is rejecting a number the guest read off their own phone.
  it.each([
    ['0788431209', '788431209'],
    ['788431209', '788431209'],
    ['+250788431209', '788431209'],
    ['250 788 431 209', '788431209'],
    ['+250 788 431 209', '788431209'],
  ])('reads %s as %s', (typed, expected) => {
    expect(nationalDigits(typed)).toBe(expected);
  });
});

describe('checkHandset', () => {
  it('says nothing about an empty field', () => {
    const note = checkHandset('', 'momo', t);
    expect(note).toEqual({ ok: false, tone: 'none', text: null });
  });

  it('names the length and gives an example when the number is short', () => {
    const note = checkHandset('0788 431', 'momo', t);
    expect(note.ok).toBe(false);
    expect(note.tone).toBe('error');
    expect(note.text).toBe('A Rwandan mobile number is nine digits, like 0788 123 456.');
  });

  it('accepts an MTN number on MoMo and confirms which handset gets the prompt', () => {
    const note = checkHandset('0788431209', 'momo', t);
    expect(note.ok).toBe(true);
    expect(note.tone).toBe('hint');
    expect(note.text).toBe('We will send the prompt to 0788 431 209.');
  });

  it('accepts 79 on MoMo and 72 and 73 on Airtel', () => {
    expect(checkHandset('0790000000', 'momo', t).ok).toBe(true);
    expect(checkHandset('0720000000', 'airtel', t).ok).toBe(true);
    expect(checkHandset('0730000000', 'airtel', t).ok).toBe(true);
  });

  it('names the OTHER method when the number is on the other network', () => {
    // The canvas's most careful string: the number is fine, the method is not,
    // and telling the guest their number is invalid would be a lie.
    const note = checkHandset('0730000000', 'momo', t);
    expect(note.ok).toBe(false);
    expect(note.text).toBe('That number is on Airtel Money. Pick Airtel Money above.');
  });

  it('falls back to the prefix rule for a nine-digit number on no network', () => {
    const note = checkHandset('0750000000', 'momo', t);
    expect(note.ok).toBe(false);
    expect(note.text).toBe('MTN MoMo numbers start 78 or 79.');
  });

  it('holds its peace on the card method, which takes no handset', () => {
    expect(checkHandset('anything', 'card', t).tone).toBe('none');
  });
});

describe('networkFor', () => {
  it('maps each prefix to its own method and nothing else', () => {
    expect(networkFor('788431209')?.id).toBe('momo');
    expect(networkFor('798431209')?.id).toBe('momo');
    expect(networkFor('728431209')?.id).toBe('airtel');
    expect(networkFor('738431209')?.id).toBe('airtel');
    expect(networkFor('758431209')).toBeUndefined();
  });
});

describe('groupHandset', () => {
  it('groups as it is typed and stops at nine digits', () => {
    expect(groupHandset('7')).toBe('7');
    expect(groupHandset('78843')).toBe('788 43');
    expect(groupHandset('0788431209')).toBe('788 431 209');
    expect(groupHandset('078843120999')).toBe('788 431 209');
  });
});

/* ---------------------------------------------------------------- the card */

describe('luhn', () => {
  it('passes the test numbers and fails a transposed pair', () => {
    expect(luhn('4242424242424242')).toBe(true);
    expect(luhn('5555555555554444')).toBe(true);
    expect(luhn('378282246310005')).toBe(true);
    // One digit moved: the single typo Luhn exists to catch.
    expect(luhn('4242424242424252')).toBe(false);
  });

  it('refuses an empty string rather than dividing zero by ten', () => {
    expect(luhn('')).toBe(false);
  });
});

describe('checkCardNumber', () => {
  it('is silent on an empty field, complains about length, then about the checksum', () => {
    expect(checkCardNumber('', t).tone).toBe('none');
    expect(checkCardNumber('4242 4242', t).text).toBe('A card number is 13 to 19 digits.');
    expect(checkCardNumber('4242 4242 4242 4252', t).text).toBe(
      'Check the card number, a digit is off.',
    );
    expect(checkCardNumber('4242 4242 4242 4242', t).ok).toBe(true);
  });
});

describe('checkExpiry', () => {
  const now = new Date(2026, 8, 6); // September 2026

  it('takes the current month and refuses the one before it', () => {
    // A card expires at the END of its month, so this month is still good.
    expect(checkExpiry('09 / 26', t, now).ok).toBe(true);
    expect(checkExpiry('08 / 26', t, now).text).toBe('That card has expired.');
  });

  it('refuses a month that does not exist', () => {
    expect(checkExpiry('13 / 28', t, now).text).toBe('Use MM / YY, like 09 / 28.');
    expect(checkExpiry('00 / 28', t, now).text).toBe('Use MM / YY, like 09 / 28.');
  });

  it('asks for four digits before judging them', () => {
    expect(checkExpiry('9', t, now).text).toBe('Use MM / YY, like 09 / 28.');
    expect(checkExpiry('', t, now).tone).toBe('none');
  });
});

describe('checkCvv', () => {
  it('takes three or four digits', () => {
    expect(checkCvv('123', t).ok).toBe(true);
    expect(checkCvv('1234', t).ok).toBe(true);
    expect(checkCvv('12', t).text).toBe(
      'The security code is 3 digits, or 4 on American Express.',
    );
  });
});

describe('groupCard and groupExpiry', () => {
  it('groups a card in fours and an expiry as MM / YY', () => {
    expect(groupCard('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(groupExpiry('09')).toBe('09');
    expect(groupExpiry('0928')).toBe('09 / 28');
  });
});

/* --------------------------------------------------------------- the gates */

const BASE: StepInput = {
  dates: { start: '2026-09-04', end: '2026-09-07' },
  party: { adults: 2, children: 0, infants: 1 },
  sleeps: 4,
  soldOut: false,
  acceptedRules: false,
  method: 'momo',
  handset: '',
  cardNumber: '',
  cardExpiry: '',
  cardCvv: '',
};

describe('blockedOnDates', () => {
  it('passes a complete range inside the room capacity', () => {
    expect(blockedOnDates(BASE)).toBeNull();
  });

  it('asks for the dates before anything else', () => {
    expect(blockedOnDates({ ...BASE, dates: { start: '2026-09-04', end: null } })).toBe(
      'book.blockedDates',
    );
  });

  it('puts sold out ahead of every other reason', () => {
    // A room with nothing left cannot be fixed by picking different dates, so
    // asking for dates first would send the guest down a road with no end.
    expect(blockedOnDates({ ...BASE, soldOut: true, dates: { start: null, end: null } })).toBe(
      'book.blockedSoldOut',
    );
  });

  it('counts adults and children against capacity but not infants', () => {
    expect(blockedOnDates({ ...BASE, party: { adults: 4, children: 0, infants: 3 } })).toBeNull();
    expect(blockedOnDates({ ...BASE, party: { adults: 4, children: 1, infants: 0 } })).toBe(
      'book.blockedParty',
    );
  });
});

describe('blockedOnSummary', () => {
  it('holds the step until the house rules are acknowledged', () => {
    expect(blockedOnSummary(BASE)).toBe('book.blockedRules');
    expect(blockedOnSummary({ ...BASE, acceptedRules: true })).toBeNull();
  });
});

describe('blockedOnPay', () => {
  const now = new Date(2026, 8, 6);

  it('wants a handset on the number-based methods', () => {
    expect(blockedOnPay(BASE, now)).toBe('book.blockedHandset');
    expect(blockedOnPay({ ...BASE, handset: '0788431209' }, now)).toBeNull();
  });

  it('refuses a number on the wrong network, not just a malformed one', () => {
    expect(blockedOnPay({ ...BASE, handset: '0730000000' }, now)).toBe('book.blockedHandset');
    expect(blockedOnPay({ ...BASE, method: 'airtel', handset: '0730000000' }, now)).toBeNull();
  });

  it('wants all three card fields, each of them valid', () => {
    const card: StepInput = { ...BASE, method: 'card' };
    expect(blockedOnPay(card, now)).toBe('book.blockedCard');
    expect(
      blockedOnPay(
        { ...card, cardNumber: '4242424242424242', cardExpiry: '0928', cardCvv: '123' },
        now,
      ),
    ).toBeNull();
    expect(
      blockedOnPay(
        { ...card, cardNumber: '4242424242424242', cardExpiry: '0825', cardCvv: '123' },
        now,
      ),
    ).toBe('book.blockedCard');
  });
});

/* ---------------------------------------------------------- the arithmetic */

describe('quote', () => {
  it('is the contract implementation and nothing else', () => {
    // The canvas's own worked example: Garden Suite, 240,000, three nights.
    const money = quote({
      nightlyRateRwf: 240_000,
      dates: { start: '2026-09-04', end: '2026-09-07' },
      nonRefundable: false,
    });
    expect(money).toBeDefined();
    expect(money?.nights).toBe(3);
    expect(money?.accommodationRwf).toBe(720_000);
    expect(money?.serviceFeeRwf).toBe(36_000);
    expect(money?.grossRwf).toBe(756_000);
  });

  it('applies the discount to the accommodation total and rounds once', () => {
    const money = quote({
      nightlyRateRwf: 240_000,
      dates: { start: '2026-09-04', end: '2026-09-07' },
      nonRefundable: true,
    });
    expect(money?.nonRefundableDiscountRwf).toBe(72_000);
    // 720,000 − 72,000 = 648,000, fee 32,400, gross 680,400.
    expect(money?.serviceFeeRwf).toBe(32_400);
    expect(money?.grossRwf).toBe(680_400);
  });

  it('returns nothing rather than a zero breakdown when there is nothing to price', () => {
    const incomplete = { start: '2026-09-04', end: null };
    expect(quote({ nightlyRateRwf: 240_000, dates: incomplete, nonRefundable: false })).toBeUndefined();
    expect(
      quote({
        nightlyRateRwf: null,
        dates: { start: '2026-09-04', end: '2026-09-07' },
        nonRefundable: false,
      }),
    ).toBeUndefined();
    // A same-day range is zero nights, which is not a stay.
    expect(
      quote({
        nightlyRateRwf: 240_000,
        dates: { start: '2026-09-04', end: '2026-09-04' },
        nonRefundable: false,
      }),
    ).toBeUndefined();
  });
});

describe('nightsIn', () => {
  it('counts nights, and none while the range is open', () => {
    expect(nightsIn({ start: '2026-09-04', end: '2026-09-07' })).toBe(3);
    expect(nightsIn({ start: '2026-09-04', end: null })).toBe(0);
  });
});

/* ---------------------------------------------------------------- the mint */

describe('uuidV4', () => {
  it('has the shape a uuid validator accepts', () => {
    expect(uuidV4()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('does not repeat itself', () => {
    const many = new Set(Array.from({ length: 500 }, () => uuidV4()));
    expect(many.size).toBe(500);
  });
});

describe('mintReference', () => {
  it('is BK- and six characters', () => {
    expect(mintReference()).toMatch(/^BK-[0-9A-Z]{6}$/);
  });

  it('never uses a glyph that is misread aloud', () => {
    // O/0 and I/1 are the pairs a reference gets wrong at a noisy reception.
    const many = Array.from({ length: 400 }, () => mintReference()).join('');
    expect(many).not.toMatch(/[O0I1]/);
  });

  it('is deterministic given its source of randomness', () => {
    expect(mintReference(() => 0)).toBe('BK-222222');
  });
});

describe('initialsOf and confirmationFor', () => {
  it('takes at most two initials', () => {
    expect(initialsOf('Umurage Hospitality Ltd')).toBe('UH');
    expect(initialsOf('Nyungwe')).toBe('N');
    expect(initialsOf('   ')).toBe('??');
  });

  it('builds the confirmation in the fixtures own shape', () => {
    expect(confirmationFor('BK-7Q2M4X', 'Umurage Hospitality Ltd')).toBe('INJ-7Q2M4X-UH');
  });
});

describe('payMethod', () => {
  it('orders MoMo, then Airtel, then card, and card takes no handset', () => {
    expect(payMethod('momo').prefixes).toEqual(['78', '79']);
    expect(payMethod('airtel').prefixes).toEqual(['72', '73']);
    expect(payMethod('card').prefixes).toBeNull();
  });
});
