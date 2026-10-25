import {
  LEASE_MESSAGE_PAGE,
  messageFileKind,
  messageFilesProblem,
  messagePreview,
  type LeaseMessage,
  type LeaseMessageAttachment,
  type LeaseThreadList,
  type LeaseThreadSummary,
  type LeaseThreadView,
  type MessageUnread,
  type SendLeaseMessageFields,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { MessageFilesStorage, cleanName, type StoredMessageFile } from '../../storage/application/message-files-storage';
import {
  THREAD_CLOSED,
  bodyTypeFor,
  decodeMessageCursor,
  encodeMessageCursor,
  leaseThreadWritable,
  otherSideRead,
  receiptFor,
  senderSide,
} from '../domain/lease-messages';
import { assertResidence, buildingFilter, coversBuilding } from '../domain/residence';
import {
  LeaseMessagesRepository,
  type LeaseAttachmentRow,
  type LeaseMessageRow,
  type LeaseThreadContext,
} from '../infrastructure/lease-messages.repository';
import type { DbOrTx } from '../infrastructure/rentals-writers';
import { MessageEvents, type ThreadAudience } from './message-events';
import type { TenancyRef } from './tenancies.service';

/** A file as a route received it. */
export interface MessageUpload {
  filename: string;
  mime: string;
  body: Buffer;
}

/** Who is reading: the landlord's side in a business, or the tenant. */
type Viewer = { side: 'landlord'; userId: string; ws: ScopedWorkspace } | { side: 'tenant'; userId: string; tenancy: TenancyRef };

export const THREAD_NOT_FOUND = "We couldn't find that conversation.";

/** A file the route hands to a reader. */
export interface MessageFile {
  body: Buffer;
  mime: string;
  filename: string;
}

/**
 * Messages between a landlord and a tenant (rentals P3.4, blueprint 1.2,
 * 2.3, 3.5): one conversation per lease, text, photos, documents and voice
 * notes, read receipts both ways, unread counts for the sidebars, and the
 * live line to open screens.
 *
 * Who may read and write: on the landlord's side, a member of the residence
 * business with `message.send` (the route checks it) whose buildings cover
 * the lease's; on the tenant's side, the lease's own tenant (`TenancyGuard`).
 * Anyone else is told the conversation is not there (404), never "forbidden".
 */
@Injectable()
export class LeaseMessagesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repo: LeaseMessagesRepository,
    private readonly files: MessageFilesStorage,
    private readonly events: MessageEvents,
  ) {}

  // --- The landlord's side -------------------------------------------------

  /** Every lease conversation in the buildings the reader covers, the newest activity first. */
  async landlordList(ws: ScopedWorkspace, userId: string, q?: string): Promise<LeaseThreadList> {
    const r = assertResidence(ws);
    const leases = await this.repo.landlordLeases(r.workspaceId, buildingFilter(sql`l.property_id`, ws.branchScope));
    return this.list(leases, { side: 'landlord', userId, ws }, q);
  }

  async landlordThread(ws: ScopedWorkspace, userId: string, leaseId: string, before?: string): Promise<LeaseThreadView> {
    const ctx = await this.landlordLease(ws, leaseId);
    return this.view(ctx, { side: 'landlord', userId, ws }, before);
  }

  async landlordSend(ws: ScopedWorkspace, userId: string, leaseId: string, fields: SendLeaseMessageFields, uploads: MessageUpload[]): Promise<LeaseMessage> {
    const ctx = await this.landlordLease(ws, leaseId);
    return this.send(ctx, { side: 'landlord', userId, ws }, fields, uploads);
  }

  async landlordRead(ws: ScopedWorkspace, userId: string, leaseId: string): Promise<{ readAt: string | null }> {
    const ctx = await this.landlordLease(ws, leaseId);
    return this.read(ctx, userId);
  }

  async landlordFile(ws: ScopedWorkspace, leaseId: string, attachmentId: string): Promise<MessageFile> {
    return this.file(await this.landlordLease(ws, leaseId), attachmentId);
  }

  async landlordUnread(ws: ScopedWorkspace, userId: string): Promise<MessageUnread> {
    const r = assertResidence(ws);
    const leases = await this.repo.landlordLeases(r.workspaceId, buildingFilter(sql`l.property_id`, ws.branchScope));
    return this.unread(leases, userId, 'landlord');
  }

  // --- The tenant's side ---------------------------------------------------

  async tenantThread(ref: TenancyRef, before?: string): Promise<LeaseThreadView> {
    return this.view(await this.tenantLease(ref), { side: 'tenant', userId: ref.userId, tenancy: ref }, before);
  }

  async tenantSend(ref: TenancyRef, fields: SendLeaseMessageFields, uploads: MessageUpload[]): Promise<LeaseMessage> {
    return this.send(await this.tenantLease(ref), { side: 'tenant', userId: ref.userId, tenancy: ref }, fields, uploads);
  }

  async tenantRead(ref: TenancyRef): Promise<{ readAt: string | null }> {
    return this.read(await this.tenantLease(ref), ref.userId);
  }

  async tenantFile(ref: TenancyRef, attachmentId: string): Promise<MessageFile> {
    return this.file(await this.tenantLease(ref), attachmentId);
  }

  /** The person's tenancies' conversations, for their sidebar (and the list when they rent more than one home). */
  async tenantList(userId: string): Promise<LeaseThreadList> {
    const leases = await this.repo.tenantLeases(userId);
    // A viewer for list purposes: the tenancy is per row and only its user matters here.
    return this.list(leases, { side: 'tenant', userId, tenancy: { leaseId: '', tenantId: '', userId, workspaceId: '' } });
  }

  async tenantUnread(userId: string): Promise<MessageUnread> {
    return this.unread(await this.repo.tenantLeases(userId), userId, 'tenant');
  }

  // --- Faults in the conversation -------------------------------------------

  /**
   * A fault's report or a reply on it, as a line in the lease's conversation,
   * written inside the fault's own transaction. The fault's timeline stays
   * the record and the fault's emails carry it, so this line never starts a
   * message digest. Answers who to tell once the transaction commits.
   */
  async faultLine(
    tx: DbOrTx,
    input: { leaseId: string; ticketId: string; senderUserId: string; body: string },
  ): Promise<ThreadAudience | null> {
    const ctx = await this.repo.context(input.leaseId, tx);
    if (!ctx || ctx.status === 'draft') return null;
    const threadId = await this.repo.ensureThread(tx, ctx);
    await this.repo.insertMessage(tx, {
      threadId,
      senderUserId: input.senderUserId,
      bodyType: 'text',
      body: input.body.slice(0, 4000),
      maintenanceTicketId: input.ticketId,
    });
    return { leaseId: ctx.leaseId, threadId, workspaceId: ctx.workspaceId, tenantUserId: ctx.tenantUserId };
  }

  /** Tell open screens, after the transaction that wrote the line committed. */
  announce(to: ThreadAudience | null): void {
    if (to) this.events.messageNew(to);
  }

  /** The conversation is made when the lease is signed, so both sides find it waiting. */
  async ensureForLease(tx: DbOrTx, leaseId: string): Promise<void> {
    const ctx = await this.repo.context(leaseId, tx);
    if (ctx && ctx.status !== 'draft' && ctx.status !== 'cancelled') await this.repo.ensureThread(tx, ctx);
  }

  /** Whether a person may hear a lease conversation's live events (the gateway's check). */
  async mayListen(userId: string, leaseId: string, landlord: { workspaceId: string } | null): Promise<ThreadAudience | null> {
    const ctx = await this.repo.context(leaseId);
    if (!ctx || ctx.status === 'draft' || !ctx.threadId) return null;
    const audience = { leaseId: ctx.leaseId, threadId: ctx.threadId, workspaceId: ctx.workspaceId, tenantUserId: ctx.tenantUserId };
    if (landlord) return ctx.workspaceId === landlord.workspaceId ? audience : null;
    return ctx.tenantUserId === userId ? audience : null;
  }

  // --- Inside --------------------------------------------------------------

  private async landlordLease(ws: ScopedWorkspace, leaseId: string): Promise<LeaseThreadContext> {
    const r = assertResidence(ws);
    const ctx = await this.repo.context(leaseId);
    if (!ctx || ctx.workspaceId !== r.workspaceId || ctx.status === 'draft' || !coversBuilding(ws.branchScope, ctx.propertyId)) {
      throw new NotFoundException(THREAD_NOT_FOUND);
    }
    return ctx;
  }

  private async tenantLease(ref: TenancyRef): Promise<LeaseThreadContext> {
    const ctx = await this.repo.context(ref.leaseId);
    if (!ctx || ctx.tenantUserId !== ref.userId || ctx.status === 'draft') throw new NotFoundException(THREAD_NOT_FOUND);
    return ctx;
  }

  private async list(leases: LeaseThreadContext[], viewer: Viewer, q?: string): Promise<LeaseThreadList> {
    const needle = q?.trim().toLowerCase() ?? '';
    const shown = needle
      ? leases.filter((l) =>
          [l.tenantName, l.unitLabel, l.propertyName, l.reference, l.landlordName].some((v) => v?.toLowerCase().includes(needle)),
        )
      : leases;
    const withThread = shown.filter((l) => l.threadId) as (LeaseThreadContext & { threadId: string })[];
    const summaries = await this.repo.summaries(
      withThread.map((l) => ({ threadId: l.threadId, tenantUserId: l.tenantUserId })),
      { userId: viewer.userId, side: viewer.side },
    );
    const threads: LeaseThreadSummary[] = shown.map((l) => {
      const s = l.threadId ? summaries.get(l.threadId) : undefined;
      const lastSide = s?.lastSenderUserId !== undefined ? senderSide(s.lastSenderUserId ?? null, s.lastBodyType ?? 'text', l.tenantUserId) : null;
      return {
        leaseId: l.leaseId,
        threadId: l.threadId,
        reference: l.reference,
        leaseStatus: l.status,
        unitLabel: l.unitLabel,
        propertyName: l.propertyName,
        counterpartName: viewer.side === 'landlord' ? l.tenantName : l.landlordName,
        lastMessageAt: s?.lastMessageAt?.toISOString() ?? null,
        lastMessagePreview: s?.lastMessageAt
          ? messagePreview({
              body: s.lastBody,
              bodyType: s.lastBodyType ?? 'text',
              attachments: s.lastKinds.map((k) => ({ kind: k as 'image' | 'file' | 'audio' })),
              voiceDurationS: s.lastVoiceS,
            })
          : null,
        lastMessageFromMe: lastSide === viewer.side,
        unreadCount: s?.unread ?? 0,
        writable: leaseThreadWritable(l.status),
      };
    });
    // Newest activity first; conversations with nothing yet after them, live leases first.
    threads.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return Number(b.writable) - Number(a.writable);
    });
    return { threads, unreadTotal: threads.reduce((n, t) => n + t.unreadCount, 0) };
  }

  private async unread(leases: LeaseThreadContext[], userId: string, side: 'landlord' | 'tenant'): Promise<MessageUnread> {
    const withThread = leases.filter((l) => l.threadId) as (LeaseThreadContext & { threadId: string })[];
    const summaries = await this.repo.summaries(
      withThread.map((l) => ({ threadId: l.threadId, tenantUserId: l.tenantUserId })),
      { userId, side },
    );
    const byLease: Record<string, number> = {};
    let total = 0;
    for (const l of withThread) {
      const n = summaries.get(l.threadId)?.unread ?? 0;
      if (n > 0) byLease[l.leaseId] = n;
      total += n;
    }
    return { total, byLease };
  }

  private async view(ctx: LeaseThreadContext, viewer: Viewer, before?: string): Promise<LeaseThreadView> {
    const base: Omit<LeaseThreadView, 'messages' | 'olderCursor' | 'myLastReadAt' | 'otherLastReadAt'> = {
      leaseId: ctx.leaseId,
      threadId: ctx.threadId,
      reference: ctx.reference,
      leaseStatus: ctx.status,
      unitLabel: ctx.unitLabel,
      propertyName: ctx.propertyName,
      counterpartName: viewer.side === 'landlord' ? ctx.tenantName : ctx.landlordName,
      writable: leaseThreadWritable(ctx.status),
    };
    if (!ctx.threadId) return { ...base, messages: [], olderCursor: null, myLastReadAt: null, otherLastReadAt: null };
    const [rows, reads] = await Promise.all([
      this.repo.page(ctx.threadId, LEASE_MESSAGE_PAGE, decodeMessageCursor(before)),
      this.repo.reads(ctx.threadId),
    ]);
    const hasOlder = rows.length > LEASE_MESSAGE_PAGE;
    const window = (hasOlder ? rows.slice(0, LEASE_MESSAGE_PAGE) : rows).reverse();
    const oldest = window[0];
    const other = otherSideRead(reads, viewer.side, ctx.tenantUserId);
    const mine = reads.find((r) => r.userId === viewer.userId)?.lastReadAt ?? null;
    const attachments = await this.repo.attachments(window.map((m) => m.id));
    return {
      ...base,
      messages: window.map((m) => this.present(ctx, viewer, m, attachments.filter((a) => a.messageId === m.id), other)),
      olderCursor: hasOlder && oldest ? encodeMessageCursor(oldest.createdAt, oldest.id) : null,
      myLastReadAt: mine?.toISOString() ?? null,
      otherLastReadAt: other?.toISOString() ?? null,
    };
  }

  private async send(ctx: LeaseThreadContext, viewer: Viewer, fields: SendLeaseMessageFields, uploads: MessageUpload[]): Promise<LeaseMessage> {
    if (!leaseThreadWritable(ctx.status)) throw new ConflictException(THREAD_CLOSED);
    const body = fields.body?.trim() || null;
    if (!body && uploads.length === 0) throw new BadRequestException('Write something or attach a file before you send it.');
    const problem = messageFilesProblem(
      uploads.map((u) => ({ mime: u.mime, sizeBytes: u.body.byteLength, name: cleanName(u.filename) })),
      fields.voiceDurationS ?? null,
    );
    if (problem) throw new BadRequestException(problem);
    if (fields.voiceDurationS && !uploads.some((u) => messageFileKind(u.mime) === 'audio')) {
      throw new BadRequestException('A voice note needs its recording.');
    }
    const stored: StoredMessageFile[] = [];
    for (const u of uploads) {
      stored.push(await this.files.put({ ...u, uploadedByUserId: viewer.userId, workspaceId: ctx.workspaceId }));
    }
    const kinds = stored.map((f) => f.kind);
    const isVoice = kinds.includes('audio');
    const written = await this.db.transaction(async (tx) => {
      const threadId = await this.repo.ensureThread(tx, ctx);
      const message = await this.repo.insertMessage(tx, {
        threadId,
        senderUserId: viewer.userId,
        bodyType: bodyTypeFor(kinds),
        body,
        voiceDurationS: isVoice ? (fields.voiceDurationS ?? null) : null,
        files: stored.map((f) => ({ storedObjectId: f.id, filename: f.filename })),
      });
      return { threadId, message };
    });
    // Writing is reading: the sender has seen everything up to their own line.
    await this.repo.markRead(written.threadId, viewer.userId);
    const audience = { leaseId: ctx.leaseId, threadId: written.threadId, workspaceId: ctx.workspaceId, tenantUserId: ctx.tenantUserId };
    this.events.messageNew(audience);
    const withThread = { ...ctx, threadId: written.threadId };
    const [row] = (await this.repo.page(written.threadId, 1)).filter((m) => m.id === written.message.id);
    const reads = await this.repo.reads(written.threadId);
    const files = await this.repo.attachments([written.message.id]);
    if (!row) throw new BadRequestException('That message could not be sent. Try again.');
    return this.present(withThread, viewer, row, files, otherSideRead(reads, viewer.side, ctx.tenantUserId));
  }

  private async read(ctx: LeaseThreadContext, userId: string): Promise<{ readAt: string | null }> {
    if (!ctx.threadId) return { readAt: null };
    const at = await this.repo.markRead(ctx.threadId, userId);
    this.events.threadRead({ leaseId: ctx.leaseId, threadId: ctx.threadId, workspaceId: ctx.workspaceId, tenantUserId: ctx.tenantUserId });
    return { readAt: at.toISOString() };
  }

  private async file(ctx: LeaseThreadContext, attachmentId: string): Promise<MessageFile> {
    if (!ctx.threadId) throw new NotFoundException('That file was not found.');
    const row = await this.repo.attachment(ctx.threadId, attachmentId);
    if (!row) throw new NotFoundException('That file was not found.');
    return { body: await this.files.read(row.objectKey), mime: row.mime, filename: row.filename ?? 'file' };
  }

  /** The path a reader opens a file at; the app serves it from its own origin. */
  private fileUrl(viewer: Viewer, leaseId: string, attachmentId: string): string {
    return viewer.side === 'landlord'
      ? `/api/v1/ops/rentals/messages/${leaseId}/files/${attachmentId}`
      : `/api/v1/me/tenancies/${leaseId}/messages/files/${attachmentId}`;
  }

  private present(
    ctx: LeaseThreadContext,
    viewer: Viewer,
    m: LeaseMessageRow,
    files: LeaseAttachmentRow[],
    otherReadAt: Date | null,
  ): LeaseMessage {
    const side = senderSide(m.senderUserId, m.bodyType, ctx.tenantUserId);
    const ours = side === viewer.side;
    const attachments: LeaseMessageAttachment[] = files.map((a) => ({
      id: a.id,
      kind: messageFileKind(a.mime) ?? 'file',
      url: this.fileUrl(viewer, ctx.leaseId, a.id),
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      filename: a.filename,
    }));
    return {
      id: m.id,
      side,
      senderName: side === 'tenant' ? ctx.tenantName : side === 'landlord' ? (viewer.side === 'tenant' ? ctx.landlordName : (m.senderName || ctx.landlordName)) : null,
      fromMe: ours,
      bodyType: m.bodyType,
      body: m.body,
      attachments,
      voiceDurationS: m.voiceDurationS,
      fault: m.faultId ? { id: m.faultId, reference: m.faultReference, title: m.faultTitle ?? 'Fault', status: m.faultStatus ?? 'open' } : null,
      createdAt: m.createdAt.toISOString(),
      receipt: ours ? receiptFor(m.createdAt, otherReadAt) : null,
    };
  }
}
