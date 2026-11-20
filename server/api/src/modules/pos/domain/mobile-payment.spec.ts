import { describe, expect, it } from 'vitest';

import {
  cleanPhone,
  ConfirmMobilePaymentRequest,
  EmailReceiptRequest,
  isManualMobile,
  maskEmail,
  receiptMail,
  StartMobilePaymentRequest,
} from './mobile-payment';

describe('mobile money confirmed by the cashier', () => {
  it('treats only MTN MoMo and Airtel Money as confirmed by hand', () => {
    expect(isManualMobile('mtn_momo')).toBe(true);
    expect(isManualMobile('airtel_money')).toBe(true);
    for (const m of ['cash', 'card', 'bank_transfer', 'voucher', 'customer_credit']) expect(isManualMobile(m)).toBe(false);
  });

  it('reads a phone number the way a waiter types it', () => {
    expect(cleanPhone('0788 123 456')).toBe('+250788123456');
    expect(cleanPhone('788123456')).toBe('+250788123456');
    expect(cleanPhone('+250 (788) 123-456')).toBe('+250788123456');
    expect(cleanPhone('12345')).toBeNull();
    expect(cleanPhone('0788abc456')).toBeNull();
  });

  it('accepts only MoMo or Airtel, a positive whole amount and a real phone when Pay is pressed', () => {
    const ok = { method: 'mtn_momo', amountRwf: 17300, payerPhone: '0788123456', idempotencyKey: 'key-12345678' };
    expect(StartMobilePaymentRequest.safeParse(ok).success).toBe(true);
    expect(StartMobilePaymentRequest.safeParse({ ...ok, method: 'cash' }).success).toBe(false);
    expect(StartMobilePaymentRequest.safeParse({ ...ok, amountRwf: 0 }).success).toBe(false);
    expect(StartMobilePaymentRequest.safeParse({ ...ok, amountRwf: 10.5 }).success).toBe(false);
    expect(StartMobilePaymentRequest.safeParse({ ...ok, payerPhone: '123' }).success).toBe(false);
    // Pay can never ask for the payment to be recorded as paid: there is no such field.
    const parsed = StartMobilePaymentRequest.parse({ ...ok, status: 'successful', simulate: 'success' });
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('simulate');
  });

  it('lets the cashier add the transaction ID, never anything that could be markup', () => {
    expect(ConfirmMobilePaymentRequest.safeParse({}).success).toBe(true);
    expect(ConfirmMobilePaymentRequest.safeParse({ transactionId: 'MP261119.1432.A12345' }).success).toBe(true);
    expect(ConfirmMobilePaymentRequest.safeParse({ transactionId: '<script>' }).success).toBe(false);
  });

  it('takes one email address and keeps only a masked one', () => {
    expect(EmailReceiptRequest.safeParse({ email: 'guest@example.com' }).success).toBe(true);
    expect(EmailReceiptRequest.safeParse({ email: 'a@b.com, c@d.com' }).success).toBe(false);
    expect(EmailReceiptRequest.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(maskEmail('guest@example.com')).toBe('gu•••@example.com');
  });

  it('builds a receipt mail from the stored bill and escapes every value', () => {
    const mail = receiptMail({
      venueName: 'Injishi <Bar>',
      venueTin: '123456789',
      venuePhone: '+250788000000',
      venueAddress: 'Kigali',
      footer: '',
      orderNumber: 'POS-261119-0001',
      tableLabel: 'T4',
      orderType: 'dine_in',
      at: new Date('2026-11-19T12:00:00Z'),
      lines: [{ name: 'Brochette & chips', quantity: 2, totalRwf: 9000 }],
      taxMode: 'inclusive',
      grossRwf: 9000,
      discountRwf: 0,
      taxRwf: 1373,
      totalRwf: 9000,
      payments: [{ method: 'mtn_momo', amountRwf: 9000, reference: 'DEMO-MOMO-ABCD1234' }],
    });
    expect(mail.subject).toBe('Your receipt POS-261119-0001 from Injishi <Bar>');
    expect(mail.text).toContain('2 x Brochette & chips  RWF 9,000');
    expect(mail.text).toContain('MTN MoMo: RWF 9,000 (ref DEMO-MOMO-ABCD1234)');
    expect(mail.text).toContain('not an EBM fiscal invoice');
    expect(mail.html).toContain('Injishi &lt;Bar&gt;');
    expect(mail.html).toContain('Brochette &amp; chips');
    expect(mail.html).not.toContain('<Bar>');
  });
});
