import { MESSAGE_DIGEST_COOLDOWN_MIN, MESSAGE_DIGEST_DELAY_MIN } from '@injishi/contracts';
import { Injectable, Logger } from '@nestjs/common';

import { messageDigestMail, type DigestItem } from '../domain/lease-messages';
import { LeaseMessagesRepository, type DigestCandidateRow } from '../infrastructure/lease-messages.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { RentalsMailer } from '../infrastructure/rentals.mailer';

/**
 * The unread-message emails (rentals P3.4). Every couple of minutes the
 * worker asks which sides of which lease conversations have lines from the
 * other side waiting unread for `MESSAGE_DIGEST_DELAY_MIN`, groups them by
 * the address they go to, and sends each address ONE email for everything
 * waiting. Each conversation and side then records what the email covered,
 * so the next one is only about newer lines, and never sooner than
 * `MESSAGE_DIGEST_COOLDOWN_MIN` after the last.
 *
 * The tenant's address is their account's; the landlord's is the business's
 * contact address, else its owner's (as the fault emails do).
 */
@Injectable()
export class MessageDigestsService {
  private readonly log = new Logger(MessageDigestsService.name);

  constructor(
    private readonly repo: LeaseMessagesRepository,
    private readonly context: RentalsContextRepository,
    private readonly mailer: RentalsMailer,
  ) {}

  /** One pass; answers how many emails went. */
  async run(now: Date = new Date()): Promise<number> {
    const due = await this.repo.digestCandidates(now, MESSAGE_DIGEST_DELAY_MIN, MESSAGE_DIGEST_COOLDOWN_MIN);
    if (due.length === 0) return 0;
    const byAddress = new Map<string, { side: 'landlord' | 'tenant'; greet: string | null; rows: DigestCandidateRow[] }>();
    const landlordAddress = new Map<string, { email: string; name: string | null } | null>();
    for (const row of due) {
      let to: { email: string; name: string | null } | null = null;
      if (row.side === 'tenant') {
        to = row.tenantEmail ? { email: row.tenantEmail, name: row.tenantName } : null;
      } else {
        if (!landlordAddress.has(row.orgId)) landlordAddress.set(row.orgId, await this.landlordContact(row));
        to = landlordAddress.get(row.orgId) ?? null;
      }
      if (!to) continue;
      const key = `${row.side}:${to.email.toLowerCase()}`;
      const group = byAddress.get(key) ?? { side: row.side, greet: to.name, rows: [] };
      group.rows.push(row);
      byAddress.set(key, group);
    }
    let sent = 0;
    for (const [key, group] of byAddress) {
      const email = key.slice(key.indexOf(':') + 1);
      const items: DigestItem[] = group.rows.map((r) => ({
        leaseId: r.leaseId,
        unitLabel: r.unitLabel,
        propertyName: r.propertyName,
        from: group.side === 'tenant' ? r.landlordName : r.tenantName,
        unread: r.unread,
        newestBody: r.newestBody,
        newestBodyType: r.newestBodyType,
        newestVoiceS: r.newestVoiceS,
      }));
      const ok = await this.mailer.send(
        `message digest ${group.side} ${group.rows.map((r) => r.reference).join(',')}`,
        email,
        messageDigestMail({ appUrl: this.mailer.appUrl, side: group.side, greetName: group.greet, items }),
      );
      if (!ok) continue;
      sent += 1;
      for (const r of group.rows) await this.repo.recordDigest(r.threadId, r.side, r.newestAtExact, now);
    }
    if (sent > 0) this.log.log(`Sent ${sent} message digest${sent === 1 ? '' : 's'}.`);
    return sent;
  }

  private async landlordContact(row: DigestCandidateRow): Promise<{ email: string; name: string | null } | null> {
    const profile = await this.context.ensureProfile({ orgId: row.orgId, workspaceId: row.workspaceId });
    const owner = await this.context.ownerContact(row.orgId);
    if (profile.contactEmail) return { email: profile.contactEmail, name: profile.signatoryName ?? owner?.name ?? null };
    return owner ? { email: owner.email, name: owner.name } : null;
  }
}
