import { describe, expect, it } from 'vitest';

import {
  breakdownAsCharged,
  computeBreakdown,
  ebmGroupInFours,
  ebmQrPayload,
  ebmTaxIncludedIn,
} from '@injishi/contracts';

import {
  ReceiptArithmeticError,
  buildStayReceipt,
  priceStay,
  stayItems,
  taxLinesFor,
  type StayForReceipt,
} from './receipt-builder';
import type { VsdcSignature } from './vsdc-port';

/**
 * These are the arithmetic and the format rules a tax authority checks, so they
 * are pinned against the specification's OWN worked examples rather than
 * against what this implementation happens to produce. Where a number below
 * looks arbitrary, it was copied off page 6 or page 7 of
 * "Technical Specification of CIS for VSDC, Ver.1.0".
 */
describe('EBM receipt arithmetic and formats', () => {
  const signature: VsdcSignature = {
    sdc: {
      date: '25/05/2026',
      time: '11:07:35',
      sdcId: 'SDC001000001',
      typeCounter: 168,
      totalCounter: 258,
      receiptLabel: 'NS',
      internalData: 'TE68-SLA2-34J5-EAV3-N569-88LJ-Q7',
      receiptSignature: 'V249-J39C-FJ48-HE2W',
      qrData:
        '25052026#110735#SDC001000001#168/258#TE68-SLA2-34J5-EAV3-N569-88LJ-Q7#V249-J39C-FJ48-HE2W',
    },
    cis: {
      receiptNumber: 152,
      date: '25/05/2026',
      time: '11:09:32',
      mrc: 'AAACC123456',
    },
  };

  function stay(overrides: Partial<StayForReceipt> = {}): StayForReceipt {
    const breakdown = computeBreakdown({
      nightlyRateRwf: 90_000,
      nights: 2,
      nonRefundable: false,
    });
    return {
      bookingReference: 'BK-7Q2M-4XKD',
      seller: {
        tradeName: 'Umurage Guesthouse Ltd',
        address: 'KG 7 Ave, Gasabo',
        tin: '102938475',
      },
      propertyName: 'Umurage Guesthouse',
      roomTypeName: 'Deluxe Room',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      breakdown,
      chargedRwf: breakdown.grossRwf,
      paymentLabel: 'ONLINE PAYMENT (MOCK)',
      clientId: null,
      ...overrides,
    };
  }

  // --- 7.24.5, 7.24.6: separate by dash after every 4th character ----------

  describe('grouping in fours', () => {
    it('groups the internal data from the specification example', () => {
      // Page 6, the `Internal Data:` line of the NS sample receipt.
      expect(ebmGroupInFours('TE68SLA234J5EAV3N56988LJQ7')).toBe(
        'TE68-SLA2-34J5-EAV3-N569-88LJ-Q7',
      );
    });

    it('groups the receipt signature from the specification example', () => {
      expect(ebmGroupInFours('V249J39CFJ48HE2W')).toBe('V249-J39C-FJ48-HE2W');
    });

    it('groups the refund receipt example from page 7', () => {
      expect(ebmGroupInFours('IR8499TNFCYYCE224HWEV5TAEE')).toBe(
        'IR84-99TN-FCYY-CE22-4HWE-V5TA-EE',
      );
    });

    it('leaves a value shorter than one group alone', () => {
      // A trailing dash would corrupt the QR payload this value is embedded in.
      expect(ebmGroupInFours('')).toBe('');
      expect(ebmGroupInFours('AB')).toBe('AB');
      expect(ebmGroupInFours('ABCD')).toBe('ABCD');
    });

    it('is idempotent, because both ends of the wire have a copy of it', () => {
      const once = ebmGroupInFours('TE68SLA234J5EAV3N56988LJQ7');
      expect(ebmGroupInFours(once)).toBe(once);
    });
  });

  // --- 7.24.7: the QR payload ---------------------------------------------

  describe('the QR payload', () => {
    it('is date#time#sdc#A/B#internal#signature, exactly', () => {
      expect(ebmQrPayload(signature.sdc)).toBe(
        '25052026#110735#SDC001000001#168/258#TE68-SLA2-34J5-EAV3-N569-88LJ-Q7#V249-J39C-FJ48-HE2W',
      );
    });

    it('strips the separators the same values print with', () => {
      // ddmmyyyy and hhmmss, not dd/mm/yyyy and hh:mm:ss. A verifier scanning
      // the printed form of the date would not match the Authority's record.
      const [date, time] = ebmQrPayload(signature.sdc).split('#');
      expect(date).toBe('25052026');
      expect(time).toBe('110735');
    });

    it('carries the receipt number WITHOUT the receipt type label', () => {
      // 7.25 prints `A/B RT`; 7.24.7 encodes `sdc_receipt_number` only.
      expect(ebmQrPayload(signature.sdc).split('#')[3]).toBe('168/258');
      expect(ebmQrPayload(signature.sdc)).not.toContain('NS');
    });

    it('has six fields, whatever the values are', () => {
      expect(ebmQrPayload(signature.sdc).split('#')).toHaveLength(6);
    });
  });

  // --- 13.1: the tax is INSIDE the total ----------------------------------

  describe('tax arithmetic', () => {
    /**
     * The number that settles the whole question. The sample receipt sells
     * 5340.00 under `B-18.00%` and prints `TOTAL TAX B 814.58`, which is
     * 5340 x 18 / 118. The tax-exclusive reading gives 961.20 and is wrong.
     */
    it('matches the specification worked example, 5340 at B-18% -> 814.58', () => {
      expect(ebmTaxIncludedIn(534_000, 18)).toBe(81_458);
      expect(ebmTaxIncludedIn(5_340, 18)).toBe(815); // 814.576, in whole francs
    });

    it('is the inclusive reading, never the exclusive one', () => {
      expect(ebmTaxIncludedIn(118_000, 18)).toBe(18_000);
      expect(ebmTaxIncludedIn(118_000, 18)).not.toBe(21_240);
    });

    it('rounds a refund to the same magnitude as the sale it reverses', () => {
      // Page 7 sells -36139.50 at B-18% and prints -5512.81.
      expect(ebmTaxIncludedIn(-3_613_950, 18)).toBe(-551_281);
      expect(ebmTaxIncludedIn(-118_000, 18)).toBe(-ebmTaxIncludedIn(118_000, 18));
    });

    it('taxes nothing at an exempt rate', () => {
      expect(ebmTaxIncludedIn(500_000, 0)).toBe(0);
    });

    it('sums one line per rate, over the DISCOUNTED totals', () => {
      const discounted = stay({
        breakdown: computeBreakdown({
          nightlyRateRwf: 90_000,
          nights: 2,
          nonRefundable: true,
        }),
      });
      const lines = taxLinesFor(stayItems(discounted));

      expect(lines).toHaveLength(1);
      expect(lines[0].label).toBe('B');
      expect(lines[0].ratePercent).toBe(18);
      // 180 000 less the 18 000 non-refundable reduction; no guest service fee since 2026-10-29.
      expect(lines[0].taxableRwf).toBe(162_000);
      expect(lines[0].taxRwf).toBe(ebmTaxIncludedIn(162_000, 18));
    });

    it('refuses a tax label this CIS was never programmed with', () => {
      const items = stayItems(stay());
      items[0].taxLabel = 'C';
      expect(() => taxLinesFor(items)).toThrow(ReceiptArithmeticError);
    });
  });

  // --- 13.1: the item and total lines -------------------------------------

  describe('the stay as item lines', () => {
    it('prices the room at rate x nights, with no fee line on a booking made today', () => {
      const items = stayItems(stay());

      expect(items).toHaveLength(1);
      expect(items[0].totalRwf).toBe(180_000);
    });

    it('keeps the fee as its own line on a booking paid under the old 5% fee', () => {
      // 180 000 for the stay and the 9 000 fee it was charged before 2026-10-29.
      const args = { nightlyRateRwf: 90_000, nights: 2, nonRefundable: false };
      const items = stayItems(stay({ breakdown: breakdownAsCharged(args, 189_000), chargedRwf: 189_000 }));

      expect(items).toHaveLength(2);
      expect(items[0].unitPriceRwf).toBe(90_000);
      expect(items[0].quantity).toBe(2);
      expect(items[0].totalRwf).toBe(180_000);
      expect(items[0].taxLabel).toBe('B');
      expect(items[0].discountPercent).toBeNull();
      expect(items[1].name).toBe('Booking service fee');
      expect(items[1].totalRwf).toBe(9_000);
    });

    it('names the room, the property and the nights being invoiced', () => {
      // 7.16: no amount may be registered without identifying the service.
      expect(stayItems(stay())[0].name).toBe(
        'Deluxe Room, Umurage Guesthouse (2026-06-01 to 2026-06-03)',
      );
    });

    it('prints the non-refundable reduction as a discount line', () => {
      const items = stayItems(
        stay({
          breakdown: computeBreakdown({
            nightlyRateRwf: 90_000,
            nights: 2,
            nonRefundable: true,
          }),
        }),
      );

      expect(items[0].totalRwf).toBe(180_000);
      expect(items[0].discountPercent).toBe(10);
      expect(items[0].discountedTotalRwf).toBe(162_000);
    });

    it('omits a zero service fee rather than printing an empty line', () => {
      // 7.27 counts the items SHOWN; a zero line would inflate ITEMS NUMBER.
      const free = computeBreakdown({
        nightlyRateRwf: 0,
        nights: 1,
        nonRefundable: false,
      });
      const items = stayItems(stay({ breakdown: free, chargedRwf: 0 }));

      expect(items).toHaveLength(1);
    });
  });

  describe('the assembled NS receipt', () => {
    it('totals what the guest was actually charged', () => {
      const s = stay();
      const receipt = buildStayReceipt(s, priceStay(s), signature, 'NS');

      expect(receipt.totalRwf).toBe(s.breakdown.grossRwf);
      expect(receipt.payment.amountRwf).toBe(s.breakdown.grossRwf);
      expect(receipt.receiptType).toBe('NS');
      expect(receipt.transaction).toBe('SALE');
      expect(receipt.itemsNumber).toBe(receipt.items.length);
      expect(receipt.totalTaxRwf).toBe(
        receipt.taxLines.reduce((sum, line) => sum + line.taxRwf, 0),
      );
    });

    it('carries the VSDC blocks through untouched (7.20)', () => {
      const s = stay();
      const receipt = buildStayReceipt(s, priceStay(s), signature, 'NS');

      expect(receipt.sdc).toEqual(signature.sdc);
      expect(receipt.cis).toEqual(signature.cis);
    });

    /**
     * The refusal this module exists to make. A receipt whose TOTAL is not the
     * amount taken either under-declares tax or bills a guest for money nobody
     * took, and a plausible wrong number on a fiscal document is worse than no
     * document at all.
     */
    it('refuses to build when the lines disagree with the charge', () => {
      const tampered = stay({ chargedRwf: 1 });

      expect(() => priceStay(tampered)).toThrow(ReceiptArithmeticError);
      expect(() => priceStay(tampered)).toThrow(/was charged 1 RWF/);
    });
  });
});
