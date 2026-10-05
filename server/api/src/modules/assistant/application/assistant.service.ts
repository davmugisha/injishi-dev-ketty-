import {
  ASSISTANT_TURN_LIMIT,
  SUPPORT_MESSAGE_MAX,
  type SupportTopic,
  type AssistantConversation,
  type AssistantSource,
  type AssistantSurface,
  type SendAssistantMessageInput,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { mintAnonToken } from '../domain/anon-token';
import {
  ASSISTANT_MODEL_PORT,
  type AssistantModelPort,
  type ModelBlock,
  type ModelMessage,
  ModelUnavailableError,
  isToolUse,
  textOf,
} from '../domain/model-port';
import { unconfirmedFigures } from '../domain/figures';
import type { TurnOutcome } from '../infrastructure/usage-queries';
import { redact } from '../domain/redaction';
import {
  MAX_MODEL_CALLS_PER_TURN,
  MIN_CALL_BUDGET_MS,
  TURN_BUDGET_MS,
  expiresAtFor,
} from '../domain/retention';
import {
  ConversationBusyError,
  ConversationRepository,
  type ConversationRow,
  type MessageRow,
  type ToolCallRecord,
} from '../infrastructure/conversation.repository';
import { ProposalRepository, type ProposalRow } from '../infrastructure/proposal.repository';
import { presentProposal } from './proposal-view';
import { AssistantToolbox, type ToolCaller, type ToolSet } from './assistant-tools';
import { ASSISTANT_SETTINGS, type AssistantSettings } from './assistant-settings';
import { ASSISTANT_SYSTEM_PROMPT } from './system-prompt';
import { UNCONFIRMED_FIGURE, guideAnswer } from './answer-templates';
import { type FallbackReason, type Gathered, RequestRouter } from './request-router';
import { modelInputFor } from './context-window';
import { type MeteredCall, UsageLedger, type UsageSink } from './usage-ledger';
import type { CallerRole } from '../domain/usage';

/** Who is asking: an account, or the holder of an anonymous cookie. */
export type ConversationHolder =
  | { kind: 'user'; userId: string }
  | { kind: 'anon'; tokenHash: string | null };

/**
 * What the request knows that the tools need. `catalogueOpen` is false on the
 * production pre launch host (D-j); it defaults to false, so a caller that
 * forgets to say fails closed.
 */
export interface TurnContext {
  catalogueOpen: boolean;
  /** The operator workspace, resolved as `WorkspaceGuard` resolves it, or none. */
  workspace?: ScopedWorkspace | null;
  /** True when this session still owes the emailed step up code. */
  stepUpNeeded?: boolean;
}

/** One turn's answer, ready to store. */
interface StoredTurn {
  messages: ModelMessage[];
  text: string;
  sources: AssistantSource[];
  toolCalls: ToolCallRecord[];
  route: string;
  /** How the turn ended (D-s). */
  outcome: TurnOutcome;
}

/** What a model turn did, counted as it runs so a failure still reports it. */
interface CallStats {
  /** Calls attempted, metered or not. */
  modelCalls: number;
  /** Tool calls the model itself asked for. */
  modelToolCalls: number;
}

export interface SendResult {
  conversation: AssistantConversation;
  /** Set when a new anonymous conversation was started: the cookie to set. */
  newAnonToken: string | null;
}

/** Shown when the model declined; never the model's own words about why. */
export const REFUSAL_REPLY =
  "I can't help with that one. For anything about Injishi, ask me again, or use the support page at /support.";
/** Shown when a turn ran out of steps or tokens without an answer. */
export const INCOMPLETE_REPLY =
  "I couldn't finish that answer. Please try again, or use the support page at /support.";

// Tolerant of the spacing and case a model may use: `[source: Host-Charges]`.
const SOURCE_MARKER = /\s?\[\s*source\s*:\s*([A-Za-z0-9_-]+)\s*\]/gi;

/**
 * The assistant's orchestrator (ADR-061).
 *
 * One call to `send` is one user turn: load the conversation, let the request
 * router answer from Injishi's own data and content when it can (D-q), run the
 * tool loop against the model port only when it cannot, and store the question
 * and the answer together, with how the answer was produced. Nothing is stored when the model fails, so
 * a failed turn leaves no half written history behind to replay.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  /** Wall clock for the turn deadline; a field so a test can move time. */
  clock: () => number = Date.now;
  private readonly router: RequestRouter;

  constructor(
    @Inject(ASSISTANT_MODEL_PORT) private readonly model: AssistantModelPort,
    @Inject(ASSISTANT_SETTINGS) private readonly settings: AssistantSettings,
    private readonly conversations: ConversationRepository,
    @Inject(AssistantToolbox) private readonly tools: ToolSet,
    @Inject(ProposalRepository) private readonly proposals: Pick<ProposalRepository, 'listByIds'>,
    @Inject(UsageLedger) private readonly usage: UsageSink,
  ) {
    // The router runs the same permission checked tools the model is offered.
    this.router = new RequestRouter(tools);
  }

  get enabled(): boolean {
    return this.settings.mode !== 'off';
  }

  async current(
    holder: ConversationHolder,
    surface: AssistantSurface,
    now = new Date(),
  ): Promise<AssistantConversation | null> {
    const row = await this.find(holder, surface, now);
    return row ? await this.view(row, await this.conversations.listMessages(row.id)) : null;
  }

  /**
   * Whether a signed in caller still holds an anonymous conversation on this
   * surface that `claim` would attach (ADR-061 D-e).
   */
  async claimable(tokenHash: string | null, surface: AssistantSurface, now = new Date()): Promise<boolean> {
    if (!tokenHash) return false;
    const row = await this.conversations.findCurrentForAnon(tokenHash, now);
    return row !== null && row.surface === surface;
  }

  /**
   * Attach the caller's anonymous conversation to their account, once
   * (D-e). The earlier turns are kept exactly as they were; nothing from the
   * account is added to them, and the account's tools apply from the next
   * turn. When there is nothing to attach, the caller's own current
   * conversation is returned unchanged.
   */
  async claim(
    userId: string,
    tokenHash: string | null,
    surface: AssistantSurface,
    now = new Date(),
    discard = false,
  ): Promise<{ claimed: boolean; conversation: AssistantConversation | null }> {
    if (tokenHash && discard) {
      await this.conversations.discardAnon(tokenHash, now);
    } else if (tokenHash) {
      const row = await this.conversations.claimAnon({
        tokenHash,
        userId,
        surface,
        now,
        expiresAt: expiresAtFor(true, now),
      });
      if (row) {
        return { claimed: true, conversation: await this.view(row, await this.conversations.listMessages(row.id)) };
      }
    }
    return { claimed: false, conversation: await this.current({ kind: 'user', userId }, surface, now) };
  }

  /**
   * Mark one answer helpful or not (D-m). Only the conversation's holder may,
   * only on an assistant answer, once; anything else is not found, so a probe
   * learns nothing about other people's messages.
   */
  async feedback(
    holder: ConversationHolder,
    messageId: string,
    helpful: boolean,
    now = new Date(),
  ): Promise<{ messageId: string; helpful: boolean }> {
    const row = await this.conversations.findMessage(messageId);
    const holds =
      row !== null &&
      row.role === 'assistant' &&
      row.closedAt === null &&
      row.expiresAt > now &&
      (holder.kind === 'user'
        ? row.ownerUserId === holder.userId
        : row.ownerUserId === null && holder.tokenHash !== null && row.anonTokenHash === holder.tokenHash);
    if (!holds) throw new NotFoundException('No such answer.');
    await this.conversations.setFeedback(messageId, helpful);
    const stored = (await this.conversations.feedbackFor([messageId])).get(messageId);
    return { messageId, helpful: stored ?? helpful };
  }

  /**
   * Send the current conversation to Injishi support (D-l). The PERSON's own
   * request: signed in, the reply address is the account's; signed out, it is
   * the one they typed, and without one this refuses. The ticket carries the
   * conversation's context, readable in its message and stored structured.
   */
  async escalate(
    holder: ConversationHolder,
    input: { surface: AssistantSurface; topic: SupportTopic; email?: string; name?: string },
    account: { email: string | null },
    now = new Date(),
  ): Promise<{ ticketId: string }> {
    const conversation = await this.find(holder, input.surface, now);
    if (!conversation) throw new NotFoundException('There is no conversation to send yet.');
    const contactEmail = holder.kind === 'user' ? account.email : (input.email ?? null);
    if (!contactEmail) {
      throw new BadRequestException('Give the email address you want the answer sent to.');
    }
    const messages = await this.conversations.listMessages(conversation.id);
    const proposalIds = messages.flatMap((m) => m.toolCalls.flatMap((t) => t.proposalIds ?? []));
    const prepared = await this.proposals.listByIds(proposalIds);
    const context: EscalationContext = {
      page: conversation.pageContext ?? null,
      questions: messages.filter((m) => m.role === 'user').slice(-5).map((m) => m.displayText.slice(0, 500)),
      toolsUsed: [...new Set(messages.flatMap((m) => m.toolCalls.map((t) => t.name)))],
      proposals: prepared.map((p) => `${p.targetLabel}: ${p.currentValue ?? 'no price'} to ${p.proposedValue} RWF (${p.state})`),
    };
    const ticketId = await this.conversations.createEscalationTicket({
      requesterUserId: holder.kind === 'user' ? holder.userId : null,
      category: input.topic,
      message: escalationMessage(context),
      contactEmail,
      contactName: input.name ?? null,
      conversationId: conversation.id,
      context: { ...context, conversationId: conversation.id, surface: input.surface },
    });
    return { ticketId };
  }

  async send(
    holder: ConversationHolder,
    input: SendAssistantMessageInput,
    now = new Date(),
    context: TurnContext = { catalogueOpen: false },
  ): Promise<SendResult> {
    if (!this.enabled) {
      throw new ServiceUnavailableException({
        code: 'assistant_off',
        message: 'The assistant is not available.',
      });
    }

    let conversation = await this.find(holder, input.surface, now);
    if (conversation && input.startNew) {
      await this.conversations.close(conversation.id, now);
      conversation = null;
    }

    const history = conversation ? await this.conversations.listMessages(conversation.id) : [];
    if (history.filter((m) => m.role === 'user').length >= ASSISTANT_TURN_LIMIT) {
      throw new ConflictException({
        code: 'conversation_full',
        message: 'This conversation is full. Start a new one to keep going.',
      });
    }
    const caller: ToolCaller = {
      userId: holder.kind === 'user' ? holder.userId : null,
      catalogueOpen: context.catalogueOpen,
      requestText: redact(input.message),
      workspace: holder.kind === 'user' ? (context.workspace ?? null) : null,
      stepUpNeeded: holder.kind === 'user' && context.stepUpNeeded === true,
    };
    const question: ModelMessage = {
      role: 'user',
      content: [{ type: 'text', text: redact(input.message) }],
    };
    // Every model call is metered (D-s), the ones of a turn that then fails
    // included: the call was made, so it is paid for and it is counted.
    const metered: MeteredCall[] = [];
    const stats: CallStats = { modelCalls: 0, modelToolCalls: 0 };
    const startedAt = this.clock();
    const spent = {
      route: 'unrouted',
      conversationId: conversation?.id ?? null,
      messageId: null as string | null,
      outcome: 'failed' as TurnOutcome,
      tools: [] as string[],
    };
    try {
      // The router first (D-q): a question it answers costs no model call. The
      // model runs only for what it hands on, and BEFORE anything is written, a
      // new conversation included, so a failed turn leaves nothing behind.
      const asked = redact(input.message);
      const routed = await this.router.route({ question: asked, caller, now, history });
      spent.route = routed.route;
      let turn: StoredTurn;
      if (routed.kind === 'direct') {
        turn = directTurn(routed.text, routed.available, routed.toolCalls, routed.route);
      } else {
        // Spending is capped (D-t): past the month's budget or the daily cap,
        // the model is not called and the answer falls back (D-u).
        const allowance = await this.usage.allowance({ userId: caller.userId, conversationId: conversation?.id ?? null, now });
        if (!allowance.allowed) {
          turn = await this.fallbackTurn(asked, caller, allowance.reason);
        } else {
          try {
            // Minimum context (D-r): a summary and a short window of earlier
            // turns in ONE message, never the whole replayed history.
            // The data the router gathered rides in the one message (D-q,
            // D-r), so one call is the normal case (D-x).
            turn = {
              ...(await this.runTurn([modelInputFor(history, asked, routed.gathered)], caller, metered, stats, [asked], routed.gathered)),
              route: routed.route,
            };
          } catch (error) {
            if (!(error instanceof ModelUnavailableError)) throw error;
            // The provider failed: the person still gets an answer (D-u), and
            // the calls already made are still metered.
            turn = await this.fallbackTurn(asked, caller, 'model_unavailable');
          }
        }
      }
      spent.route = turn.route;
      spent.outcome = turn.outcome;
      spent.tools = turn.toolCalls.map((call) => call.name);

      let newAnonToken: string | null = null;
      if (!conversation) {
        // An anonymous conversation always gets a FRESH token: the old one may
        // still name an expired row the deletion job has not reached, and the
        // token column is unique.
        let anonTokenHash: string | null = null;
        if (holder.kind === 'anon') {
          const minted = mintAnonToken();
          newAnonToken = minted.token;
          anonTokenHash = minted.hash;
        }
        conversation = await this.conversations.create({
          ownerUserId: holder.kind === 'user' ? holder.userId : null,
          anonTokenHash,
          surface: input.surface,
          expiresAt: expiresAtFor(holder.kind === 'user', now),
          now,
        });
      }
      spent.conversationId = conversation.id;

      try {
        const ids = await this.conversations.appendTurn(
          conversation.id,
          [
            {
              role: 'user',
              // The person's own words, as they wrote them, for them to read.
              // The redacted question is the `modelContent`; later turns quote
              // it in their short window (D-r), never the raw words.
              displayText: input.message,
              modelContent: [question],
              toolCalls: [],
              sources: [],
            },
            {
              role: 'assistant',
              displayText: turn.text,
              modelContent: turn.messages,
              toolCalls: turn.toolCalls,
              sources: turn.sources,
              route: turn.route,
            },
          ],
          {
            now,
            expiresAt: expiresAtFor(conversation.ownerUserId !== null, now),
            pageContext: input.pagePath ?? null,
          },
        );
        spent.messageId = ids[1] ?? null;
      } catch (error) {
        if (error instanceof ConversationBusyError) {
          throw new ConflictException({ code: 'conversation_busy', message: error.message });
        }
        throw error;
      }

      const stored = { ...conversation, expiresAt: expiresAtFor(conversation.ownerUserId !== null, now) };
      return {
        conversation: await this.view(stored, await this.conversations.listMessages(conversation.id)),
        newAnonToken,
      };
    } finally {
      await this.usage.recordTurn({
        calls: metered,
        route: spent.route,
        // An answer that was never stored (an error, a busy conversation) is a
        // failed turn, whatever the model managed before it.
        outcome: spent.messageId !== null ? spent.outcome : 'failed',
        modelCalls: stats.modelCalls,
        modelToolCalls: stats.modelToolCalls,
        tools: spent.tools,
        durationMs: this.clock() - startedAt,
        conversationId: spent.conversationId,
        messageId: spent.messageId,
        userId: holder.kind === 'user' ? holder.userId : null,
        surface: input.surface,
        callerRole: callerRoleOf(holder, input.surface, context),
        now,
      });
    }
  }

  /**
   * The tool loop. Within one turn every model response is kept whole and in
   * order (D-a); across turns nothing is replayed (D-r). Tool results are
   * redacted before they are appended (D-g).
   */
  private async runTurn(
    messages: ModelMessage[],
    caller: ToolCaller,
    metered: MeteredCall[],
    stats: CallStats,
    /** What the answer's figures may come from besides tool results: the question. */
    evidence: string[],
    /** What the router gathered for this question; counts as this turn's data. */
    gathered: Gathered[] = [],
  ): Promise<{
    messages: ModelMessage[];
    text: string;
    sources: AssistantSource[];
    toolCalls: ToolCallRecord[];
    outcome: TurnOutcome;
  }> {
    const produced: ModelMessage[] = [];
    let ended: TurnOutcome | null = null;
    const available = new Map<string, AssistantSource>();
    const toolCalls: ToolCallRecord[] = [];
    // Gathered results are this turn's data: citable (D-i) and evidence for
    // the figure check (D-v), exactly as a tool the model called would be.
    for (const { tool, outcome } of gathered) {
      for (const source of outcome.sources) available.set(source.id, source);
      evidence.push(outcome.content);
      const guideId = tool === 'get_task_guide' ? guideAnswer(outcome.content)?.guideId : undefined;
      toolCalls.push({ name: tool, ok: true, ...(guideId ? { guideId } : {}) });
    }
    const tools = this.tools.offered(caller);
    let lastContent: ModelBlock[] = [];
    let text: string | null = null;
    const deadline = this.clock() + TURN_BUDGET_MS;

    for (let call = 0; call < MAX_MODEL_CALLS_PER_TURN; call++) {
      // Out of time for another call: answer with what we have, never late.
      if (deadline - this.clock() < MIN_CALL_BUDGET_MS) {
        ended = 'out_of_time';
        break;
      }
      stats.modelCalls += 1;
      let response;
      try {
        // The last call a turn may make cannot ask for a tool (D-x): a turn
        // at the ceiling still ends with an answer worded from what it has.
        const last = call === MAX_MODEL_CALLS_PER_TURN - 1;
        response = await this.model.createTurn(
          { system: ASSISTANT_SYSTEM_PROMPT, tools, messages: [...messages, ...produced], ...(last ? { toolChoice: 'none' as const } : {}) },
          { deadline },
        );
      } catch (error) {
        if (error instanceof ModelUnavailableError) this.logger.warn(`Assistant model unavailable: ${error.message}`);
        throw error;
      }

      if (response.usage) metered.push({ model: response.model, usage: response.usage });
      produced.push({ role: 'assistant', content: response.content });
      lastContent = response.content;

      if (response.stopReason === 'refusal') {
        text = REFUSAL_REPLY;
        ended = 'refused';
        break;
      }
      if (response.stopReason === 'pause_turn') continue;
      if (response.stopReason === 'max_tokens') {
        // Stopped at ASSISTANT_MAX_OUTPUT_TOKENS (D-y): counted, so the
        // ceiling is tuned on evidence.
        ended = 'truncated';
        break;
      }
      if (response.stopReason !== 'tool_use') break;

      const uses = response.content.filter(isToolUse);
      if (uses.length === 0) break;
      stats.modelToolCalls += uses.length;
      // Nothing runs after the last allowed call: no later call could read the
      // result, and a tool may prepare a proposal nobody would be shown.
      if (call === MAX_MODEL_CALLS_PER_TURN - 1) {
        ended = 'step_limit';
        break;
      }
      // Every tool_result for one response goes back in ONE user message.
      const results: ModelBlock[] = [];
      for (const use of uses) {
        const outcome = await this.tools.run(use.name, use.input, caller);
        const guideId = use.name === 'get_task_guide' && !outcome.isError ? guideAnswer(outcome.content)?.guideId : undefined;
        toolCalls.push({
          name: use.name,
          ok: !outcome.isError,
          ...(outcome.proposalIds?.length ? { proposalIds: outcome.proposalIds } : {}),
          ...(outcome.escalation ? { escalationTopic: outcome.escalation.topic } : {}),
          ...(guideId ? { guideId } : {}),
        });
        for (const source of outcome.sources) available.set(source.id, source);
        evidence.push(outcome.content);
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: outcome.content,
          ...(outcome.isError ? { is_error: true } : {}),
        });
      }
      produced.push({ role: 'user', content: results });
    }

    const lastIsAnswer = produced.at(-1)?.role === 'assistant';
    // Still asking for a tool after the last allowed call: the ceiling.
    if (ended === null && (!lastIsAnswer || lastContent.some(isToolUse))) ended = 'step_limit';
    const raw = text ?? (lastIsAnswer ? textOf(lastContent) : '');
    const { clean, cited } = extractCitations(raw || INCOMPLETE_REPLY, available);
    // Figure checks (D-v): a money amount or date the model states must be in
    // this turn's tool results or the person's own question. If one is not,
    // the answer is withheld; its checked sources stay.
    if (text === null && raw) {
      const unconfirmed = unconfirmedFigures(clean, evidence);
      if (unconfirmed.length > 0) {
        this.logger.warn(`Assistant answer withheld: ${unconfirmed.length} figure(s) not in this turn's data`);
        return { messages: produced, text: UNCONFIRMED_FIGURE, sources: cited, toolCalls, outcome: 'withheld' };
      }
    }
    return { messages: produced, text: clean, sources: cited, toolCalls, outcome: ended ?? 'answered' };
  }

  /** A fallback answer (D-u), stored like a router answer. */
  private async fallbackTurn(question: string, caller: ToolCaller, reason: FallbackReason): Promise<StoredTurn> {
    const decision = await this.router.fallback(question, caller, reason);
    return directTurn(decision.text, decision.available, decision.toolCalls, decision.route);
  }

  private async find(
    holder: ConversationHolder,
    surface: AssistantSurface,
    now: Date,
  ): Promise<ConversationRow | null> {
    if (holder.kind === 'user') {
      return this.conversations.findCurrentForUser(holder.userId, surface, now);
    }
    if (!holder.tokenHash) return null;
    const row = await this.conversations.findCurrentForAnon(holder.tokenHash, now);
    return row && row.surface === surface ? row : null;
  }

  private async view(row: ConversationRow, messages: MessageRow[]): Promise<AssistantConversation> {
    // The approval cards are drawn from the stored proposals, in their state
    // NOW (proposed, executed, expired...), never from what the model said.
    const ids = messages.flatMap((m) => m.toolCalls.flatMap((t) => t.proposalIds ?? []));
    const proposals = new Map((await this.proposals.listByIds(ids)).map((p) => [p.id, p]));
    const now = new Date(this.clock());
    const feedback = await this.conversations.feedbackFor(messages.filter((m) => m.role === 'assistant').map((m) => m.id));
    const userTurns = messages.filter((m) => m.role === 'user').length;
    return {
      id: row.id,
      surface: row.surface,
      anonymous: row.ownerUserId === null,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.displayText,
        sources: m.sources,
        proposals: m.toolCalls
          .flatMap((t) => t.proposalIds ?? [])
          .map((id) => proposals.get(id))
          .filter((p): p is ProposalRow => p !== undefined)
          .map((p) => presentProposal(p, now)),
        escalation: escalationOf(m),
        helpful: feedback.get(m.id) ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      turnsLeft: Math.max(0, ASSISTANT_TURN_LIMIT - userTurns),
      expiresAt: row.expiresAt.toISOString(),
    };
  }
}

/** The support topic an answer offered, if it offered human support (D-l). */
function escalationOf(m: MessageRow): { topic: SupportTopic } | null {
  const topic = m.toolCalls.find((t) => t.escalationTopic)?.escalationTopic;
  return topic ? { topic } : null;
}

/**
 * The ticket text staff read in the moderation desk (D-l): what the person
 * asked, where they were, what the assistant tried and what it prepared, in
 * plain lines, capped like any support message. It stays inside Injishi, so
 * it keeps the person's own words.
 */
export function escalationMessage(context: EscalationContext): string {
  const lines = [
    'Sent from the Injishi support assistant.',
    context.page ? `Page: ${context.page}` : null,
    'What the person asked:',
    ...context.questions.map((q) => `- ${q}`),
    context.toolsUsed.length > 0 ? `What the assistant checked: ${context.toolsUsed.join(', ')}` : 'The assistant checked nothing.',
    ...context.proposals.map((p) => `Prepared change: ${p}`),
  ].filter((l): l is string => l !== null);
  return lines.join('\n').slice(0, SUPPORT_MESSAGE_MAX);
}

export interface EscalationContext {
  page: string | null;
  questions: string[];
  toolsUsed: string[];
  proposals: string[];
}

/**
 * A turn the router answered without the model (D-q). Its citations are
 * checked against the sources the router's tool returned, exactly as a
 * model's are. The stored model content is the answer as plain text, so a
 * later turn that does reach the model reads a well formed history.
 */
function directTurn(text: string, available: AssistantSource[], toolCalls: ToolCallRecord[], route: string): StoredTurn {
  const { clean, cited } = extractCitations(text, new Map(available.map((source) => [source.id, source])));
  const outcome: TurnOutcome = route.startsWith('fallback:') ? 'fallback' : 'answered';
  return { messages: [{ role: 'assistant', content: [{ type: 'text', text: clean }] }], text: clean, sources: cited, toolCalls, route, outcome };
}

/**
 * Strip `[source:id]` markers from the answer and keep, as sources, only the
 * ids a tool returned in this turn. A model that cites something it was never
 * given gets no link for it (D-i).
 */
export function extractCitations(
  text: string,
  available: Map<string, AssistantSource>,
): { clean: string; cited: AssistantSource[] } {
  const cited = new Map<string, AssistantSource>();
  for (const match of text.matchAll(SOURCE_MARKER)) {
    const source = available.get(match[1].toLowerCase());
    if (source) cited.set(source.id, source);
  }
  return { clean: text.replace(SOURCE_MARKER, '').trim(), cited: [...cited.values()] };
}

/**
 * Who asked, as the usage report groups it (D-s). A label for the report
 * only: it grants nothing, and the tools check every grant themselves.
 * `staff` is a signed in caller on the admin console's surface.
 */
function callerRoleOf(holder: ConversationHolder, surface: AssistantSurface, context: TurnContext): CallerRole {
  if (holder.kind === 'anon') return 'anonymous';
  if (context.workspace) return 'operator';
  if (surface === 'admin') return 'staff';
  return 'signed_in';
}
