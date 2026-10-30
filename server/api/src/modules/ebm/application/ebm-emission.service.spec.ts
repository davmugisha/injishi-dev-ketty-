import { describe, expect, it, type Mock, vi } from 'vitest';

import type { EbmLive } from '../domain/ebm-live';
import { EbmApiError, type EbmApiClient, type EbmInvoiceRequest } from '../infrastructure/ebm-api.client';
import type {
  BookingForReceipt,
  EbmBookingRepository,
} from '../infrastructure/ebm-booking.repository';
import type {
  EbmEmissionRepository,
  EbmEmissionRow,
  EmissionPayload,
} from '../infrastructure/ebm-emission.repository';
import type { Credentials, EbmConnectionService } from './ebm-connection.service';
import { EbmEmissionService, ONLINE_PAYMENT_CODE, retryDelayMs } from './ebm-emission.service';

/**
 * The worker's whole job is one decision made many ways: did this sale certify,
 * and may it be sent again. What is pinned here is that a sale certified once
 * is never sent twice, that a sale whose fate is unknown is never re-sent by a
 * machine, and that a sale that certainly did not certify is always tried again.
 */
describe('EbmEmissionService', () => {
  const NOW = new Date('2026-09-11T10:00:00.000Z');
  const ORG = '44444444-4444-4444-4444-444444444444';
  const ROW_ID = 'e0000000-0000-0000-0000-000000000001';

  const RRA_ANSWER = {
    id: 41,
    invcNo: 15,
    status: 'Certified',
    totAmt: 189000,
    taxAmtB: 28831,
    rcptNo: 27,
    totRcptNo: 32,
    vsdcRcptPbctDate: '20260911120000',
    intrlData: 'GZGGIZLYTJSSD7YLYLGIIG6FCY',
    rcptSign: 'TQZMKL57AGBMSTPO',
    sdcId: 'SDC010000005',
    mrcNo: 'WIS01006230',
  };

  function booking(overrides: Partial<BookingForReceipt> = {}): BookingForReceipt {
    return {
      reference: 'BK-7Q2M-4XKD',
      status: 'confirmed',
      paymentStatus: 'captured',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      lockedNightlyRateRwf: 90_000,
      nonRefundable: false,
      grossRwf: 189_000,
      workspaceId: '33333333-3333-3333-3333-333333333333',
      orgId: ORG,
      roomTypeName: 'Deluxe Room',
      propertyName: 'Umurage Guesthouse',
      addressText: 'KG 7 Ave',
      districtName: 'Gasabo',
      sellerLegalName: 'Umurage Guesthouse Ltd',
      sellerTin: '102938475',
      paymentAdapterMode: 'live',
      confirmedAt: NOW,
      createdAt: NOW,
      ebmSignAt: null,
      ...overrides,
    };
  }

  const READY: Credentials = {
    ready: true,
    accessToken: 'at-1',
    tin: '102938475',
    mapping: { accommodationItemId: 3, serviceFeeItemId: 4, walkInCustomerId: 7 },
  };

  class FixedClock extends EbmEmissionService {
    protected override now(): Date {
      return NOW;
    }
  }

  interface Harness {
    service: EbmEmissionService;
    emissions: { claim: Mock; releaseToHeld: Mock; markEmitted: Mock; markFailed: Mock };
    bookings: { findForEmission: Mock };
    connections: { credentialsFor: Mock; markRevoked: Mock };
    client: { createInvoice: Mock; invoice: Mock };
  }

  /** The certified answer with the named device fields taken out. */
  function answerWithout(...keys: Array<keyof typeof RRA_ANSWER>): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...RRA_ANSWER };
    for (const key of keys) delete copy[key];
    return copy;
  }

  function harness(opts: {
    row?: Partial<EbmEmissionRow> | null;
    booking?: BookingForReceipt | null;
    creds?: Credentials | (() => Promise<Credentials>);
    createInvoice?: (token: string, req: EbmInvoiceRequest) => Promise<unknown>;
    getInvoice?: () => Promise<unknown>;
  } = {}): Harness {
    const row: EbmEmissionRow | null =
      opts.row === null
        ? null
        : ({
            id: ROW_ID,
            // What every real row carries: these columns are NOT NULL with
            // defaults since ADR-050 Migration A.
            source: 'booking',
            receiptType: 'normal',
            transactionType: 'sale',
            receiptLabel: 'NS',
            bookingId: 'b0000000-0000-0000-0000-000000000001',
            orgId: ORG,
            status: 'failed',
            attempts: 1,
            ...opts.row,
          } as EbmEmissionRow);

    const emissions = {
      claim: vi.fn(async () => row),
      releaseToHeld: vi.fn(async () => undefined),
      markEmitted: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const bookings = {
      findForEmission: vi.fn(async () => (opts.booking === undefined ? booking() : opts.booking)),
    };
    const connections = {
      credentialsFor: vi.fn(
        typeof opts.creds === 'function' ? opts.creds : async () => opts.creds ?? READY,
      ),
      markRevoked: vi.fn(async () => undefined),
    };
    const client = {
      createInvoice: vi.fn(
        opts.createInvoice ??
          (async () => ({ id: RRA_ANSWER.id, status: 'Certified', raw: { ...RRA_ANSWER } })),
      ),
      invoice: vi.fn(opts.getInvoice ?? (async () => { throw new Error('not expected'); })),
    };
    const live = { config: {} as EbmLive['config'], client: client as unknown as EbmApiClient };
    const service = new FixedClock(
      emissions as unknown as EbmEmissionRepository,
      bookings as unknown as EbmBookingRepository,
      connections as unknown as EbmConnectionService,
      live,
    );
    return { service, emissions, bookings, connections, client };
  }

  const certified = (raw: Record<string, unknown>) => async () => ({
    id: raw.id as number,
    status: (raw.status as string) ?? null,
    raw,
  });

  // -------------------------------------------------------------------------

  it('emits a held sale and stores the VSDC response', async () => {
    const h = harness();
    expect(await h.service.emit(ROW_ID)).toBe('emitted');

    expect(h.client.createInvoice).toHaveBeenCalledTimes(1);
    expect(h.emissions.markEmitted).toHaveBeenCalledTimes(1);
    const [id, stored] = h.emissions.markEmitted.mock.calls[0] as unknown as [
      string,
      { externalInvoiceId: number; payload: EmissionPayload; problem: string | null; emittedAt: Date },
    ];
    expect(id).toBe(ROW_ID);
    expect(stored.externalInvoiceId).toBe(41);
    expect(stored.problem).toBeNull();
    expect(stored.emittedAt).toEqual(NOW);
    // Exactly what came back, kept whole.
    expect(stored.payload.response).toMatchObject({ rcptNo: 27, totRcptNo: 32, rcptSign: 'TQZMKL57AGBMSTPO' });
    // And what was priced before sending, which the receipt must agree with.
    expect(stored.payload.totals).toEqual({ totalRwf: 189_000, totalTaxRwf: 28_831, itemsNumber: 2 });
  });

  it('sends the stay as the mapped items, at the locked rate, to the walk-in customer', async () => {
    const h = harness();
    await h.service.emit(ROW_ID);
    const [token, request] = h.client.createInvoice.mock.calls[0] as unknown as [string, EbmInvoiceRequest];
    expect(token).toBe('at-1');
    expect(request).toEqual({
      customerId: 7,
      paymentMethod: '07',
      items: [
        { id: 3, quantity: 2, unitPrice: 90_000 },
        { id: 4, quantity: 1, unitPrice: 9_000 },
      ],
    });
  });

  it('sends RRA payment code 07 for an online payment', async () => {
    expect(ONLINE_PAYMENT_CODE).toBe('07');
    const h = harness();
    await h.service.emit(ROW_ID);
    const request = h.client.createInvoice.mock.calls[0][1] as EbmInvoiceRequest;
    expect(request.paymentMethod).toBe('07');
  });

  it('sends the non-refundable reduction as the invoice discount', async () => {
    // 2 nights x 90 000 = 180 000, less 10% = 162 000; the 5% fee is on the
    // discounted stay, 8 100 → 170 100 charged, carrying 25 947 of VAT.
    const h = harness({
      booking: booking({ nonRefundable: true, grossRwf: 170_100 }),
      createInvoice: certified({ ...RRA_ANSWER, totAmt: 170100, taxAmtB: 25947 }),
    });
    expect(await h.service.emit(ROW_ID)).toBe('emitted');
    const request = h.client.createInvoice.mock.calls[0][1] as EbmInvoiceRequest;
    expect(request.discount).toBe(18_000);
    expect(request.items).toEqual([
      { id: 3, quantity: 2, unitPrice: 90_000 },
      { id: 4, quantity: 1, unitPrice: 8_100 },
    ]);
    // What the provider is asked to certify adds up to what was charged.
    const gross = request.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) - request.discount!;
    expect(gross).toBe(170_100);
  });

  it('does not call the EBM API for a sale already emitted', async () => {
    // `claim` returns null for anything not due — an emitted row, a row another
    // worker holds, a row parked for a person.
    const h = harness({ row: null });
    expect(await h.service.emit(ROW_ID)).toBe('not_due');
    expect(h.client.createInvoice).not.toHaveBeenCalled();
    expect(h.bookings.findForEmission).not.toHaveBeenCalled();
  });

  it('retries when the VSDC was unavailable', async () => {
    const h = harness({
      row: { attempts: 3 },
      createInvoice: async () => {
        throw new EbmApiError('unavailable', 502, 'VSDC is unreachable');
      },
    });
    expect(await h.service.emit(ROW_ID)).toBe('retry');
    const [, failed] = h.emissions.markFailed.mock.calls[0] as unknown as [string, { retryAt: Date; reason: string }];
    expect(failed.retryAt).toEqual(new Date(NOW.getTime() + retryDelayMs(3)));
    expect(failed.reason).toContain('VSDC is unreachable');
    expect(h.emissions.markEmitted).not.toHaveBeenCalled();
  });

  it('backs off exponentially to an hour, and never stops', () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(120_000);
    expect(retryDelayMs(4)).toBe(480_000);
    expect(retryDelayMs(50)).toBe(3_600_000);
  });

  /**
   * ADR-050, slice 1. The provider's `createInvoice` can certify only a normal
   * sale of catalog items, so anything else is parked for a person and NEVER
   * sent: a proforma sent through it would be certified as a sale.
   */
  it('parks a proforma rather than certifying it as a sale', async () => {
    const h = harness({ row: { receiptType: 'proforma', receiptLabel: 'PS' } });
    expect(await h.service.emit(ROW_ID)).toBe('parked');
    const [, failed] = h.emissions.markFailed.mock.calls[0] as unknown as [string, { retryAt: Date | null; reason: string }];
    expect(failed.retryAt).toBeNull();
    expect(failed.reason).toMatch(/PS cannot be sent/);
    expect(h.client.createInvoice).not.toHaveBeenCalled();
  });

  it('parks a folio sale, whose lines the provider has no item for', async () => {
    const h = harness({ row: { source: 'folio', bookingId: null, folioId: 'f0000000-0000-0000-0000-000000000001' } });
    expect(await h.service.emit(ROW_ID)).toBe('parked');
    const [, failed] = h.emissions.markFailed.mock.calls[0] as unknown as [string, { reason: string }];
    expect(failed.reason).toMatch(/folio sale cannot be sent/);
    expect(h.client.createInvoice).not.toHaveBeenCalled();
  });

  it('does not retry an unknown outcome', async () => {
    const h = harness({
      createInvoice: async () => {
        throw new EbmApiError('unknown_outcome', null, 'EBM provider did not answer in time');
      },
    });
    expect(await h.service.emit(ROW_ID)).toBe('parked');
    const [, failed] = h.emissions.markFailed.mock.calls[0] as unknown as [string, { retryAt: Date | null; reason: string }];
    expect(failed.retryAt).toBeNull();
    expect(failed.reason).toMatch(/may declare it twice/);
    expect(h.client.createInvoice).toHaveBeenCalledTimes(1);
  });

  it('treats an unclassified error while sending as an unknown outcome', async () => {
    const h = harness({
      createInvoice: async () => {
        throw new Error('something odd');
      },
    });
    expect(await h.service.emit(ROW_ID)).toBe('parked');
    const [, failed] = h.emissions.markFailed.mock.calls[0] as unknown as [string, { retryAt: Date | null }];
    expect(failed.retryAt).toBeNull();
  });

  it('parks a sale the provider rejected, with its words', async () => {
    const h = harness({
      createInvoice: async () => {
        throw new EbmApiError('rejected', 400, 'EBM provider rejected the request (400): Item 3 not found');
      },
    });
    expect(await h.service.emit(ROW_ID)).toBe('parked');
    const [, failed] = h.emissions.markFailed.mock.calls[0] as unknown as [string, { retryAt: Date | null; reason: string }];
    expect(failed.retryAt).toBeNull();
    expect(failed.reason).toContain('Item 3 not found');
  });

  it('parks a 200 that the provider marked as not certified, instead of sending again', async () => {
    const h = harness({ createInvoice: certified({ ...RRA_ANSWER, status: 'Failed' }) });
    expect(await h.service.emit(ROW_ID)).toBe('parked');
    const [, failed] = h.emissions.markFailed.mock.calls[0] as unknown as [string, { retryAt: Date | null; reason: string }];
    expect(failed.retryAt).toBeNull();
    expect(failed.reason).toContain('invoice 41');
  });

  it('recovers once from a refused token, then sends', async () => {
    let calls = 0;
    const h = harness({
      createInvoice: async (token) => {
        calls += 1;
        if (calls === 1) throw new EbmApiError('unauthorized', 401, 'expired');
        expect(token).toBe('at-2');
        return { id: 41, status: 'Certified', raw: { ...RRA_ANSWER } };
      },
      creds: vi
        .fn<() => Promise<Credentials>>()
        .mockResolvedValueOnce(READY)
        .mockResolvedValueOnce({ ...READY, accessToken: 'at-2' }) as unknown as () => Promise<Credentials>,
    });
    expect(await h.service.emit(ROW_ID)).toBe('emitted');
    expect(h.connections.credentialsFor).toHaveBeenLastCalledWith(ORG, { forceRefresh: true });
  });

  it('holds a sale whose org has no EBM connection', async () => {
    const h = harness({
      creds: { ready: false, reason: 'This business has not connected its RRA EBM account.' },
    });
    expect(await h.service.emit(ROW_ID)).toBe('held');
    expect(h.emissions.releaseToHeld).toHaveBeenCalledWith(
      ROW_ID,
      'This business has not connected its RRA EBM account.',
    );
    expect(h.client.createInvoice).not.toHaveBeenCalled();
  });

  it("holds a sale when the connected account's TIN is no longer the business's", async () => {
    const h = harness({ booking: booking({ sellerTin: '555666777' }) });
    expect(await h.service.emit(ROW_ID)).toBe('held');
    expect(h.client.createInvoice).not.toHaveBeenCalled();
  });

  it('retries when the token could not be renewed because the provider was down', async () => {
    const h = harness({
      creds: async () => {
        throw new EbmApiError('unavailable', null, 'down');
      },
    });
    expect(await h.service.emit(ROW_ID)).toBe('retry');
    expect(h.client.createInvoice).not.toHaveBeenCalled();
  });

  it('retries when something fails before the send, because nothing left the process', async () => {
    const h = harness();
    h.bookings.findForEmission.mockRejectedValueOnce(new Error('connection terminated'));
    expect(await h.service.emit(ROW_ID)).toBe('retry');
    expect(h.client.createInvoice).not.toHaveBeenCalled();
    const [, failed] = h.emissions.markFailed.mock.calls[0] as unknown as [string, { retryAt: Date | null; reason: string }];
    expect(failed.retryAt).not.toBeNull();
    expect(failed.reason).toContain('connection terminated');
  });

  it('never moves a certified sale onto the retry path when it cannot be recorded', async () => {
    const h = harness();
    h.emissions.markEmitted.mockRejectedValueOnce(new Error('database went away'));
    await expect(h.service.emit(ROW_ID)).rejects.toThrow('database went away');
    // Sent once, and not scheduled again: the row stays parked as claimed.
    expect(h.client.createInvoice).toHaveBeenCalledTimes(1);
    expect(h.emissions.markFailed).not.toHaveBeenCalled();
  });

  it('parks a booking that was refunded before it could be certified', async () => {
    const h = harness({ booking: booking({ paymentStatus: 'refunded_full' }) });
    expect(await h.service.emit(ROW_ID)).toBe('parked');
    expect(h.client.createInvoice).not.toHaveBeenCalled();
  });

  it('flags a certified total that is not the charged total', async () => {
    const h = harness({ createInvoice: certified({ ...RRA_ANSWER, totAmt: 180000 }) });
    expect(await h.service.emit(ROW_ID)).toBe('emitted_with_problem');
    const [, stored] = h.emissions.markEmitted.mock.calls[0] as unknown as [
      string,
      { problem: string; externalInvoiceId: number; payload: EmissionPayload },
    ];
    // Still EMITTED: the sale is certified, and calling it unsent would invite
    // the resend that declares it twice.
    expect(stored.externalInvoiceId).toBe(41);
    expect(stored.problem).toContain('180000');
    expect(stored.payload.readError).toBe(stored.problem);
  });

  it("tolerates the provider's cent rounding of the tax, but not a franc", async () => {
    const cents = harness({ createInvoice: certified({ ...RRA_ANSWER, taxAmtB: 28831.36 }) });
    expect(await cents.service.emit(ROW_ID)).toBe('emitted');
    const franc = harness({ createInvoice: certified({ ...RRA_ANSWER, taxAmtB: 28833 }) });
    expect(await franc.service.emit(ROW_ID)).toBe('emitted_with_problem');
  });

  it('fetches the invoice once when the POST answer lacks a device field, and uses it', async () => {
    const partial = answerWithout('totRcptNo', 'vsdcRcptPbctDate');
    const h = harness({
      createInvoice: certified(partial),
      getInvoice: async () => ({ id: 41, status: 'Certified', raw: { ...RRA_ANSWER } }),
    });
    expect(await h.service.emit(ROW_ID)).toBe('emitted');
    expect(h.client.invoice).toHaveBeenCalledWith('at-1', 41);
  });

  it('records a certified sale whose answer cannot be printed as emitted, with the reason', async () => {
    const partial = answerWithout('totRcptNo');
    const h = harness({
      createInvoice: certified(partial),
      getInvoice: async () => ({ id: 41, status: 'Certified', raw: partial }),
    });
    expect(await h.service.emit(ROW_ID)).toBe('emitted_with_problem');
    const [, stored] = h.emissions.markEmitted.mock.calls[0] as unknown as [string, { problem: string }];
    expect(stored.problem).toMatch(/totRcptNo/);
  });
});
