import {
  AssistantSurface,
  type AssistantCurrentConversation,
  AssistantFeedbackInput,
  type AssistantFeedbackResult,
  type AssistantProposalResult,
  ClaimAssistantConversationInput,
  type ClaimAssistantConversationResult,
  SendAssistantEscalationInput,
  type SendAssistantEscalationResult,
  SendAssistantMessageInput,
  type SendAssistantMessageResult,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { ActionApprovalService } from '../../../modules/assistant/application/action-approval.service';
import {
  AssistantService,
  type ConversationHolder,
  type TurnContext,
} from '../../../modules/assistant/application/assistant.service';
import { hashFromCookie } from '../../../modules/assistant/domain/anon-token';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { isProduction } from '../../../shared/config/security.config';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import { isPreLaunchHost } from '../../../shared/pre-launch/pre-launch.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import {
  OptionalSessionGuard,
  OptionalUser,
} from '../support/optional-session.guard';
import { SupportThrottlerGuard } from '../support/support-throttler.guard';
import {
  ASSISTANT_COOKIE,
  type AssistantCookieOptions,
  assistantCookieOptions,
  assistantTokenOf,
  isNativeAssistantClient,
} from './assistant-cookie';
import { AssistantThrottlerGuard } from './assistant-throttler.guard';
import { OperatorScopeResolver } from './operator-scope';

const CurrentConversationQuery = z.object({ surface: AssistantSurface }).strict();
type CurrentConversationQuery = z.infer<typeof CurrentConversationQuery>;

interface RawRequest {
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  session?: { id?: string };
}

interface RawReply {
  setCookie(name: string, value: string, options: AssistantCookieOptions): unknown;
  clearCookie(name: string, options: { path: string }): unknown;
}

/**
 * The support assistant (ADR-061), `/api/v1/assistant/*`.
 *
 * Anonymous by design, like the support intake. The asker is the session when
 * there is one, otherwise the anonymous conversation cookie (the
 * `x-assistant-token` header from the mobile app); none of them can come
 * from the body, which the contract parses `.strict()`.
 *
 * - `SendAssistantMessage` runs `AssistantThrottlerGuard` FIRST, so a flood is
 *   refused before it costs a session lookup, a read or a model call.
 * - A signed in caller's conversation is found by user id and the anonymous
 *   cookie is ignored, except by the claim route, which attaches it once.
 * - A conversation that is not the caller's is simply not found: there is no
 *   route here that takes a conversation id, so there is nothing to probe.
 */
@Controller({ path: 'assistant', version: '1' })
export class AssistantController {
  private readonly secureCookie: boolean;

  constructor(
    private readonly assistant: AssistantService,
    private readonly operatorScope: OperatorScopeResolver,
    private readonly approvals: ActionApprovalService,
    config: ConfigService,
  ) {
    this.secureCookie = isProduction(config.get<string>('NODE_ENV'));
  }

  /**
   * What the request knows that the tools need: the pre launch host rule and,
   * for an operator, the workspace resolved in WorkspaceGuard's order (ADR-061
   * D-f). One place, so opening, claiming and asking all see the same caller.
   */
  private async contextFor(user: SessionUser | null, req: RawRequest): Promise<TurnContext> {
    const scope = await this.operatorScope.resolve({
      userId: user?.id ?? null,
      sessionId: req.session?.id ?? null,
      workspaceId: headerOf(req, 'x-workspace-id'),
      branchHeader: req.headers?.['x-branch-id'],
    });
    return { ...contextOf(req), ...scope };
  }

  /** The caller's current conversation on a surface, and whether the assistant is on. */
  @Get('conversations/current')
  @UseGuards(OptionalSessionGuard)
  async current(
    @Query(new ZodValidationPipe(CurrentConversationQuery))
    query: CurrentConversationQuery,
    @OptionalUser() user: SessionUser | null,
    @Req() req: RawRequest,
  ): Promise<AssistantCurrentConversation> {
    if (!this.assistant.enabled) return { enabled: false, conversation: null, claimable: false, greeting: '', suggestions: [] };
    const holder = holderOf(user, req);
    // The same caller a question would be answered as, operator scope
    // included, so the suggestions offer only what this person may ask.
    const context = await this.contextFor(user, req);
    const now = new Date();
    const [conversation, claimable, opening] = await Promise.all([
      this.assistant.current(holder, query.surface, now, context),
      user
        ? this.assistant.claimable(hashFromCookie(assistantTokenOf(req)), query.surface)
        : Promise.resolve(false),
      this.assistant.opening(holder, query.surface, context, now),
    ]);
    return { enabled: true, conversation, claimable, ...opening };
  }

  /**
   * Approve a change the assistant prepared (ADR-061 D-k). The PERSON's own
   * request: `WorkspaceGuard` re-checks the step up, the membership, the
   * branch scope and `listing.manage`, the permission the Inventory screen's
   * price field needs, before anything runs. An `Idempotency-Key` is required,
   * so a retried press acts once. 409 `proposal_stale`, `proposal_expired` or
   * `proposal_closed` when it can no longer run; 404 when it is not yours.
   */
  @Post('actions/:id/approve')
  @HttpCode(200)
  @UseGuards(SessionGuard, WorkspaceGuard)
  @RequirePermission('listing.manage')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @IdempotencyKey() key: string,
  ): Promise<AssistantProposalResult> {
    return { proposal: await this.approvals.approve(workspace, user.id, id, key) };
  }

  /** Reject a prepared change. Nothing runs; the proposal closes. */
  @Post('actions/:id/reject')
  @HttpCode(200)
  @UseGuards(SessionGuard, WorkspaceGuard)
  @RequirePermission('listing.manage')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<AssistantProposalResult> {
    return { proposal: await this.approvals.reject(workspace, user.id, id) };
  }

  /**
   * Send the current conversation to Injishi support (ADR-061 D-l). The
   * person's own request, behind the support intake's own throttle (per
   * client and per mailbox, the mailbox read from `email` as there). Signed
   * out, `email` is required; signed in, the account's address is used.
   */
  @Post('escalations')
  @HttpCode(201)
  @UseGuards(SupportThrottlerGuard, OptionalSessionGuard)
  async escalate(
    @Body(new ZodValidationPipe(SendAssistantEscalationInput))
    body: SendAssistantEscalationInput,
    @OptionalUser() user: SessionUser | null,
    @Req() req: RawRequest,
  ): Promise<SendAssistantEscalationResult> {
    return this.assistant.escalate(holderOf(user, req), body, { email: user?.email ?? null });
  }

  /** Mark one answer helpful or not (ADR-061 D-m). 404 unless it is yours. */
  @Post('messages/:id/feedback')
  @HttpCode(200)
  @UseGuards(OptionalSessionGuard)
  async feedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AssistantFeedbackInput)) body: AssistantFeedbackInput,
    @OptionalUser() user: SessionUser | null,
    @Req() req: RawRequest,
  ): Promise<AssistantFeedbackResult> {
    return this.assistant.feedback(holderOf(user, req), id, body.helpful);
  }

  /**
   * Attach the caller's anonymous conversation to their account (ADR-061
   * D-e). Needs a session. The anonymous cookie is cleared whatever the
   * outcome: once signed in it opens nothing, and leaving it would let the
   * next person on a shared device claim what is left behind.
   */
  @Post('conversations/claim')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async claim(
    @Body(new ZodValidationPipe(ClaimAssistantConversationInput))
    body: ClaimAssistantConversationInput,
    @CurrentUser() user: SessionUser,
    @Req() req: RawRequest,
    @Res({ passthrough: true }) reply: RawReply,
  ): Promise<ClaimAssistantConversationResult> {
    const token = assistantTokenOf(req);
    const result = await this.assistant.claim(
      user.id,
      hashFromCookie(token),
      body.surface,
      new Date(),
      body.discard === true,
      await this.contextFor(user, req),
    );
    // A native client keeps its token in the keychain and forgets it itself.
    if (!isNativeAssistantClient(req) && token !== undefined) {
      reply.clearCookie(ASSISTANT_COOKIE, { path: assistantCookieOptions(this.secureCookie).path });
    }
    return result;
  }

  /**
   * Ask a question. 200 with the conversation as it now stands, a fallback
   * answer included when the model is unavailable or its budget is spent
   * (ADR-061 D-u; the Phase 1 502 is retired); 503 `assistant_off`, 409
   * `conversation_full` or `conversation_busy`, 429 from the throttler.
   */
  @Post('messages')
  @HttpCode(200)
  @UseGuards(AssistantThrottlerGuard, OptionalSessionGuard)
  async send(
    @Body(new ZodValidationPipe(SendAssistantMessageInput))
    body: SendAssistantMessageInput,
    @OptionalUser() user: SessionUser | null,
    @Req() req: RawRequest,
    @Res({ passthrough: true }) reply: RawReply,
  ): Promise<SendAssistantMessageResult> {
    const holder = holderOf(user, req);
    const result = await this.assistant.send(holder, body, new Date(), await this.contextFor(user, req));
    // A native client is handed the token of a conversation it just started,
    // in the body, and never a cookie (ADR-061 D-c). Its lifetime is the
    // conversation's `expires_at`, which each answer already moves.
    if (isNativeAssistantClient(req)) {
      return result.newAnonToken
        ? { conversation: result.conversation, anonToken: result.newAnonToken }
        : { conversation: result.conversation };
    }
    // A new anonymous conversation gets its cookie. A continued one gets the
    // SAME cookie again, so its lifetime slides with the conversation's
    // `expires_at` instead of running out 7 days after the first message.
    const token =
      result.newAnonToken ??
      (holder.kind === 'anon' && holder.tokenHash ? req.cookies?.[ASSISTANT_COOKIE] : undefined);
    if (token) {
      reply.setCookie(ASSISTANT_COOKIE, token, assistantCookieOptions(this.secureCookie));
    }
    return { conversation: result.conversation };
  }
}

/**
 * The listing tools follow the pre launch rule of `PreLaunchGuard`, read from
 * the same Host header with the same function (ADR-061 D-j).
 */
function contextOf(req: RawRequest): TurnContext {
  const raw = req.headers?.host;
  return { catalogueOpen: !isPreLaunchHost(Array.isArray(raw) ? raw[0] : raw) };
}

function headerOf(req: RawRequest, name: string): string | undefined {
  const raw = req.headers?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() || undefined;
}

function holderOf(user: SessionUser | null, req: RawRequest): ConversationHolder {
  if (user) return { kind: 'user', userId: user.id };
  return { kind: 'anon', tokenHash: hashFromCookie(assistantTokenOf(req)) };
}

