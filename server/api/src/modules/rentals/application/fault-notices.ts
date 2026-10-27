import { FAULT_URGENCY_LABEL, kigaliDateOf, type MaintenanceStatus } from '@injishi/contracts';
import { Injectable, Logger } from '@nestjs/common';

import {
  faultMessageLandlordMail,
  faultMovedTenantMail,
  faultReopenedLandlordMail,
  faultReplyTenantMail,
  faultReportedLandlordMail,
} from '../domain/fault-mail';
import type { RentalsMail } from '../domain/rentals-mail';
import { FaultsRepository, type FaultRow } from '../infrastructure/faults.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { RentalsMailer } from '../infrastructure/rentals.mailer';

/**
 * Who hears about a fault, by email (WP 4.1). The tenant hears of every move
 * and every reply the landlord meant them to see; the landlord hears of a new
 * report, a reopen and the tenant's messages. Never throws: the thing a mail
 * is about is already written when it is sent.
 */
@Injectable()
export class FaultNotices {
  private readonly log = new Logger(FaultNotices.name);

  constructor(
    private readonly faults: FaultsRepository,
    private readonly context: RentalsContextRepository,
    private readonly mailer: RentalsMailer,
  ) {}

  /** The app's origin, for the links in a mail. */
  get appUrl(): string {
    return this.mailer.appUrl;
  }

  /** The business's contact address, else its owner's. */
  async landlordAddress(row: Pick<FaultRow, 'orgId' | 'workspaceId'>): Promise<string | null> {
    if (!row.orgId) return null;
    const profile = await this.context.ensureProfile({ orgId: row.orgId, workspaceId: row.workspaceId });
    if (profile.contactEmail) return profile.contactEmail;
    return (await this.context.ownerContact(row.orgId))?.email ?? null;
  }

  async tenantMoved(row: FaultRow, to: MaintenanceStatus, note: string | null): Promise<boolean> {
    if (!row.leaseId || !row.tenantEmail || !row.orgId) return false;
    return this.send(`fault ${row.id} moved to ${to}`, row.tenantEmail, async () =>
      faultMovedTenantMail({
        appUrl: this.mailer.appUrl,
        leaseId: row.leaseId as string,
        tenantName: row.tenantName ?? 'there',
        landlordName: await this.faults.orgName(row.orgId as string),
        home: this.home(row),
        title: row.title,
        to,
        assigneeName: row.assignedContractor ?? row.assignedToName,
        note,
      }),
    );
  }

  async tenantReply(row: FaultRow, body: string): Promise<boolean> {
    if (!row.leaseId || !row.tenantEmail || !row.orgId) return false;
    return this.send(`fault ${row.id} reply`, row.tenantEmail, async () =>
      faultReplyTenantMail({
        appUrl: this.mailer.appUrl,
        leaseId: row.leaseId as string,
        tenantName: row.tenantName ?? 'there',
        landlordName: await this.faults.orgName(row.orgId as string),
        title: row.title,
        body,
      }),
    );
  }

  async landlordReported(row: FaultRow): Promise<boolean> {
    const to = await this.landlordAddress(row);
    if (!to) return false;
    return this.send(`fault ${row.id} reported`, to, async () =>
      faultReportedLandlordMail({
        appUrl: this.mailer.appUrl,
        ticketId: row.id,
        tenantName: row.tenantName ?? 'Your tenant',
        home: this.home(row),
        title: row.title,
        urgencyWords: FAULT_URGENCY_LABEL[row.priority].toLowerCase(),
        description: row.description,
        photoCount: row.photoCount,
        reportedOn: kigaliDateOf(row.createdAt),
      }),
    );
  }

  async landlordReopened(row: FaultRow, reason: string): Promise<boolean> {
    const to = await this.landlordAddress(row);
    if (!to) return false;
    return this.send(`fault ${row.id} reopened`, to, async () =>
      faultReopenedLandlordMail({
        appUrl: this.mailer.appUrl,
        ticketId: row.id,
        tenantName: row.tenantName ?? 'Your tenant',
        home: this.home(row),
        title: row.title,
        reason,
      }),
    );
  }

  async landlordMessage(row: FaultRow, body: string): Promise<boolean> {
    const to = await this.landlordAddress(row);
    if (!to) return false;
    return this.send(`fault ${row.id} tenant message`, to, async () =>
      faultMessageLandlordMail({
        appUrl: this.mailer.appUrl,
        ticketId: row.id,
        tenantName: row.tenantName ?? 'Your tenant',
        home: this.home(row),
        title: row.title,
        body,
      }),
    );
  }

  /** Send one mail; a mail that fails is logged, never thrown. */
  async send(ref: string, to: string, build: () => Promise<RentalsMail>): Promise<boolean> {
    try {
      return await this.mailer.send(ref, to, await build());
    } catch (cause) {
      this.log.error(`${ref}: the email was not sent: ${String(cause)}`);
      return false;
    }
  }

  private home(row: FaultRow): { unitLabel: string; propertyName: string } {
    return { unitLabel: row.unitLabel ?? 'your home', propertyName: row.propertyName ?? 'the property' };
  }
}
