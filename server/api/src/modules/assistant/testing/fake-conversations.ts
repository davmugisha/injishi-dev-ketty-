import type { AssistantSurface } from '@injishi/contracts';

import type {
  ConversationRepository,
  ConversationRow,
  MessageRow,
  NewEscalationTicket,
  NewMessage,
  OwnedMessageRow,
} from '../infrastructure/conversation.repository';

/**
 * An in memory stand in with `ConversationRepository`'s contract, including
 * the expiry and closed filters every "current" read applies. Test only.
 */
export class FakeConversations {
  rows: Array<ConversationRow & { anonTokenHash: string | null; closedAt: Date | null }> = [];
  messages = new Map<string, MessageRow[]>();
  private next = 0;

  asRepository(): ConversationRepository {
    return this as unknown as ConversationRepository;
  }

  findCurrentForUser(userId: string, surface: AssistantSurface, now: Date): Promise<ConversationRow | null> {
    return Promise.resolve(
      this.rows.find(
        (r) => r.ownerUserId === userId && r.surface === surface && !r.closedAt && r.expiresAt > now,
      ) ?? null,
    );
  }

  findCurrentForAnon(hash: string, now: Date): Promise<ConversationRow | null> {
    return Promise.resolve(
      this.rows.find(
        (r) => r.anonTokenHash === hash && !r.ownerUserId && !r.closedAt && r.expiresAt > now,
      ) ?? null,
    );
  }

  create(v: {
    ownerUserId: string | null;
    anonTokenHash: string | null;
    surface: AssistantSurface;
    expiresAt: Date;
  }): Promise<ConversationRow> {
    const row = {
      id: fakeUuid(++this.next),
      ownerUserId: v.ownerUserId,
      anonTokenHash: v.anonTokenHash,
      surface: v.surface,
      expiresAt: v.expiresAt,
      closedAt: null,
    };
    this.rows.push(row);
    this.messages.set(row.id, []);
    return Promise.resolve(row);
  }

  claimAnon(v: {
    tokenHash: string;
    userId: string;
    surface: AssistantSurface;
    now: Date;
    expiresAt: Date;
  }): Promise<ConversationRow | null> {
    const row = this.rows.find(
      (r) =>
        r.anonTokenHash === v.tokenHash &&
        r.surface === v.surface &&
        !r.ownerUserId &&
        !r.closedAt &&
        r.expiresAt > v.now,
    );
    if (!row) return Promise.resolve(null);
    row.ownerUserId = v.userId;
    row.anonTokenHash = null;
    row.expiresAt = v.expiresAt;
    for (const other of this.rows) {
      if (other !== row && other.ownerUserId === v.userId && other.surface === v.surface && !other.closedAt) {
        other.closedAt = v.now;
      }
    }
    return Promise.resolve(row);
  }

  discardAnon(hash: string, now: Date): Promise<void> {
    for (const r of this.rows) if (r.anonTokenHash === hash && !r.ownerUserId) r.closedAt = now;
    return Promise.resolve();
  }

  feedback = new Map<string, boolean>();
  tickets: Array<NewEscalationTicket & { id: string }> = [];

  findMessage(messageId: string): Promise<OwnedMessageRow | null> {
    for (const [conversationId, list] of this.messages) {
      const m = list.find((x) => x.id === messageId);
      if (!m) continue;
      const row = this.rows.find((r) => r.id === conversationId);
      if (!row) return Promise.resolve(null);
      return Promise.resolve({
        messageId,
        role: m.role,
        conversationId,
        ownerUserId: row.ownerUserId,
        anonTokenHash: row.anonTokenHash,
        closedAt: row.closedAt,
        expiresAt: row.expiresAt,
      });
    }
    return Promise.resolve(null);
  }

  setFeedback(messageId: string, helpful: boolean): Promise<boolean> {
    if (this.feedback.has(messageId)) return Promise.resolve(false);
    this.feedback.set(messageId, helpful);
    return Promise.resolve(true);
  }

  feedbackFor(ids: string[]): Promise<Map<string, boolean>> {
    return Promise.resolve(new Map(ids.filter((id) => this.feedback.has(id)).map((id) => [id, this.feedback.get(id) as boolean])));
  }

  createEscalationTicket(values: NewEscalationTicket): Promise<string> {
    const id = fakeUuid(++this.next);
    this.tickets.push({ ...values, id });
    return Promise.resolve(id);
  }

  close(id: string, now: Date): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.closedAt = now;
    return Promise.resolve();
  }

  listMessages(id: string): Promise<MessageRow[]> {
    return Promise.resolve([...(this.messages.get(id) ?? [])]);
  }

  appendTurn(
    id: string,
    list: NewMessage[],
    clock: { now: Date; expiresAt: Date; pageContext?: string | null },
  ): Promise<string[]> {
    const stored = this.messages.get(id) ?? [];
    const ids: string[] = [];
    for (const m of list) {
      const messageId = fakeUuid(++this.next);
      ids.push(messageId);
      stored.push({
        id: messageId,
        seq: stored.length + 1,
        role: m.role,
        displayText: m.displayText,
        modelContent: m.modelContent,
        sources: m.sources,
        toolCalls: m.toolCalls,
        route: m.route ?? null,
        createdAt: clock.now,
      });
    }
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.expiresAt = clock.expiresAt;
      if (clock.pageContext) row.pageContext = clock.pageContext;
    }
    return Promise.resolve(ids);
  }
}

export function fakeUuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
