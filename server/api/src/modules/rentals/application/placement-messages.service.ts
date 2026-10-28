import {
  LEASE_MESSAGE_PAGE,
  PLACEMENT_THREAD_CLOSED,
  messageFileKind,
  messagePreview,
  placementThreadWritable,
  type LeaseMessage,
  type LeaseMessageAttachment,
  type MessageSide,
  type PlacementThreadList,
  type PlacementThreadSummary,
  type PlacementThreadView,
  type SendLeaseMessageFields,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { MessageFilesStorage } from '../../storage/application/message-files-storage';
import { decodeMessageCursor, encodeMessageCursor, otherSideRead, receiptFor, senderSide } from '../domain/lease-messages';
import { assertResidence, coversBuilding } from '../domain/residence';
import { LeaseMessagesRepository, type LeaseAttachmentRow, type LeaseMessageRow } from '../infrastructure/lease-messages.repository';
import { PlacementMessagesRepository, type PlacementThreadContext } from '../infrastructure/placement-messages.repository';
import { storeMessageFiles, THREAD_NOT_FOUND, type MessageFile, type MessageUpload } from './lease-messages.service';
import { MessageEvents, type PlacementAudience } from './message-events';

/** Who is reading: the landlord's team in its business, or the broker. */
type Viewer = { side: 'landlord'; userId: string } | { side: 'broker'; userId: string; brokerId: string };

const NOT_A_BROKER = 'This is not a broker workspace.';

/**
 * A broker and a landlord about one placement (2026-10-26): the same lines,
 * files, voice notes, receipts, unread counts, live events and unread emails
 * as a lease conversation, through the same message store
 * (`LeaseMessagesRepository`), file store and events. Only who the two sides
 * are differs: the broker's own account, and the landlord business's team.
 *
 * Who may read and write: the broker whose placement it is, from their broker
 * workspace; on the landlord's side a member of the business the placement's
 * unit is in, with `lease.manage` or `message.send` (the route checks it),
 * whose buildings cover the unit's. Anyone else is told it is not there (404);
 * a workspace that is not a broker's on the broker routes is refused (403). A
 * tenant has no route to it at all.
 */
@Injectable()
export class PlacementMessagesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly messages: LeaseMessagesRepository,
    private readonly repo: PlacementMessagesRepository,
    private readonly files: MessageFilesStorage,
    private readonly events: MessageEvents,
  ) {}

  // --- The landlord's side -------------------------------------------------

  async landlordList(ws: ScopedWorkspace, userId: string): Promise<PlacementThreadList> {
    const r = assertResidence(ws);
    const rows = (await this.repo.forWorkspace(r.workspaceId)).filter((p) => this.covers(ws, p));
    return this.list(rows, { side: 'landlord', userId });
  }

  async landlordThread(ws: ScopedWorkspace, userId: string, placementId: string, before?: string): Promise<PlacementThreadView> {
    return this.view(await this.landlordPlacement(ws, placementId), { side: 'landlord', userId }, before);
  }

  async landlordSend(ws: ScopedWorkspace, userId: string, placementId: string, fields: SendLeaseMessageFields, uploads: MessageUpload[]): Promise<LeaseMessage> {
    return this.send(await this.landlordPlacement(ws, placementId), { side: 'landlord', userId }, fields, uploads);
  }

  async landlordRead(ws: ScopedWorkspace, userId: string, placementId: string): Promise<{ readAt: string | null }> {
    return this.read(await this.landlordPlacement(ws, placementId), userId);
  }

  async landlordFile(ws: ScopedWorkspace, placementId: string, attachmentId: string): Promise<MessageFile> {
    return this.file(await this.landlordPlacement(ws, placementId), attachmentId);
  }

  async landlordUnread(ws: ScopedWorkspace, userId: string): Promise<{ total: number; byPlacement: Record<string, number> }> {
    const r = assertResidence(ws);
    const rows = (await this.repo.forWorkspace(r.workspaceId)).filter((p) => this.covers(ws, p));
    return this.unread(rows, userId, 'landlord');
  }

  // --- The broker's side ---------------------------------------------------

  async brokerList(ws: WorkspaceAccess, userId: string): Promise<PlacementThreadList> {
    const viewer = await this.brokerOf(ws, userId);
    return this.list(await this.repo.forBroker(viewer.brokerId), viewer);
  }

  async brokerThread(ws: WorkspaceAccess, userId: string, placementId: string, before?: string): Promise<PlacementThreadView> {
    const viewer = await this.brokerOf(ws, userId);
    return this.view(await this.brokerPlacement(viewer, placementId), viewer, before);
  }

  async brokerSend(ws: WorkspaceAccess, userId: string, placementId: string, fields: SendLeaseMessageFields, uploads: MessageUpload[]): Promise<LeaseMessage> {
    const viewer = await this.brokerOf(ws, userId);
    const ctx = await this.brokerPlacement(viewer, placementId);
    if (ctx.brokerStatus !== 'active') throw new ForbiddenException('Your broker account is suspended, so you cannot send messages.');
    return this.send(ctx, viewer, fields, uploads);
  }

  async brokerRead(ws: WorkspaceAccess, userId: string, placementId: string): Promise<{ readAt: string | null }> {
    const viewer = await this.brokerOf(ws, userId);
    return this.read(await this.brokerPlacement(viewer, placementId), userId);
  }

  async brokerFile(ws: WorkspaceAccess, userId: string, placementId: string, attachmentId: string): Promise<MessageFile> {
    const viewer = await this.brokerOf(ws, userId);
    return this.file(await this.brokerPlacement(viewer, placementId), attachmentId);
  }

  async brokerUnread(ws: WorkspaceAccess, userId: string): Promise<{ total: number; byLease: Record<string, number>; byPlacement: Record<string, number> }> {
    const viewer = await this.brokerOf(ws, userId);
    return { ...(await this.unread(await this.repo.forBroker(viewer.brokerId), userId, 'broker')), byLease: {} };
  }

  /**
   * Whether a person may hear a broker conversation's live events (the
   * gateway's check). `landlord` is the business the socket proved it may
   * answer for; without it, only the placement's own broker may listen.
   */
  async mayListen(userId: string, placementId: string, landlord: { workspaceId: string } | null): Promise<PlacementAudience | null> {
    const ctx = await this.repo.context(placementId);
    if (!ctx?.threadId) return null;
    const audience = this.audience(ctx, ctx.threadId);
    if (landlord) return ctx.workspaceId === landlord.workspaceId ? audience : null;
    return ctx.brokerUserId === userId ? audience : null;
  }

  // --- Inside --------------------------------------------------------------

  private covers(ws: ScopedWorkspace, p: PlacementThreadContext): boolean {
    return p.propertyId === null ? ws.branchScope.coverage === 'all' : coversBuilding(ws.branchScope, p.propertyId);
  }

  private async landlordPlacement(ws: ScopedWorkspace, placementId: string): Promise<PlacementThreadContext> {
    const r = assertResidence(ws);
    const ctx = await this.repo.context(placementId);
    if (!ctx || ctx.workspaceId !== r.workspaceId || !this.covers(ws, ctx)) throw new NotFoundException(THREAD_NOT_FOUND);
    return ctx;
  }

  private async brokerOf(ws: WorkspaceAccess, userId: string): Promise<Viewer & { side: 'broker' }> {
    if (ws.kind !== 'broker') throw new ForbiddenException(NOT_A_BROKER);
    const broker = await this.repo.brokerOfWorkspace(ws.workspaceId);
    if (!broker || broker.userId !== userId) throw new ForbiddenException(NOT_A_BROKER);
    return { side: 'broker', userId, brokerId: broker.brokerId };
  }

  private async brokerPlacement(viewer: { brokerId: string }, placementId: string): Promise<PlacementThreadContext> {
    const ctx = await this.repo.context(placementId);
    if (!ctx || ctx.brokerId !== viewer.brokerId) throw new NotFoundException(THREAD_NOT_FOUND);
    return ctx;
  }

  private audience(ctx: PlacementThreadContext, threadId: string): PlacementAudience {
    return { placementId: ctx.placementId, threadId, workspaceId: ctx.workspaceId, brokerUserId: ctx.brokerUserId };
  }

  private counterpart(ctx: PlacementThreadContext, viewer: Viewer): string {
    return viewer.side === 'landlord' ? ctx.brokerName : ctx.landlordName;
  }

  private async list(rows: PlacementThreadContext[], viewer: Viewer): Promise<PlacementThreadList> {
    const withThread = rows.filter((p) => p.threadId) as (PlacementThreadContext & { threadId: string })[];
    const summaries = await this.messages.summaries(
      withThread.map((p) => ({ threadId: p.threadId, tenantUserId: p.brokerUserId })),
      { userId: viewer.userId, side: viewer.side },
    );
    // A placement shows once it has a conversation, or while it is open (so "Message" has somewhere to land).
    const shown = rows.filter((p) => p.threadId || placementThreadWritable(p.status));
    const threads: PlacementThreadSummary[] = shown.map((p) => {
      const s = p.threadId ? summaries.get(p.threadId) : undefined;
      const lastSide = s?.lastMessageAt ? this.side(s.lastSenderUserId ?? null, s.lastBodyType ?? 'text', p.brokerUserId) : null;
      return {
        placementId: p.placementId,
        threadId: p.threadId,
        placementStatus: p.status,
        unitLabel: p.unitLabel,
        propertyName: p.propertyName,
        tenantName: p.tenantName,
        counterpartName: this.counterpart(p, viewer),
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
        writable: placementThreadWritable(p.status),
      };
    });
    threads.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return Number(b.writable) - Number(a.writable);
    });
    return { threads, unreadTotal: threads.reduce((n, t) => n + t.unreadCount, 0) };
  }

  private async unread(rows: PlacementThreadContext[], userId: string, side: 'landlord' | 'broker'): Promise<{ total: number; byPlacement: Record<string, number> }> {
    const withThread = rows.filter((p) => p.threadId) as (PlacementThreadContext & { threadId: string })[];
    const summaries = await this.messages.summaries(
      withThread.map((p) => ({ threadId: p.threadId, tenantUserId: p.brokerUserId })),
      { userId, side },
    );
    const byPlacement: Record<string, number> = {};
    let total = 0;
    for (const p of withThread) {
      const n = summaries.get(p.threadId)?.unread ?? 0;
      if (n > 0) byPlacement[p.placementId] = n;
      total += n;
    }
    return { total, byPlacement };
  }

  /**
   * The conversation as this reader opens it. The thread is made here, the
   * first time either side opens "Message" on the placement, so the other
   * side finds it in their list and the live line has a room to join.
   */
  private async view(ctx: PlacementThreadContext, viewer: Viewer, before?: string): Promise<PlacementThreadView> {
    const threadId = ctx.threadId ?? (placementThreadWritable(ctx.status) ? await this.db.transaction((tx) => this.repo.ensureThread(tx, ctx)) : null);
    const base = {
      placementId: ctx.placementId,
      threadId,
      placementStatus: ctx.status,
      unitLabel: ctx.unitLabel,
      propertyName: ctx.propertyName,
      tenantName: ctx.tenantName,
      counterpartName: this.counterpart(ctx, viewer),
      writable: placementThreadWritable(ctx.status),
    };
    if (!threadId) return { ...base, messages: [], olderCursor: null, myLastReadAt: null, otherLastReadAt: null };
    const withThread = { ...ctx, threadId };
    const [rows, reads] = await Promise.all([
      this.messages.page(threadId, LEASE_MESSAGE_PAGE, decodeMessageCursor(before)),
      this.messages.reads(threadId),
    ]);
    const hasOlder = rows.length > LEASE_MESSAGE_PAGE;
    const window = (hasOlder ? rows.slice(0, LEASE_MESSAGE_PAGE) : rows).reverse();
    const oldest = window[0];
    const other = this.otherRead(reads, viewer, ctx);
    const mine = reads.find((r) => r.userId === viewer.userId)?.lastReadAt ?? null;
    const attachments = await this.messages.attachments(window.map((m) => m.id));
    return {
      ...base,
      messages: window.map((m) => this.present(withThread, viewer, m, attachments.filter((a) => a.messageId === m.id), other)),
      olderCursor: hasOlder && oldest ? encodeMessageCursor(oldest.createdAt, oldest.id) : null,
      myLastReadAt: mine?.toISOString() ?? null,
      otherLastReadAt: other?.toISOString() ?? null,
    };
  }

  private async send(ctx: PlacementThreadContext, viewer: Viewer, fields: SendLeaseMessageFields, uploads: MessageUpload[]): Promise<LeaseMessage> {
    if (!placementThreadWritable(ctx.status)) throw new ConflictException(PLACEMENT_THREAD_CLOSED);
    const { body, stored, bodyType, voiceDurationS } = await storeMessageFiles(this.files, fields, uploads, {
      userId: viewer.userId,
      workspaceId: ctx.workspaceId,
    });
    const written = await this.db.transaction(async (tx) => {
      const threadId = await this.repo.ensureThread(tx, ctx);
      const message = await this.messages.insertMessage(tx, {
        threadId,
        senderUserId: viewer.userId,
        bodyType,
        body,
        voiceDurationS,
        files: stored.map((f) => ({ storedObjectId: f.id, filename: f.filename })),
      });
      return { threadId, message };
    });
    await this.messages.markRead(written.threadId, viewer.userId);
    this.events.placementMessageNew(this.audience(ctx, written.threadId));
    const withThread = { ...ctx, threadId: written.threadId };
    const [row] = (await this.messages.page(written.threadId, 1)).filter((m) => m.id === written.message.id);
    if (!row) throw new BadRequestException('That message could not be sent. Try again.');
    const [reads, files] = await Promise.all([this.messages.reads(written.threadId), this.messages.attachments([written.message.id])]);
    return this.present(withThread, viewer, row, files, this.otherRead(reads, viewer, ctx));
  }

  private async read(ctx: PlacementThreadContext, userId: string): Promise<{ readAt: string | null }> {
    if (!ctx.threadId) return { readAt: null };
    const at = await this.messages.markRead(ctx.threadId, userId);
    this.events.placementThreadRead(this.audience(ctx, ctx.threadId));
    return { readAt: at.toISOString() };
  }

  private async file(ctx: PlacementThreadContext, attachmentId: string): Promise<MessageFile> {
    if (!ctx.threadId) throw new NotFoundException('That file was not found.');
    const row = await this.messages.attachment(ctx.threadId, attachmentId);
    if (!row) throw new NotFoundException('That file was not found.');
    return { body: await this.files.read(row.objectKey), mime: row.mime, filename: row.filename ?? 'file' };
  }

  /** The broker is the one-person side, as a tenant is on a lease. */
  private side(senderUserId: string | null, bodyType: string, brokerUserId: string): MessageSide {
    const s = senderSide(senderUserId, bodyType, brokerUserId);
    return s === 'tenant' ? 'broker' : s;
  }

  private otherRead(reads: readonly { userId: string; lastReadAt: Date }[], viewer: Viewer, ctx: PlacementThreadContext): Date | null {
    return otherSideRead(reads, viewer.side === 'broker' ? 'tenant' : 'landlord', ctx.brokerUserId);
  }

  private fileUrl(viewer: Viewer, placementId: string, attachmentId: string): string {
    return viewer.side === 'landlord'
      ? `/api/v1/ops/rentals/placement-messages/${placementId}/files/${attachmentId}`
      : `/api/v1/ops/broker/messages/${placementId}/files/${attachmentId}`;
  }

  private present(
    ctx: PlacementThreadContext & { threadId: string },
    viewer: Viewer,
    m: LeaseMessageRow,
    files: LeaseAttachmentRow[],
    otherReadAt: Date | null,
  ): LeaseMessage {
    const side = this.side(m.senderUserId, m.bodyType, ctx.brokerUserId);
    const ours = side === viewer.side;
    const attachments: LeaseMessageAttachment[] = files.map((a) => ({
      id: a.id,
      kind: messageFileKind(a.mime) ?? 'file',
      url: this.fileUrl(viewer, ctx.placementId, a.id),
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      filename: a.filename,
    }));
    return {
      id: m.id,
      side,
      senderName:
        side === 'broker' ? ctx.brokerName : side === 'landlord' ? (viewer.side === 'broker' ? ctx.landlordName : m.senderName || ctx.landlordName) : null,
      fromMe: ours,
      bodyType: m.bodyType,
      body: m.body,
      attachments,
      voiceDurationS: m.voiceDurationS,
      fault: null,
      createdAt: m.createdAt.toISOString(),
      receipt: ours ? receiptFor(m.createdAt, otherReadAt) : null,
    };
  }
}
