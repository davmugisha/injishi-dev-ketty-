import { SendLeaseMessageFields, type LeaseMessage, type LeaseThreadList, type LeaseThreadView, type MessageUnread } from '@injishi/contracts';
import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { LeaseMessagesService } from '../../../modules/rentals/application/lease-messages.service';
import type { TenancyRef } from '../../../modules/rentals/application/tenancies.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { MESSAGE_FORM_LIMITS, sendMessageFile } from '../ops/rentals/messages.controller';
import { normaliseFormFields, parseFields, readForm, type FormRequest } from '../ops/rentals/multipart-form';
import type { FileReply } from '../ops/pay-runs.controller';
import { CurrentTenancy, TenancyGuard } from './tenancy.guard';

/**
 * The tenant's conversation with their landlord →
 * /api/v1/me/tenancies/:leaseId/messages (P3.4, blueprint 2.4). Session plus
 * `TenancyGuard`: the caller's own lease, 404 for any other. The sidebar's
 * count is `/me/tenancies/messages/unread`, across every home they rent.
 */
@Controller({ path: 'me/tenancies', version: '1' })
@UseGuards(SessionGuard)
export class MeTenancyMessagesController {
  constructor(private readonly messages: LeaseMessagesService) {}

  /** Declared before `:leaseId/...`; "messages" is not a lease id, so the two never meet. */
  @Get('messages')
  list(@CurrentUser() user: SessionUser): Promise<LeaseThreadList> {
    return this.messages.tenantList(user.id);
  }

  @Get('messages/unread')
  unread(@CurrentUser() user: SessionUser): Promise<MessageUnread> {
    return this.messages.tenantUnread(user.id);
  }

  @Get(':leaseId/messages')
  @UseGuards(TenancyGuard)
  thread(@CurrentTenancy() tenancy: TenancyRef, @Query('before') before?: string): Promise<LeaseThreadView> {
    return this.messages.tenantThread(tenancy, typeof before === 'string' ? before : undefined);
  }

  @Post(':leaseId/messages')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 40, ttl: 60_000 } })
  async send(@CurrentTenancy() tenancy: TenancyRef, @Req() request: FormRequest): Promise<LeaseMessage> {
    const form = await readForm(request, MESSAGE_FORM_LIMITS);
    const fields = parseFields(SendLeaseMessageFields, normaliseFormFields(form.fields, ['voiceDurationS']));
    return this.messages.tenantSend(tenancy, fields, form.files.map((f) => ({ filename: f.filename, mime: f.mime, body: f.body })));
  }

  @Post(':leaseId/messages/read')
  @HttpCode(200)
  @UseGuards(TenancyGuard)
  read(@CurrentTenancy() tenancy: TenancyRef): Promise<{ readAt: string | null }> {
    return this.messages.tenantRead(tenancy);
  }

  @Get(':leaseId/messages/files/:id')
  @UseGuards(TenancyGuard)
  async file(@CurrentTenancy() tenancy: TenancyRef, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) reply: FileReply): Promise<void> {
    sendMessageFile(reply, await this.messages.tenantFile(tenancy, id));
  }
}
