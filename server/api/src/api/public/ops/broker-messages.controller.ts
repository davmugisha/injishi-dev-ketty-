import {
  SendLeaseMessageFields,
  type LeaseMessage,
  type MessageUnread,
  type PlacementThreadList,
  type PlacementThreadView,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { PlacementMessagesService } from '../../../modules/rentals/application/placement-messages.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import type { FileReply } from './pay-runs.controller';
import { MESSAGE_FORM_LIMITS, sendMessageFile } from './rentals/messages.controller';
import { normaliseFormFields, parseFields, readForm, type FormRequest } from './rentals/multipart-form';

/**
 * The broker's conversations with landlords → /api/v1/ops/broker/messages
 * (2026-10-26), one per placement. Like every `/ops/broker` route, none
 * declares a permission (a broker workspace holds none, see
 * `OpsBrokerController`): the service refuses a workspace that is not a
 * broker's own (403) and a placement that is not this broker's (404).
 */
@Controller({ path: 'ops/broker/messages', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsBrokerMessagesController {
  constructor(private readonly messages: PlacementMessagesService) {}

  @Get()
  list(@CurrentWorkspace() ws: WorkspaceAccess, @CurrentUser() user: SessionUser): Promise<PlacementThreadList> {
    return this.messages.brokerList(ws, user.id);
  }

  /** Unread lines from landlords, for the sidebar. Declared before `:placementId`. */
  @Get('unread')
  unread(@CurrentWorkspace() ws: WorkspaceAccess, @CurrentUser() user: SessionUser): Promise<MessageUnread> {
    return this.messages.brokerUnread(ws, user.id);
  }

  @Get(':placementId')
  thread(
    @CurrentWorkspace() ws: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
    @Param('placementId', ParseUUIDPipe) placementId: string,
    @Query('before') before?: string,
  ): Promise<PlacementThreadView> {
    return this.messages.brokerThread(ws, user.id, placementId, typeof before === 'string' ? before : undefined);
  }

  @Post(':placementId')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 40, ttl: 60_000 } })
  async send(
    @CurrentWorkspace() ws: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
    @Param('placementId', ParseUUIDPipe) placementId: string,
    @Req() request: FormRequest,
  ): Promise<LeaseMessage> {
    const form = await readForm(request, MESSAGE_FORM_LIMITS);
    const fields = parseFields(SendLeaseMessageFields, normaliseFormFields(form.fields, ['voiceDurationS']));
    return this.messages.brokerSend(ws, user.id, placementId, fields, form.files.map((f) => ({ filename: f.filename, mime: f.mime, body: f.body })));
  }

  @Post(':placementId/read')
  @HttpCode(200)
  read(
    @CurrentWorkspace() ws: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
    @Param('placementId', ParseUUIDPipe) placementId: string,
  ): Promise<{ readAt: string | null }> {
    return this.messages.brokerRead(ws, user.id, placementId);
  }

  @Get(':placementId/files/:id')
  async file(
    @CurrentWorkspace() ws: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
    @Param('placementId', ParseUUIDPipe) placementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    sendMessageFile(reply, await this.messages.brokerFile(ws, user.id, placementId, id));
  }
}
