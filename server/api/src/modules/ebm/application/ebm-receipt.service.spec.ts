import { ConflictException, NotFoundException } from '@nestjs/common';

import type {
  BookingForReceipt,
  EbmBookingRepository,
} from '../infrastructure/ebm-booking.repository';
import { MockVsdcSigner } from '../infrastructure/mock-vsdc.signer';
import { EbmReceiptService } from './ebm-receipt.service';

/**
 * What this service is answerable for is a short list, and all of it is here:
 * it must answer only the guest who booked, it must refuse rather than print
 * something untrue, and what it does print must total the money that moved.
 */
describe('EbmReceiptService', () => {
  const GUEST = '11111111-1111-1111-1111-111111111111';
  const WORKSPACE = '33333333-3333-3333-3333-333333333333';

  function row(overrides: Partial<BookingForReceipt> = {}): BookingForReceipt {
    return {
      reference: 'BK-7Q2M-4XKD',
      status: 'confirmed',
      paymentStatus: 'captured',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      lockedNightlyRateRwf: 90_000,
      nonRefundable: false,
      grossRwf: 189_000,
      workspaceId: WORKSPACE,
      orgId: '44444444-4444-4444-4444-444444444444',
      roomTypeName: 'Deluxe Room',
      propertyName: 'Umurage Guesthouse',
      addressText: 'KG 7 Ave',
      districtName: 'Gasabo',
      sellerLegalName: 'Umurage Guesthouse Ltd',
      sellerTin: '102938475',
      paymentAdapterMode: 'mock',
      confirmedAt: new Date('2026-06-04T21:40:00.000Z'),
      createdAt: new Date('2026-06-04T21:39:00.000Z'),
      ...overrides,
    };
  }

  /**
   * A stub repository, not a mock database. The query itself is not under test
   * here — what is under test is what the service does with what it gets back,
   * including getting back nothing.
   */
  function serviceFor(
    result: BookingForReceipt | null,
    seen: { reference?: string; guestUserId?: string } = {},
  ): EbmReceiptService {
    const repository = {
      findGuestBooking: async (reference: string, guestUserId: string) => {
        seen.reference = reference;
        seen.guestUserId = guestUserId;
        return result;
      },
    } as unknown as EbmBookingRepository;
    return new EbmReceiptService(repository, new MockVsdcSigner());
  }

  it('issues an NS receipt that totals what the guest was charged', async () => {
    const receipt = await serviceFor(row()).receiptForGuest(
      'BK-7Q2M-4XKD',
      GUEST,
    );

    expect(receipt.receiptType).toBe('NS');
    expect(receipt.transaction).toBe('SALE');
    expect(receipt.bookingReference).toBe('BK-7Q2M-4XKD');
    expect(receipt.totalRwf).toBe(189_000);
    expect(receipt.totalTaxRwf).toBe(28_831); // 189 000 x 18 / 118
    expect(receipt.taxLines).toEqual([
      { label: 'B', ratePercent: 18, taxableRwf: 189_000, taxRwf: 28_831 },
    ]);
    expect(receipt.itemsNumber).toBe(2);
    expect(receipt.seller).toEqual({
      tradeName: 'Umurage Guesthouse Ltd',
      address: 'KG 7 Ave, Gasabo',
      tin: '102938475',
    });
    expect(receipt.sdc.receiptLabel).toBe('NS');
    expect(receipt.cis.mrc).toMatch(/^[A-Z]{5}\d{6}$/);
  });

  it('says on the receipt that the payment seam was a mock (7.13)', async () => {
    const mocked = await serviceFor(row()).receiptForGuest('BK-7Q2M-4XKD', GUEST);
    const live = await serviceFor(
      row({ paymentAdapterMode: 'live' }),
    ).receiptForGuest('BK-7Q2M-4XKD', GUEST);

    expect(mocked.payment.label).toBe('ONLINE PAYMENT (MOCK)');
    expect(live.payment.label).toBe('ONLINE PAYMENT');
    expect(mocked.payment.amountRwf).toBe(mocked.totalRwf);
  });

  it('reads the same booking back identically, however often it is asked', async () => {
    const service = serviceFor(row());

    const first = await service.receiptForGuest('BK-7Q2M-4XKD', GUEST);
    const second = await service.receiptForGuest('BK-7Q2M-4XKD', GUEST);

    expect(second).toEqual(first);
  });

  it('scopes the lookup to the caller, and upper-cases a retyped reference', async () => {
    const seen: { reference?: string; guestUserId?: string } = {};

    await serviceFor(row(), seen).receiptForGuest(' bk-7q2m-4xkd ', GUEST);

    expect(seen.reference).toBe('BK-7Q2M-4XKD');
    expect(seen.guestUserId).toBe(GUEST);
  });

  /**
   * The disclosure control. A reference is short and is printed on
   * confirmations; if "someone else's booking" answered differently from "no
   * such booking", the route would enumerate other people's stay dates and
   * their host's TIN.
   */
  it('answers a booking it cannot find and one it may not show identically', async () => {
    const missing = serviceFor(null);

    await expect(
      missing.receiptForGuest('BK-7Q2M-4XKD', GUEST),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(missing.receiptForGuest('BK-7Q2M-4XKD', GUEST)).rejects.toThrow(
      'No receipt for that booking reference.',
    );
  });

  it('never reaches the database for something that is not a reference', async () => {
    const seen: { reference?: string } = {};

    await expect(
      serviceFor(row(), seen).receiptForGuest('../../etc/passwd', GUEST),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(seen.reference).toBeUndefined();
  });

  it('refuses a refunded booking instead of declaring a sale that was undone', async () => {
    // Clause 14: money that came back is declared on an NR receipt, which this
    // build does not issue. The NS receipt would be a false declaration.
    await expect(
      serviceFor(
        row({ status: 'cancelled', paymentStatus: 'refunded_full' }),
      ).receiptForGuest('BK-7Q2M-4XKD', GUEST),
    ).rejects.toThrow(/refund receipt \(RRA type NR\) is not issued yet/);
  });

  it('refuses a booking nobody has paid for', async () => {
    await expect(
      serviceFor(row({ paymentStatus: null })).receiptForGuest(
        'BK-7Q2M-4XKD',
        GUEST,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('invoices a stay still awaiting its host, because the money was taken', async () => {
    const receipt = await serviceFor(
      row({ status: 'pending_approval', confirmedAt: null }),
    ).receiptForGuest('BK-7Q2M-4XKD', GUEST);

    // Stamped from `createdAt` when there is no `confirmedAt`: 21:39 UTC is
    // 23:39 in Kigali.
    expect(receipt.sdc.time).toBe('23:39:00');
  });

  /**
   * A receipt names the taxpayer who owes the tax. The specification's samples
   * print `TIN: 000000000` because they are samples; printing that on a live
   * receipt would attribute a real sale to a number identifying nobody.
   */
  it('refuses rather than inventing a TIN for a property that has none', async () => {
    await expect(
      serviceFor(row({ sellerTin: null })).receiptForGuest(
        'BK-7Q2M-4XKD',
        GUEST,
      ),
    ).rejects.toThrow(/no registered taxpayer with a TIN/);
  });

  it('refuses a booking that lost the locked rate it would be itemised from', async () => {
    await expect(
      serviceFor(row({ lockedNightlyRateRwf: null })).receiptForGuest(
        'BK-7Q2M-4XKD',
        GUEST,
      ),
    ).rejects.toThrow(/locked rate/);
  });

  it('refuses when the stored total disagrees with the locked rate', async () => {
    // Not a 409 dressed up as arithmetic: this is our own data contradicting
    // itself, and the only wrong answer is to print a plausible total anyway.
    await expect(
      serviceFor(row({ grossRwf: 5 })).receiptForGuest('BK-7Q2M-4XKD', GUEST),
    ).rejects.toThrow(/could not be invoiced/);
  });

  it('itemises the non-refundable reduction as the spec discount line', async () => {
    // 180 000 less 10%, plus a 5% fee on the reduced amount.
    const receipt = await serviceFor(
      row({ nonRefundable: true, grossRwf: 170_100 }),
    ).receiptForGuest('BK-7Q2M-4XKD', GUEST);

    expect(receipt.items[0].discountPercent).toBe(10);
    expect(receipt.items[0].discountedTotalRwf).toBe(162_000);
    expect(receipt.totalRwf).toBe(170_100);
  });

  it('leaves the client id empty rather than printing a number that is not one', async () => {
    const receipt = await serviceFor(row()).receiptForGuest(
      'BK-7Q2M-4XKD',
      GUEST,
    );

    // 13.1 marks it optional and means a customer's own tax identity, which is
    // not collected for a stay. A user id in that slot would be noise where an
    // auditor expects a TIN.
    expect(receipt.clientId).toBeNull();
  });
});
