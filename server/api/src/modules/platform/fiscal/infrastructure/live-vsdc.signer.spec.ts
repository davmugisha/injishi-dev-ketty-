import { describe, expect, it, type Mock, vi } from 'vitest';

import { ConflictException } from '@nestjs/common';

import type { VsdcSignRequest } from '../domain/vsdc-port';
import type {
  EbmEmissionRepository,
  EbmEmissionRow,
  EmissionPayload,
} from './ebm-emission.repository';
import { LiveVsdcSigner, NOT_CERTIFIED_YET, NOT_PRINTABLE } from './live-vsdc.signer';

/**
 * The live signer's contract is short: print what RRA answered, from where the
 * worker stored it, and refuse every case where there is no answer to print or
 * the answer does not cover the receipt in front of the guest. It never talks
 * to the provider — the test double has no client to call.
 */
describe('LiveVsdcSigner', () => {
  const EMITTED_AT = new Date('2026-09-11T10:00:05.000Z');

  const request: VsdcSignRequest = {
    bookingReference: 'BK-7Q2M-4XKD',
    sellerKey: 'ws',
    receiptType: 'NS',
    transaction: 'SALE',
    occurredAt: new Date('2026-09-11T09:59:00.000Z'),
    totalRwf: 189_000,
    totalTaxRwf: 28_831,
    itemsNumber: 2,
  };

  const payload: EmissionPayload = {
    request: {},
    totals: { totalRwf: 189_000, totalTaxRwf: 28_831, itemsNumber: 2 },
    response: {
      id: 41,
      invcNo: 15,
      status: 'Certified',
      rcptNo: 27,
      totRcptNo: 32,
      vsdcRcptPbctDate: '20260911120000',
      intrlData: 'GZGGIZLYTJSSD7YLYLGIIG6FCY',
      rcptSign: 'TQZMKL57AGBMSTPO',
      sdcId: 'SDC010000005',
      mrcNo: 'WIS01006230',
    },
  };

  function signerFor(
    row: Partial<EbmEmissionRow> | null,
    environment: 'production' | 'demo' = 'production',
  ): {
    signer: LiveVsdcSigner;
    findForBookingReference: Mock;
  } {
    const findForBookingReference = vi.fn(async () =>
      row ? ({ status: 'emitted', emittedAt: EMITTED_AT, payload, ...row } as EbmEmissionRow) : null,
    );
    const signer = new LiveVsdcSigner(
      { findForBookingReference } as unknown as EbmEmissionRepository,
      { environment, sampleData: false, commit: null },
    );
    return { signer, findForBookingReference };
  }

  it('signs a demo receipt with the declared mock, never with a stored certification', async () => {
    const { signer, findForBookingReference } = signerFor({}, 'demo');
    const { sdc } = await signer.sign(request);
    // The demo is never certified, so a live read would answer "being
    // certified" forever. It gets the mock, which says it is one.
    expect(sdc.signerMode).toBe('mock');
    expect(findForBookingReference).not.toHaveBeenCalled();
  });

  async function refusal(promise: Promise<unknown>): Promise<string> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      return (error as ConflictException).message;
    }
    throw new Error('expected a refusal');
  }

  it('declares itself live', () => {
    expect(signerFor(null).signer.mode).toBe('live');
  });

  it('returns the stored VSDC blocks for an emitted sale', async () => {
    const { signer, findForBookingReference } = signerFor({});
    const { sdc, cis } = await signer.sign(request);

    expect(findForBookingReference).toHaveBeenCalledWith('BK-7Q2M-4XKD');
    expect(sdc).toMatchObject({
      date: '11/09/2026',
      time: '12:00:00',
      sdcId: 'SDC010000005',
      typeCounter: 27,
      totalCounter: 32,
      receiptLabel: 'NS',
      internalData: 'GZGG-IZLY-TJSS-D7YL-YLGI-IG6F-CY',
      receiptSignature: 'TQZM-KL57-AGBM-STPO',
      signerMode: 'live',
    });
    // The CIS clock is the instant the certification arrived, in Kigali time.
    expect(cis).toEqual({ receiptNumber: 15, date: '11/09/2026', time: '12:00:05', mrc: 'WIS01006230' });
  });

  it('gives the same answer on every read', async () => {
    const { signer } = signerFor({});
    expect(await signer.sign(request)).toEqual(await signer.sign(request));
  });

  it('refuses a sale that has not been certified yet', async () => {
    expect(await refusal(signerFor(null).signer.sign(request))).toBe(NOT_CERTIFIED_YET);
    expect(await refusal(signerFor({ status: 'held', emittedAt: null }).signer.sign(request))).toBe(
      NOT_CERTIFIED_YET,
    );
    expect(await refusal(signerFor({ status: 'failed', emittedAt: null }).signer.sign(request))).toBe(
      NOT_CERTIFIED_YET,
    );
  });

  it('refuses when the stored totals disagree with the receipt', async () => {
    const { signer } = signerFor({});
    expect(await refusal(signer.sign({ ...request, totalRwf: 190_000 }))).toBe(NOT_PRINTABLE);
    expect(await refusal(signer.sign({ ...request, totalTaxRwf: 28_830 }))).toBe(NOT_PRINTABLE);
    expect(await refusal(signer.sign({ ...request, itemsNumber: 1 }))).toBe(NOT_PRINTABLE);
  });

  it('refuses a certified sale whose answer the worker could not read', async () => {
    const { signer } = signerFor({ payload: { ...payload, readError: 'no totRcptNo' } });
    expect(await refusal(signer.sign(request))).toBe(NOT_PRINTABLE);
  });

  it('refuses rather than fabricate when a device field is missing from the stored answer', async () => {
    const partial = { ...payload.response };
    delete partial.totRcptNo;
    const { signer } = signerFor({ payload: { ...payload, response: partial } });
    expect(await refusal(signer.sign(request))).toBe(NOT_PRINTABLE);
  });
});
