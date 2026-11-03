import { describe, expect, it } from 'vitest';

import { EbmSdcBlock, ebmQrPayload } from '@injishi/contracts';

import type { VsdcSignRequest } from '../domain/vsdc-port';
import { MockVsdcSigner } from './mock-vsdc.signer';

/**
 * The mock signer is not test scaffolding: while there is no VSDC integration
 * it is the only thing filling the SDC block of every receipt this platform
 * prints. So what it guarantees is what the platform guarantees, and the two
 * things that matter are pinned here: the block is SHAPED the way clause 7.24
 * prescribes, and the same booking always yields the same document.
 *
 * What is NOT pinned here, because it is not true, is that any of it means
 * anything. See the class comment on `MockVsdcSigner`.
 */
describe('MockVsdcSigner', () => {
  const WORKSPACE = '33333333-3333-3333-3333-333333333333';

  function request(overrides: Partial<VsdcSignRequest> = {}): VsdcSignRequest {
    return {
      bookingReference: 'BK-7Q2M-4XKD',
      sellerKey: WORKSPACE,
      receiptType: 'NS',
      transaction: 'SALE',
      // 2026-06-04T21:40:00Z is 23:40 in Kigali (UTC+2) — the case that catches
      // a receipt stamped in the server's zone instead of the property's.
      occurredAt: new Date('2026-06-04T21:40:00.000Z'),
      totalRwf: 189_000,
      totalTaxRwf: 28_831,
      itemsNumber: 2,
      ...overrides,
    };
  }

  it('declares which side of the seam it is, rather than leaving it inferred', () => {
    expect(new MockVsdcSigner().mode).toBe('mock');
  });

  it('fills an SDC block the contract accepts', async () => {
    const { sdc } = await new MockVsdcSigner().sign(request());

    // The contract encodes 7.24: SDC + 9 digits, dash-grouped values, a QR
    // payload of six fields. If this parses, the block is shaped as prescribed.
    expect(EbmSdcBlock.safeParse(sdc).success).toBe(true);
    expect(sdc.receiptLabel).toBe('NS');
    expect(sdc.qrData).toBe(ebmQrPayload(sdc));
  });

  it('stamps the clock of the property, not the clock of the server (7.24.2)', async () => {
    const { sdc, cis } = await new MockVsdcSigner().sign(request());

    // 21:40 UTC is 23:40 on the same day in Kigali. A receipt reading 21:40
    // would disagree with the evening the guest spent there and with the tax
    // day it belongs to; a rolled date would put it in the wrong day entirely.
    expect(sdc.date).toBe('04/06/2026');
    expect(sdc.time).toBe('23:40:00');
    expect(cis.date).toBe(sdc.date);
  });

  it('answers the same booking with the same receipt, every time', async () => {
    const signer = new MockVsdcSigner();

    const first = await signer.sign(request());
    const second = await signer.sign(request());

    // Not a fiscal property — a real device counts up on every sale — but the
    // one a guest reloading their receipt depends on.
    expect(second).toEqual(first);
  });

  it('gives two different bookings two different signatures', async () => {
    const signer = new MockVsdcSigner();

    const a = await signer.sign(request());
    const b = await signer.sign(request({ bookingReference: 'BK-AAAA-BBBB' }));

    expect(b.sdc.internalData).not.toBe(a.sdc.internalData);
    expect(b.sdc.receiptSignature).not.toBe(a.sdc.receiptSignature);
    expect(b.sdc.typeCounter).not.toBe(a.sdc.typeCounter);
  });

  it('keeps the device identity with the SELLER, not with the sale', async () => {
    const signer = new MockVsdcSigner();

    const a = await signer.sign(request());
    const b = await signer.sign(request({ bookingReference: 'BK-AAAA-BBBB' }));
    const other = await signer.sign(request({ sellerKey: 'another-workspace' }));

    // A VSDC belongs to a registered taxpayer and signs every receipt they
    // issue. An SDC id that changed between two of one hotel's receipts would
    // contradict 7.24.3 as well as being fake.
    expect(b.sdc.sdcId).toBe(a.sdc.sdcId);
    expect(b.cis.mrc).toBe(a.cis.mrc);
    expect(other.sdc.sdcId).not.toBe(a.sdc.sdcId);
  });

  it('changes the signature when the amounts change', async () => {
    const signer = new MockVsdcSigner();

    const a = await signer.sign(request());
    const b = await signer.sign(request({ totalRwf: 189_001 }));

    // Arithmetic, not cryptography: anyone can recompute it. But it means the
    // signature cannot be quietly detached from the sale it sits under while
    // this build is used to develop the surfaces that read it.
    expect(b.sdc.receiptSignature).not.toBe(a.sdc.receiptSignature);
  });

  it('counts the total counter at or above the per-type counter (7.25)', async () => {
    const signer = new MockVsdcSigner();

    for (const reference of ['BK-AAAA-AAAA', 'BK-ZZZZ-9999', 'BK-7Q2M-4XKD']) {
      const { sdc } = await signer.sign(request({ bookingReference: reference }));
      // B counts every receipt type; A counts one of them. B < A is impossible
      // on a real device and would be visible nonsense on a printed receipt.
      expect(sdc.totalCounter).toBeGreaterThanOrEqual(sdc.typeCounter);
      expect(sdc.typeCounter).toBeGreaterThan(0);
    }
  });

  it('signs nothing on a proforma or a training ticket (clauses 16, 17)', async () => {
    const signer = new MockVsdcSigner();

    for (const receiptType of ['PS', 'TS'] as const) {
      const { sdc } = await signer.sign(request({ receiptType }));

      // Printed "EXCLUDING digital signatures": a fabricated one on a document
      // the specification says carries none would be worse than a mock.
      expect(sdc.internalData).toBe('');
      expect(sdc.receiptSignature).toBe('');
      expect(sdc.receiptLabel).toBe(receiptType);
      expect(EbmSdcBlock.safeParse(sdc).success).toBe(true);
    }
  });
});
