import { MESSAGE_APP_PATHS, MESSAGE_DIGEST_COOLDOWN_MIN, MESSAGE_DIGEST_DELAY_MIN } from '@injishi/contracts';
import { Injectable, Logger, Optional } from '@nestjs/common';

import { messageDigestMail, type DigestItem } from '../domain/lease-messages';
import { homeWords } from '../domain/rentals-mail';
import { LeaseMessagesRepository, type DigestCandidateRow } from '../infrastructure/lease-messages.repository';
import { PlacementMessagesRepository, type PlacementDigestRow } from '../infrastructure/placement-messages.repository';
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
 * contact address, else its owner's (as the fault emails do). Broker
 * conversations (2026-10-26) go the same way: the broker's own address, and
 * the business's for the landlord's side, in the same one email.
 */
/** One side of one conversation waiting for an email, lease or placement alike. */
interface Due {
  threadId: string;
  side: 'landlord' | 'tenant' | 'broker';
  orgId: string;
  workspaceId: string;
  reference: string;
  newestAtExact: string;
  /** The reader's own address (a tenant, a broker); the landlord's side is the business's contact. */
  to: { email: string; name: string | null } | null;
  item: DigestItem;
}

@Injectable()
export class MessageDigestsService {
  private readonly log = new Logger(MessageDigestsService.name);

  constructor(
    private readonly repo: LeaseMessagesRepository,
    private readonly context: RentalsContextRepository,
    private readonly mailer: RentalsMailer,
    // Broker conversations (2026-10-26) are emailed by the same pass; optional so a test may leave them out.
    @Optional() private readonly placements?: PlacementMessagesRepository,
  ) {}

  /** One pass; answers how many emails went. */
  async run(now: Date = new Date()): Promise<number> {
    const [leases, placements] = await Promise.all([
      this.repo.digestCandidates(now, MESSAGE_DIGEST_DELAY_MIN, MESSAGE_DIGEST_COOLDOWN_MIN),
      this.placements ? this.placements.digestCandidates(now, MESSAGE_DIGEST_DELAY_MIN, MESSAGE_DIGEST_COOLDOWN_MIN) : Promise.resolve([]),
    ]);
    const due: Due[] = [...leases.map((r) => this.fromLease(r)), ...placements.map((r) => this.fromPlacement(r))];
    if (due.length === 0) return 0;
    const byAddress = new Map<string, { side: Due['side']; greet: string | null; rows: Due[] }>();
    const landlordAddress = new Map<string, { email: string; name: string | null } | null>();
    for (const row of due) {
      let to = row.to;
      if (row.side === 'landlord') {
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
      const ok = await this.mailer.send(
        `message digest ${group.side} ${group.rows.map((r) => r.reference).join(',')}`,
        email,
        messageDigestMail({ appUrl: this.mailer.appUrl, side: group.side, greetName: group.greet, items: group.rows.map((r) => r.item) }),
      );
      if (!ok) continue;
      sent += 1;
      for (const r of group.rows) await this.repo.recordDigest(r.threadId, r.side, r.newestAtExact, now);
    }
    if (sent > 0) this.log.log(`Sent ${sent} message digest${sent === 1 ? '' : 's'}.`);
    return sent;
  }

  private fromLease(r: DigestCandidateRow): Due {
    return {
      threadId: r.threadId,
      side: r.side,
      orgId: r.orgId,
      workspaceId: r.workspaceId,
      reference: r.reference,
      newestAtExact: r.newestAtExact,
      to: r.side === 'tenant' && r.tenantEmail ? { email: r.tenantEmail, name: r.tenantName } : null,
      item: {
        leaseId: r.leaseId,
        unitLabel: r.unitLabel,
        propertyName: r.propertyName,
        from: r.side === 'tenant' ? r.landlordName : r.tenantName,
        unread: r.unread,
        newestBody: r.newestBody,
        newestBodyType: r.newestBodyType,
        newestVoiceS: r.newestVoiceS,
      },
    };
  }

  private fromPlacement(r: PlacementDigestRow): Due {
    const home = r.unitLabel && r.propertyName ? homeWords({ unitLabel: r.unitLabel, propertyName: r.propertyName }) : null;
    return {
      threadId: r.threadId,
      side: r.side,
      orgId: r.orgId,
      workspaceId: r.workspaceId,
      reference: `placement ${r.placementId.slice(0, 8)}`,
      newestAtExact: r.newestAtExact,
      to: r.side === 'broker' && r.brokerEmail ? { email: r.brokerEmail, name: r.brokerName } : null,
      item: {
        leaseId: '',
        unitLabel: r.unitLabel ?? '',
        propertyName: r.propertyName ?? '',
        href: MESSAGE_APP_PATHS.placement(r.placementId),
        about: home ? `the placement for ${home}` : 'a placement',
        from: r.side === 'broker' ? r.landlordName : r.brokerName,
        unread: r.unread,
        newestBody: r.newestBody,
        newestBodyType: r.newestBodyType,
        newestVoiceS: r.newestVoiceS,
      },
    };
  }

  private async landlordContact(row: { orgId: string; workspaceId: string }): Promise<{ email: string; name: string | null } | null> {
    const profile = await this.context.ensureProfile({ orgId: row.orgId, workspaceId: row.workspaceId });
    const owner = await this.context.ownerContact(row.orgId);
    if (profile.contactEmail) return { email: profile.contactEmail, name: profile.signatoryName ?? owner?.name ?? null };
    return owner ? { email: owner.email, name: owner.name } : null;
  }
}
