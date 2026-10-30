import { describe, expect, it } from 'vitest';

import {
  VsdcResponseError,
  readVsdcSale,
  signatureFromVsdc,
  vsdcClock,
} from './vsdc-response';

/**
 * RRA's own sample `saveSales` answer (VSDC SPECIFICATION v1.0.5, §3.3.6.1),
 * byte for byte, plus the provider's invoice number and totals around it. If a
 * change to the reader breaks this fixture, it has stopped reading RRA.
 */
const RRA_SAMPLE = {
  rcptNo: 27,
  intrlData: 'GZGGIZLYTJSSD7YLYLGIIG6FCY',
  rcptSign: 'TQZMKL57AGBMSTPO',
  totRcptNo: 32,
  vsdcRcptPbctDate: '20211027162114',
  sdcId: 'SDC010000005',
  mrcNo: 'WIS01006230',
};

const CERTIFIED_AT = new Date('2021-10-27T14:23:05.000Z'); // 16:23:05 in Kigali

/** The sample with one field taken out. */
function without(key: keyof typeof RRA_SAMPLE): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...RRA_SAMPLE };
  delete copy[key];
  return copy;
}

describe('reading a certified sale', () => {
  it('maps vsdcRcptPbctDate to the SDC clock', () => {
    const fields = readVsdcSale({ id: 9, invcNo: 15, ...RRA_SAMPLE });
    const { sdc } = signatureFromVsdc(fields, 'NS', CERTIFIED_AT);
    // The device's digits, re-sliced; never the server's clock.
    expect(sdc.date).toBe('27/10/2021');
    expect(sdc.time).toBe('16:21:14');
  });

  it('uses the device counters as A and B, and names the device', () => {
    const fields = readVsdcSale({ id: 9, invcNo: 15, ...RRA_SAMPLE });
    const { sdc, cis } = signatureFromVsdc(fields, 'NS', CERTIFIED_AT);
    expect(sdc.typeCounter).toBe(27);
    expect(sdc.totalCounter).toBe(32);
    expect(sdc.receiptLabel).toBe('NS');
    expect(sdc.sdcId).toBe('SDC010000005');
    expect(sdc.signerMode).toBe('live');
    // 7.24.5 / 7.24.6 — grouped in fours, nothing else changed.
    expect(sdc.internalData).toBe('GZGG-IZLY-TJSS-D7YL-YLGI-IG6F-CY');
    expect(sdc.receiptSignature).toBe('TQZM-KL57-AGBM-STPO');
    // The CIS half: the provider's consecutive number and machine code.
    expect(cis).toEqual({
      receiptNumber: 15,
      date: '27/10/2021',
      time: '16:23:05',
      mrc: 'WIS01006230',
    });
  });

  it("builds the 7.24.7 QR payload from the device's own values", () => {
    const fields = readVsdcSale({ id: 9, invcNo: 15, ...RRA_SAMPLE });
    const { sdc } = signatureFromVsdc(fields, 'NS', CERTIFIED_AT);
    expect(sdc.qrData).toBe(
      '27102021#162114#SDC010000005#27/32#GZGG-IZLY-TJSS-D7YL-YLGI-IG6F-CY#TQZM-KL57-AGBM-STPO',
    );
  });

  it('finds the device fields wherever the provider nested them', () => {
    const nested = {
      id: 9,
      invcNo: 15,
      status: 'Certified',
      vsdcResponse: { resultCd: '000', data: RRA_SAMPLE },
    };
    expect(readVsdcSale(nested)).toMatchObject({ rcptNo: 27, totRcptNo: 32 });
  });

  it('reads the certified totals for the comparison against the charge', () => {
    const fields = readVsdcSale({
      id: 9,
      invcNo: 15,
      totAmt: '189000.00',
      taxAmtB: 28831,
      ...RRA_SAMPLE,
    });
    expect(fields.totAmt).toBe(189000);
    expect(fields.taxAmtB).toBe(28831);
  });

  it('refuses a response missing totRcptNo', () => {
    // The provider's documented CertifiedInvoice omits it. Using rcptNo in its
    // place would print the type counter twice and call one of them B.
    expect(() => readVsdcSale({ id: 9, invcNo: 15, ...without('totRcptNo') })).toThrow(
      /no totRcptNo/,
    );
  });

  it('refuses a response missing vsdcRcptPbctDate', () => {
    // Filling it from our own clock would print the CIS's time as the VSDC's.
    expect(() => readVsdcSale({ id: 9, invcNo: 15, ...without('vsdcRcptPbctDate') })).toThrow(
      /no vsdcRcptPbctDate/,
    );
  });

  it('refuses a response missing the signature or the internal data', () => {
    for (const key of ['rcptSign', 'intrlData', 'sdcId', 'mrcNo'] as const) {
      const partial: Record<string, unknown> = { id: 9, invcNo: 15, ...RRA_SAMPLE };
      delete partial[key];
      expect(() => readVsdcSale(partial)).toThrow(VsdcResponseError);
    }
  });

  it('refuses a device clock that is not an instant', () => {
    expect(() =>
      readVsdcSale({ id: 9, invcNo: 15, ...RRA_SAMPLE, vsdcRcptPbctDate: '2021-10-27' }),
    ).toThrow(/yyyyMMddHHmmss/);
    expect(() => vsdcClock('20211327162114')).toThrow(VsdcResponseError);
  });

  it('refuses an SDC id outside the shape 7.24.3 prescribes, naming the field', () => {
    const fields = readVsdcSale({ id: 9, invcNo: 15, ...RRA_SAMPLE, sdcId: 'DEV-1' });
    expect(() => signatureFromVsdc(fields, 'NS', CERTIFIED_AT)).toThrow(/sdcId/);
  });
});
