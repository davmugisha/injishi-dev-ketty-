import type { AssistantSource, AssistantSurface, SupportTopic } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, max, ne } from 'drizzle-orm';

import {
  assistantConversations,
  assistantFeedback,
  assistantMessages,
} from '../../../database/drizzle/assistant';
import { supportTickets } from '../../../database/drizzle/governance';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import type { ModelMessage } from '../domain/model-port';

export interface ConversationRow {
  id: string;
  ownerUserId: string | null;
  surface: AssistantSurface;
  expiresAt: Date;
  pageContext?: string | null;
}

/** A message with the conversation it belongs to, for an ownership check. */
export interface OwnedMessageRow {
  messageId: string;
  role: 'user' | 'assistant';
  conversationId: string;
  ownerUserId: string | null;
  anonTokenHash: string | null;
  closedAt: Date | null;
  expiresAt: Date;
}

export interface NewEscalationTicket {
  requesterUserId: string | null;
  category: string;
  message: string;
  contactEmail: string | null;
  contactName: string | null;
  conversationId: string;
  context: Record<string, unknown>;
}

export interface MessageRow {
  id: string;
  seq: number;
  role: 'user' | 'assistant';
  displayText: string;
  modelContent: ModelMessage[];
  sources: AssistantSource[];
  toolCalls: ToolCallRecord[];
  /** How an assistant answer was produced (ADR-061 D-q); null on the person's messages. */
  route: string | null;
  createdAt: Date;
}

/** One tool call a turn made, and any proposal it prepared (slice E). */
export interface ToolCallRecord {
  name: string;
  ok: boolean;
  proposalIds?: string[];
  /** The support topic, when this call offered human support (slice F). */
  escalationTopic?: SupportTopic;
  /**
   * The task guide this call gave, so a later "still stuck" can offer that
   * guide's tutorial and never a tutorial before the steps (ADR-061 D-q).
   */
  guideId?: string;
}

export interface NewMessage {
  role: 'user' | 'assistant';
  displayText: string;
  modelContent: ModelMessage[];
  toolCalls: ToolCallRecord[];
  sources: AssistantSource[];
  route?: string | null;
}

/** Two turns raced on one conversation and this one lost the seq. Maps to 409. */
export class ConversationBusyError extends Error {
  constructor() {
    super('Another message is being answered in this conversation.');
    this.name = 'ConversationBusyError';
  }
}

const conversationColumns = {
  id: assistantConversations.id,
  ownerUserId: assistantConversations.ownerUserId,
  surface: assistantConversations.surface,
  expiresAt: assistantConversations.expiresAt,
  pageContext: assistantConversations.pageContext,
};

/**
 * Persistence for assistant conversations (ADR-061, migration 0054_support_assistant).
 *
 * Every read that finds "the current conversation" filters on `closed_at IS
 * NULL` and `expires_at > now`, so an expired conversation is absent to the
 * product from the day this ships, whether or not the deletion job has run.
 */
@Injectable()
export class ConversationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findCurrentForUser(
    userId: string,
    surface: AssistantSurface,
    now: Date,
  ): Promise<ConversationRow | null> {
    const [row] = await this.db
      .select(conversationColumns)
      .from(assistantConversations)
      .where(
        and(
          eq(assistantConversations.ownerUserId, userId),
          eq(assistantConversations.surface, surface),
          isNull(assistantConversations.closedAt),
          gt(assistantConversations.expiresAt, now),
        ),
      )
      .orderBy(desc(assistantConversations.lastMessageAt))
      .limit(1);
    return row ? toConversation(row) : null;
  }

  async findCurrentForAnon(
    tokenHash: string,
    now: Date,
  ): Promise<ConversationRow | null> {
    const [row] = await this.db
      .select(conversationColumns)
      .from(assistantConversations)
      .where(
        and(
          eq(assistantConversations.anonTokenHash, tokenHash),
          isNull(assistantConversations.ownerUserId),
          isNull(assistantConversations.closedAt),
          gt(assistantConversations.expiresAt, now),
        ),
      )
      .limit(1);
    return row ? toConversation(row) : null;
  }

  async create(values: {
    ownerUserId: string | null;
    anonTokenHash: string | null;
    surface: AssistantSurface;
    expiresAt: Date;
    now: Date;
  }): Promise<ConversationRow> {
    const [row] = await this.db
      .insert(assistantConversations)
      .values({
        ownerUserId: values.ownerUserId,
        anonTokenHash: values.anonTokenHash,
        surface: values.surface,
        createdAt: values.now,
        lastMessageAt: values.now,
        expiresAt: values.expiresAt,
      })
      .returning(conversationColumns);
    return toConversation(row);
  }

  /**
   * Attach an unexpired anonymous conversation to an account (ADR-061 D-e).
   *
   * ONE conditional update: it moves only a row that still has no owner, so
   * two sign ins racing on one cookie attach it once, and a conversation that
   * already belongs to someone is never moved. The token hash is cleared in
   * the same write, so the cookie opens nothing afterwards. Only once that
   * write has landed is the caller's previous conversation on the surface
   * closed, in the same transaction, so the attached one becomes current and
   * a lost race closes nothing.
   */
  async claimAnon(values: {
    tokenHash: string;
    userId: string;
    surface: AssistantSurface;
    now: Date;
    expiresAt: Date;
  }): Promise<ConversationRow | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(assistantConversations)
        .set({
          ownerUserId: values.userId,
          anonTokenHash: null,
          attachedAt: values.now,
          expiresAt: values.expiresAt,
        })
        .where(
          and(
            eq(assistantConversations.anonTokenHash, values.tokenHash),
            eq(assistantConversations.surface, values.surface),
            isNull(assistantConversations.ownerUserId),
            isNull(assistantConversations.closedAt),
            gt(assistantConversations.expiresAt, values.now),
          ),
        )
        .returning(conversationColumns);
      if (!row) return null;

      await tx
        .update(assistantConversations)
        .set({ closedAt: values.now })
        .where(
          and(
            eq(assistantConversations.ownerUserId, values.userId),
            eq(assistantConversations.surface, values.surface),
            isNull(assistantConversations.closedAt),
            ne(assistantConversations.id, row.id),
          ),
        );
      return toConversation(row);
    });
  }

  /**
   * Close an anonymous conversation its holder disowned, attaching nothing.
   * The token hash stays (the holder CHECK needs an owner or a token); a
   * closed row is unreachable anyway, because every read filters on it.
   */
  async discardAnon(tokenHash: string, now: Date): Promise<void> {
    await this.db
      .update(assistantConversations)
      .set({ closedAt: now })
      .where(
        and(
          eq(assistantConversations.anonTokenHash, tokenHash),
          isNull(assistantConversations.ownerUserId),
        ),
      );
  }

  async findMessage(messageId: string): Promise<OwnedMessageRow | null> {
    const [row] = await this.db
      .select({
        messageId: assistantMessages.id,
        role: assistantMessages.role,
        conversationId: assistantConversations.id,
        ownerUserId: assistantConversations.ownerUserId,
        anonTokenHash: assistantConversations.anonTokenHash,
        closedAt: assistantConversations.closedAt,
        expiresAt: assistantConversations.expiresAt,
      })
      .from(assistantMessages)
      .innerJoin(assistantConversations, eq(assistantConversations.id, assistantMessages.conversationId))
      .where(eq(assistantMessages.id, messageId))
      .limit(1);
    return row ? { ...row, role: row.role === 'assistant' ? 'assistant' : 'user' } : null;
  }

  /** One feedback row per answer; a second press changes nothing. */
  async setFeedback(messageId: string, helpful: boolean): Promise<boolean> {
    const inserted = await this.db
      .insert(assistantFeedback)
      .values({ messageId, helpful })
      .onConflictDoNothing({ target: assistantFeedback.messageId })
      .returning({ id: assistantFeedback.id });
    return inserted.length > 0;
  }

  async feedbackFor(messageIds: string[]): Promise<Map<string, boolean>> {
    if (messageIds.length === 0) return new Map();
    const rows = await this.db
      .select({ messageId: assistantFeedback.messageId, helpful: assistantFeedback.helpful })
      .from(assistantFeedback)
      .where(inArray(assistantFeedback.messageId, messageIds));
    return new Map(rows.map((r) => [r.messageId, r.helpful]));
  }

  /** The support ticket the person sent from the assistant (ADR-061 D-l). */
  async createEscalationTicket(values: NewEscalationTicket): Promise<string> {
    const [row] = await this.db
      .insert(supportTickets)
      .values({
        requesterUserId: values.requesterUserId,
        category: values.category,
        state: 'open',
        message: values.message,
        contactEmail: values.contactEmail,
        contactName: values.contactName,
        assistantConversationId: values.conversationId,
        context: values.context,
      })
      .returning({ id: supportTickets.id });
    return row.id;
  }

  async close(conversationId: string, now: Date): Promise<void> {
    await this.db
      .update(assistantConversations)
      .set({ closedAt: now })
      .where(eq(assistantConversations.id, conversationId));
  }

  async listMessages(conversationId: string): Promise<MessageRow[]> {
    const rows = await this.db
      .select({
        id: assistantMessages.id,
        seq: assistantMessages.seq,
        role: assistantMessages.role,
        displayText: assistantMessages.displayText,
        modelContent: assistantMessages.modelContent,
        sources: assistantMessages.sources,
        toolCalls: assistantMessages.toolCalls,
        route: assistantMessages.route,
        createdAt: assistantMessages.createdAt,
      })
      .from(assistantMessages)
      .where(eq(assistantMessages.conversationId, conversationId))
      .orderBy(asc(assistantMessages.seq));
    return rows.map((r) => ({
      ...r,
      role: r.role === 'assistant' ? 'assistant' : 'user',
      modelContent: r.modelContent as ModelMessage[],
      sources: r.sources as AssistantSource[],
      toolCalls: (r.toolCalls ?? []) as ToolCallRecord[],
      route: r.route ?? null,
    }));
  }

  /**
   * Append one turn (the question and its answer) and move the retention
   * clock, in one transaction. The seq comes from the rows already there, so
   * a turn that raced another on the same conversation fails on the unique
   * (conversation, seq) index instead of interleaving the two.
   */
  async appendTurn(
    conversationId: string,
    messages: NewMessage[],
    clock: { now: Date; expiresAt: Date; pageContext: string | null },
  ): Promise<string[]> {
    try {
      return await this.db.transaction(async (tx) => {
        const [last] = await tx
          .select({ seq: max(assistantMessages.seq) })
          .from(assistantMessages)
          .where(eq(assistantMessages.conversationId, conversationId));
        let seq = last?.seq ?? 0;
        const inserted = await tx
          .insert(assistantMessages)
          .values(
            messages.map((m) => ({
              conversationId,
              seq: ++seq,
              role: m.role,
              displayText: m.displayText,
              modelContent: m.modelContent,
              toolCalls: m.toolCalls,
              sources: m.sources,
              route: m.route ?? null,
              createdAt: clock.now,
            })),
          )
          .returning({ id: assistantMessages.id, seq: assistantMessages.seq });
        await tx
          .update(assistantConversations)
          .set({
            lastMessageAt: clock.now,
            expiresAt: clock.expiresAt,
            ...(clock.pageContext ? { pageContext: clock.pageContext } : {}),
          })
          .where(eq(assistantConversations.id, conversationId));
        // In the order given, so the caller can tie usage to the answer.
        return [...inserted].sort((a, b) => a.seq - b.seq).map((r) => r.id);
      });
    } catch (error) {
      if (isSeqCollision(error)) throw new ConversationBusyError();
      throw error;
    }
  }
}

function toConversation(row: {
  id: string;
  ownerUserId: string | null;
  surface: string;
  expiresAt: Date;
  pageContext?: string | null;
}): ConversationRow {
  return { ...row, surface: row.surface as AssistantSurface };
}

function isSeqCollision(err: unknown): boolean {
  const candidates = [err, (err as { cause?: unknown })?.cause];
  return candidates.some(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      (e as { code?: string }).code === '23505' &&
      (e as { constraint?: string }).constraint ===
        'assistant_messages_conversation_seq_uk',
  );
}
