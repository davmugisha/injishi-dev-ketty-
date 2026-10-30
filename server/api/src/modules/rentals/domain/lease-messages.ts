import { MESSAGE_APP_PATHS, messagePreview, type LeaseStatus, type MessageSide } from '@injishi/contracts';

import { homeWords, type RentalsMail } from './rentals-mail';

/**
 * The rules of a lease conversation (rentals P3.4), pure so a test reads
 * them: who wrote a line, whether the other side has read it, whether the
 * conversation still takes messages, the page cursor, and the one email a
 * reader gets for everything waiting.
 */

/** A conversation takes messages while the lease is being signed or runs; it is read only once it ended or was cancelled. */
export function leaseThreadWritable(status: LeaseStatus): boolean {
  return status === 'pending_signature' || status === 'signed' || status === 'active' || status === 'ending';
}

/** What a closed conversation says when someone tries to write. */
export const THREAD_CLOSED = 'This lease has ended, so its conversation is read only.';

/** Which side a line is from: the tenant's account, the platform, or anyone else (the owner or a team member). */
export function senderSide(senderUserId: string | null, bodyType: string, tenantUserId: string | null): MessageSide {
  if (senderUserId === null || bodyType === 'system') return 'system';
  return tenantUserId !== null && senderUserId === tenantUserId ? 'tenant' : 'landlord';
}

/**
 * The other side's last read, as the reader's receipts use it: for a
 * landlord's reader, the tenant's; for the tenant, the newest read by anyone
 * on the landlord's side.
 */
export function otherSideRead(
  reads: readonly { userId: string; lastReadAt: Date }[],
  viewerSide: 'landlord' | 'tenant',
  tenantUserId: string | null,
): Date | null {
  let best: Date | null = null;
  for (const r of reads) {
    const isTenant = tenantUserId !== null && r.userId === tenantUserId;
    if (viewerSide === 'landlord' ? !isTenant : isTenant) continue;
    if (!best || r.lastReadAt > best) best = r.lastReadAt;
  }
  return best;
}

/** One of our lines: read once the other side opened the conversation at or after it. */
export function receiptFor(createdAt: Date, otherReadAt: Date | null): 'delivered' | 'read' {
  return otherReadAt && otherReadAt.getTime() >= createdAt.getTime() ? 'read' : 'delivered';
}

/** What kind of line a message with these files is. */
export function bodyTypeFor(kinds: readonly ('image' | 'file' | 'audio')[]): 'text' | 'image' | 'voice' | 'file' {
  if (kinds.includes('audio')) return 'voice';
  if (kinds.length === 0) return 'text';
  return kinds.every((k) => k === 'image') ? 'image' : 'file';
}

/** The page cursor: a message's `(created_at, id)`, opaque. */
export function encodeMessageCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeMessageCursor(cursor: string | undefined | null): { createdAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = at ? new Date(at) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime()) || !id || !/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  return { createdAt, id };
}

/** One conversation in a digest. */
export interface DigestItem {
  leaseId: string;
  unitLabel: string;
  propertyName: string;
  /** Where the button opens this conversation, when it is not a lease's (a broker conversation). */
  href?: string;
  /** The words for what it is about, when it is not a lease's home ("your placement for unit A-01 at ..."). */
  about?: string;
  /** Who wrote: the tenant's name for the landlord, the business's for the tenant. */
  from: string;
  unread: number;
  newestBody: string | null;
  newestBodyType: string;
  newestVoiceS: number | null;
}

/**
 * Whether a side of a conversation is due an email now: its oldest unread
 * line from the other side has waited `delayMin`, and no email went to that
 * side in the last `cooldownMin`. (The repository asks the same in SQL; this
 * is the rule written out for the tests and the screens.)
 */
export function digestDue(input: {
  now: Date;
  oldestUnreadAt: Date | null;
  lastSentAt: Date | null;
  delayMin: number;
  cooldownMin: number;
}): boolean {
  if (!input.oldestUnreadAt) return false;
  if (input.now.getTime() - input.oldestUnreadAt.getTime() < input.delayMin * 60_000) return false;
  if (input.lastSentAt && input.now.getTime() - input.lastSentAt.getTime() < input.cooldownMin * 60_000) return false;
  return true;
}

function preview(item: DigestItem): string {
  return messagePreview({
    body: item.newestBody,
    bodyType: item.newestBodyType,
    attachments: item.newestBodyType === 'voice' ? [{ kind: 'audio' }] : item.newestBodyType === 'image' ? [{ kind: 'image' }] : item.newestBodyType === 'file' ? [{ kind: 'file' }] : [],
  });
}

const count = (n: number): string => (n === 1 ? '1 new message' : `${n} new messages`);

/**
 * ONE email for everything waiting for one reader: each conversation with
 * how many lines and the newest one, and one button. The landlord's opens
 * the conversation (or the inbox when there are several); the tenant's opens
 * their home's messages.
 */
export function messageDigestMail(input: { appUrl: string; side: 'landlord' | 'tenant' | 'broker'; greetName: string | null; items: readonly DigestItem[] }): RentalsMail {
  const items = input.items;
  const total = items.reduce((n, i) => n + i.unread, 0);
  const one = items.length === 1 ? items[0] : undefined;
  const lines: string[] = [];
  for (const i of items) {
    const where = i.about ?? homeWords({ unitLabel: i.unitLabel, propertyName: i.propertyName });
    const said = preview(i);
    lines.push(`${i.from} sent ${count(i.unread)} about ${where}${said ? `: "${said}"` : '.'}`);
  }
  const path =
    one?.href ??
    (input.side === 'tenant'
      ? MESSAGE_APP_PATHS.tenant((one ?? items[0])?.leaseId ?? '')
      : one && input.side === 'landlord'
        ? MESSAGE_APP_PATHS.landlord(one.leaseId)
        : '/messages');
  const subject = one
    ? `${one.from} sent ${count(one.unread)}`
    : `${count(total)} in ${items.length} conversations`;
  return {
    subject,
    heading: input.greetName ? `Hello ${input.greetName.trim().split(/\s+/)[0]}` : 'You have new messages',
    lines,
    action: { label: one || input.side === 'tenant' ? 'Read and reply' : 'Open messages', url: new URL(path, input.appUrl).toString() },
    footnote: 'You get one email when messages wait unread for a few minutes, not one per message.',
  };
}
