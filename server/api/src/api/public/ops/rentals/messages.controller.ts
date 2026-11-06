import {
  LEASE_MESSAGE_FILE_MAX_BYTES,
  LEASE_MESSAGE_FILES_MAX,
  SendLeaseMessageFields,
  type LeaseMessage,
  type LeaseThreadList,
  type LeaseThreadView,
  type MessageUnread,
} from '@injishi/contracts';
import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { LeaseMessagesService } from '../../../../modules/rentals/application/lease-messages.service';
import { PlacementMessagesService } from '../../../../modules/rentals/application/placement-messages.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { UserThrottlerGuard } from '../../../../shared/http/user-throttler.guard';
import type { FileReply } from '../pay-runs.controller';
import { normaliseFormFields, parseFields, readForm, type FormRequest } from './multipart-form';

/** A message's files: up to ten, each held to its kind's size by the service; this is the outer ceiling. */
export const MESSAGE_FORM_LIMITS = { maxFiles: LEASE_MESSAGE_FILES_MAX, maxBytes: LEASE_MESSAGE_FILE_MAX_BYTES, what: 'A file' } as const;

/** How a stored file is handed back: inline for what a browser shows, a download for the rest. */
export function sendMessageFile(reply: FileReply, file: { body: Buffer; mime: string; filename: string }): void {
  const inline = file.mime.startsWith('image/') || file.mime.startsWith('audio/') || file.mime === 'application/pdf';
  const ascii = file.filename.replace(/[^\x20-\x7e]/g, '_');
  reply
    .header('content-type', file.mime)
    .header('content-disposition', `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
    // A message's files never change: the reader's browser may keep them.
    .header('cache-control', 'private, max-age=86400')
    .header('x-content-type-options', 'nosniff')
    .send(file.body);
}

/**
 * Messages with tenants → /api/v1/ops/rentals/messages (P3.4, blueprint 2.3).
 * Residence businesses only, every route `message.send`: the owner, and any
 * team member the owner lets answer messages. One conversation per lease,
 * named by the lease; a lease outside the reader's buildings is 404.
 *
 * A message is multipart/form-data (`body`, `voiceDurationS` and up to ten
 * `files`), or JSON with text only. No Idempotency-Key, as everywhere on
 * messages: a repeated line is visible and fixable, a swallowed one is not.
 */
@Controller({ path: 'ops/rentals/messages', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('residence')
export class OpsLeaseMessagesController {
  constructor(
    private readonly messages: LeaseMessagesService,
    private readonly placements: PlacementMessagesService,
  ) {}

  @Get()
  @RequirePermission('message.send')
  list(@CurrentWorkspace() ws: ScopedWorkspace, @CurrentUser() user: SessionUser, @Query('q') q?: string): Promise<LeaseThreadList> {
    return this.messages.landlordList(ws, user.id, typeof q === 'string' ? q.slice(0, 120) : undefined);
  }

  /** Unread lines from tenants and from brokers (2026-10-26), for the sidebar: one number. */
  @Get('unread')
  @RequirePermission('message.send')
  async unread(@CurrentWorkspace() ws: ScopedWorkspace, @CurrentUser() user: SessionUser): Promise<MessageUnread> {
    const [leases, placements] = await Promise.all([this.messages.landlordUnread(ws, user.id), this.placements.landlordUnread(ws, user.id)]);
    return { total: leases.total + placements.total, byLease: leases.byLease, byPlacement: placements.byPlacement };
  }

  @Get(':leaseId')
  @RequirePermission('message.send')
  thread(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('leaseId', ParseUUIDPipe) leaseId: string,
    @Query('before') before?: string,
  ): Promise<LeaseThreadView> {
    return this.messages.landlordThread(ws, user.id, leaseId, typeof before === 'string' ? before : undefined);
  }

  @Post(':leaseId')
  @HttpCode(200)
  @RequirePermission('message.send')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 40, ttl: 60_000 } })
  async send(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('leaseId', ParseUUIDPipe) leaseId: string,
    @Req() request: FormRequest,
  ): Promise<LeaseMessage> {
    const form = await readForm(request, MESSAGE_FORM_LIMITS);
    const fields = parseFields(SendLeaseMessageFields, normaliseFormFields(form.fields, ['voiceDurationS']));
    return this.messages.landlordSend(ws, user.id, leaseId, fields, form.files.map((f) => ({ filename: f.filename, mime: f.mime, body: f.body })));
  }

  /** The reader has seen the conversation up to now. */
  @Post(':leaseId/read')
  @HttpCode(200)
  @RequirePermission('message.send')
  read(@CurrentWorkspace() ws: ScopedWorkspace, @CurrentUser() user: SessionUser, @Param('leaseId', ParseUUIDPipe) leaseId: string): Promise<{ readAt: string | null }> {
    return this.messages.landlordRead(ws, user.id, leaseId);
  }

  @Get(':leaseId/files/:id')
  @RequirePermission('message.send')
  async file(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @Param('leaseId', ParseUUIDPipe) leaseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    sendMessageFile(reply, await this.messages.landlordFile(ws, leaseId, id));
  }
}
