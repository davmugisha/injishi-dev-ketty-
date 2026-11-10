import { SendLeaseMessageFields, type LeaseMessage, type PlacementThreadList, type PlacementThreadView } from '@injishi/contracts';
import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { PlacementMessagesService } from '../../../../modules/rentals/application/placement-messages.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { UserThrottlerGuard } from '../../../../shared/http/user-throttler.guard';
import type { FileReply } from '../pay-runs.controller';
import { MESSAGE_FORM_LIMITS, sendMessageFile } from './messages.controller';
import { normaliseFormFields, parseFields, readForm, type FormRequest } from './multipart-form';

/**
 * The landlord's conversations with brokers → /api/v1/ops/rentals/placement-messages
 * (2026-10-26). One per placement, made the first time either side opens it.
 * Every route is `lease.manage` or `message.send`, as the Brokers screen is; a
 * placement on another business's unit, or outside the reader's buildings,
 * is 404. The unread count is in `/ops/rentals/messages/unread`, with the
 * tenants' lines, so the sidebar shows one number. Marketplace's, with the
 * rest of the broker network (ADR-076 slice G).
 */
@Controller({ path: 'ops/rentals/placement-messages', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('marketplace')
export class OpsPlacementMessagesController {
  constructor(private readonly messages: PlacementMessagesService) {}

  @Get()
  @RequireAnyPermission('lease.manage', 'message.send')
  list(@CurrentWorkspace() ws: ScopedWorkspace, @CurrentUser() user: SessionUser): Promise<PlacementThreadList> {
    return this.messages.landlordList(ws, user.id);
  }

  @Get(':placementId')
  @RequireAnyPermission('lease.manage', 'message.send')
  thread(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('placementId', ParseUUIDPipe) placementId: string,
    @Query('before') before?: string,
  ): Promise<PlacementThreadView> {
    return this.messages.landlordThread(ws, user.id, placementId, typeof before === 'string' ? before : undefined);
  }

  @Post(':placementId')
  @HttpCode(200)
  @RequireAnyPermission('lease.manage', 'message.send')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 40, ttl: 60_000 } })
  async send(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('placementId', ParseUUIDPipe) placementId: string,
    @Req() request: FormRequest,
  ): Promise<LeaseMessage> {
    const form = await readForm(request, MESSAGE_FORM_LIMITS);
    const fields = parseFields(SendLeaseMessageFields, normaliseFormFields(form.fields, ['voiceDurationS']));
    return this.messages.landlordSend(ws, user.id, placementId, fields, form.files.map((f) => ({ filename: f.filename, mime: f.mime, body: f.body })));
  }

  @Post(':placementId/read')
  @HttpCode(200)
  @RequireAnyPermission('lease.manage', 'message.send')
  read(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('placementId', ParseUUIDPipe) placementId: string,
  ): Promise<{ readAt: string | null }> {
    return this.messages.landlordRead(ws, user.id, placementId);
  }

  @Get(':placementId/files/:id')
  @RequireAnyPermission('lease.manage', 'message.send')
  async file(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @Param('placementId', ParseUUIDPipe) placementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    sendMessageFile(reply, await this.messages.landlordFile(ws, placementId, id));
  }
}
