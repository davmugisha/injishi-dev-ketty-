import {
  type OperatorMessage,
  type OperatorMessageList,
  type OperatorThreadList,
  SendMessageRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { MessagingService } from '../../../modules/operations/application/messaging.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Conversations → /api/v1/ops/threads (ADR-012 step 4).
 *
 * One inbox for all three scopes — a booking, a stay, a lease — because the
 * shape is identical and only the noun changes. `threads_scope_exactly_one` in
 * the database makes sure a thread is about exactly one of them, so a reader
 * never has to choose between two subjects.
 */
@Controller({ path: 'ops/threads', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsThreadsController {
  constructor(private readonly messaging: MessagingService) {}

  /**
   * Every conversation on this desk, newest activity first, or one
   * department's. The Inbox leaf, on both navs, is behind `message.send`.
   *
   * `?departmentId=` narrows it (ADR-050 D-q). The filter is not a permission:
   * this answers with the same threads either way, and a staffer who may read
   * the inbox may read all of it. It is how a department FINDS its own
   * conversations — one flat list per workspace made Housekeeping read the
   * restaurant's messages to find its own, and it got worse as the property got
   * busier. Applied in SQL, so it gets faster rather than slower with volume.
   *
   * An unknown department id is an empty list rather than a refusal or,
   * worse, every thread: a filter that silently stops filtering shows a
   * department somebody else's conversations.
   */
  @Get()
  @RequirePermission('message.send')
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Query('departmentId', new ParseUUIDPipe({ optional: true }))
    departmentId?: string,
  ): Promise<OperatorThreadList> {
    return { threads: await this.messaging.listThreads(workspace, departmentId) };
  }

  /** One conversation in full. */
  @Get(':id/messages')
  @RequirePermission('message.send')
  async messages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorMessageList> {
    return {
      messages: await this.messaging.listMessages(workspace, id, user.id),
    };
  }

  /**
   * Send a message.
   *
   * No `Idempotency-Key`, deliberately. A repeated message is visible, cheap
   * and fixable by whoever sent it; a swallowed one is none of those. The key
   * belongs on commands that move money, where a repeat is invisible and
   * permanent.
   */
  @Post(':id/messages')
  @RequirePermission('message.send')
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SendMessageRequest)) body: SendMessageRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorMessage> {
    return this.messaging.sendMessage(workspace, id, body, user.id);
  }
}
