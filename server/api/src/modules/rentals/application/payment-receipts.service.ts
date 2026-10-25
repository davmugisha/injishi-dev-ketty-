import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { chargeWords, kigaliDateOf, type LeasePaymentMethod } from '@injishi/contracts';

import { StorageService } from '../../storage/application/storage.service';
import { renderReceiptPdf } from '../domain/receipt-pdf';
import {
  paymentReceiptMail,
  paymentReceivedLandlordMail,
  paymentReversedMail,
  type PaymentMailInput,
} from '../domain/rentals-mail';
import { LeasePaymentsRepository, type PaymentRecord } from '../infrastructure/lease-payments.repository';
import { LeasesRepository, type LeaseRecord } from '../infrastructure/leases.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { RentalsMailer } from '../infrastructure/rentals.mailer';
import { SigningRepository } from '../infrastructure/signing.repository';
import { creditOf, paidOnOf } from './rent-presenters';

/**
 * A payment's receipt and the emails around a payment (WP 1.6): the PDF
 * (rendered from the rows each time and kept under a stable key), the
 * tenant's receipt mail with it attached, the landlord's "rent received", and
 * the tenant's "a payment was reversed". Every mail is sent after the rows are
 * written and never throws: the payment stands whether or not the mail goes.
 */
@Injectable()
export class PaymentReceiptsService {
  private readonly log = new Logger(PaymentReceiptsService.name);

  constructor(
    private readonly payments: LeasePaymentsRepository,
    private readonly leases: LeasesRepository,
    private readonly context: RentalsContextRepository,
    private readonly signing: SigningRepository,
    private readonly storage: StorageService,
    private readonly mailer: RentalsMailer,
  ) {}

  /** The receipt PDF of a succeeded payment, rendered now and kept under `payment_receipt/receipt-<id>`. */
  async pdf(paymentId: string): Promise<{ body: Buffer; filename: string; objectId: string }> {
    const record = await this.payments.record(paymentId);
    if (!record || record.payment.status !== 'succeeded' || !record.payment.receiptNumber) throw new NotFoundException('No receipt for this payment.');
    const lease = await this.leases.find(record.payment.leaseId);
    if (!lease) throw new NotFoundException('No receipt for this payment.');
    const org = await this.context.org(lease.lease.orgId);
    const body = await renderReceiptPdf({
      receiptNumber: record.payment.receiptNumber,
      paymentId: record.payment.id,
      leaseReference: lease.lease.reference,
      landlordName: org.legalName,
      tenantName: lease.tenant.fullName,
      home: { unitLabel: lease.unitLabel, propertyName: lease.propertyName },
      amountRwf: record.payment.amountRwf,
      method: record.payment.method,
      channel: record.payment.channel,
      reference: record.payment.reference,
      payerMasked: record.payment.payerMasked,
      paidOn: paidOnOf(record.payment) ?? kigaliDateOf(record.payment.createdAt),
      lines: record.allocations.map((a) => ({ label: chargeWords(a.charge), amountRwf: a.amountRwf })),
      creditRwf: creditOf(record),
      generatedAt: new Date(),
    });
    const filename = `receipt-${record.payment.receiptNumber}.pdf`;
    const stored = await this.storage.putPaymentReceipt({ body, filename, keyHint: `receipt-${record.payment.id}`, workspaceId: record.payment.workspaceId });
    return { body, filename, objectId: stored.id };
  }

  /** Email the tenant their receipt, PDF attached. False when it did not go. */
  async mailTenantReceipt(paymentId: string): Promise<boolean> {
    try {
      const { record, lease, input } = await this.mailInput(paymentId);
      const to = await this.tenantAddress(lease);
      if (!to) return false;
      const { body, filename } = await this.pdf(record.payment.id);
      return await this.mailer.send(`payment ${paymentId} receipt`, to, paymentReceiptMail(input), [{ filename, content: body, contentType: 'application/pdf' }]);
    } catch (cause) {
      this.log.error(`receipt email for payment ${paymentId} failed: ${String(cause)}`);
      return false;
    }
  }

  /** Tell the landlord a tenant paid through Injishi, and where the money goes on. */
  async mailLandlordReceived(paymentId: string, payoutWords: string): Promise<boolean> {
    try {
      const { lease, input } = await this.mailInput(paymentId);
      const to = await this.landlordAddress(lease);
      if (!to) return false;
      return await this.mailer.send(`payment ${paymentId} landlord`, to, paymentReceivedLandlordMail({ ...input, leaseReference: lease.lease.reference, payoutWords }));
    } catch (cause) {
      this.log.error(`"rent received" email for payment ${paymentId} failed: ${String(cause)}`);
      return false;
    }
  }

  /** Tell the tenant a recorded payment was reversed. */
  async mailTenantReversed(paymentId: string, reason: string): Promise<boolean> {
    try {
      const record = await this.payments.record(paymentId);
      if (!record) return false;
      const lease = await this.leases.find(record.payment.leaseId);
      if (!lease) return false;
      const to = await this.tenantAddress(lease);
      if (!to) return false;
      const org = await this.context.org(lease.lease.orgId);
      const outstandingRwf = await this.outstanding(lease.lease.id);
      return await this.mailer.send(
        `payment ${paymentId} reversed`,
        to,
        paymentReversedMail({
          appUrl: this.mailer.appUrl,
          leaseId: lease.lease.id,
          tenantName: lease.tenant.fullName,
          landlordName: org.legalName,
          home: { unitLabel: lease.unitLabel, propertyName: lease.propertyName },
          amountRwf: record.payment.amountRwf,
          receiptNumber: record.payment.receiptNumber,
          reason,
          outstandingRwf,
        }),
      );
    } catch (cause) {
      this.log.error(`"payment reversed" email for payment ${paymentId} failed: ${String(cause)}`);
      return false;
    }
  }

  private async mailInput(paymentId: string): Promise<{ record: PaymentRecord; lease: LeaseRecord; input: PaymentMailInput }> {
    const record = await this.payments.record(paymentId);
    if (!record || record.payment.status !== 'succeeded' || !record.payment.receiptNumber) throw new Error('payment is not succeeded');
    const lease = await this.leases.find(record.payment.leaseId);
    if (!lease) throw new Error('lease vanished');
    const org = await this.context.org(lease.lease.orgId);
    const input: PaymentMailInput = {
      appUrl: this.mailer.appUrl,
      leaseId: lease.lease.id,
      tenantName: lease.tenant.fullName,
      landlordName: org.legalName,
      home: { unitLabel: lease.unitLabel, propertyName: lease.propertyName },
      amountRwf: record.payment.amountRwf,
      method: record.payment.method as LeasePaymentMethod,
      channel: record.payment.channel,
      receiptNumber: record.payment.receiptNumber,
      paidOn: paidOnOf(record.payment) ?? kigaliDateOf(record.payment.createdAt),
      lines: record.allocations.map((a) => ({ label: chargeWords(a.charge), amountRwf: a.amountRwf })),
      creditRwf: creditOf(record),
      outstandingRwf: await this.outstanding(lease.lease.id),
    };
    return { record, lease, input };
  }

  private async outstanding(leaseId: string): Promise<number> {
    const charges = await this.payments.chargesOf(leaseId);
    return charges.filter((c) => c.status === 'open').reduce((s, c) => s + Math.max(0, c.amountRwf - c.paidRwf), 0);
  }

  /** The tenant's account address once they have one, else the address on their record. */
  async tenantAddress(record: LeaseRecord): Promise<string | null> {
    if (record.tenant.userId) return (await this.signing.accountEmail(record.tenant.userId)) ?? record.tenant.email;
    return record.tenant.email;
  }

  /** The business's contact address, else its owner's. */
  async landlordAddress(record: LeaseRecord): Promise<string | null> {
    const profile = await this.context.ensureProfile({ orgId: record.lease.orgId, workspaceId: record.lease.workspaceId });
    if (profile.contactEmail) return profile.contactEmail;
    return (await this.context.ownerContact(record.lease.orgId))?.email ?? null;
  }
}
