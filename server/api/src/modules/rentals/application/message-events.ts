import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/** The rooms a lease conversation's events reach. */
export const threadRoom = (threadId: string): string => `thread:${threadId}`;
export const workspaceRoom = (workspaceId: string): string => `ws:${workspaceId}`;
export const userRoom = (userId: string): string => `user:${userId}`;

/** Who an event is for: the open conversation, the landlord's team, and the tenant's devices. */
export interface ThreadAudience {
  leaseId: string;
  threadId: string;
  workspaceId: string;
  tenantUserId: string | null;
}

/** Who a broker conversation's event is for: the open conversation, the landlord's team, the broker's devices. */
export interface PlacementAudience {
  placementId: string;
  threadId: string;
  workspaceId: string;
  brokerUserId: string;
}

/**
 * Tells open screens a lease conversation moved (rentals P3.4, ported from
 * feat/rentals' MessagingEvents). An event carries ids and nothing else: a
 * screen that hears it reads the conversation over HTTP, through the same
 * checks as ever, so the socket never carries a message a reader could not
 * already fetch.
 *
 *   message:new   a line was written: the open conversation re-reads, the
 *                 sidebars of both sides re-count their unread
 *   thread:read   someone read it: the other side's ticks turn to read
 *
 * Fire and forget. With no socket server (the worker, a test) it does
 * nothing; the screens poll slowly as a fallback.
 */
@Injectable()
export class MessageEvents {
  private server: Server | null = null;

  attach(server: Server): void {
    this.server = server;
  }

  messageNew(to: ThreadAudience): void {
    if (!this.server) return;
    const payload = { leaseId: to.leaseId, threadId: to.threadId };
    let room = this.server.to(threadRoom(to.threadId)).to(workspaceRoom(to.workspaceId));
    if (to.tenantUserId) room = room.to(userRoom(to.tenantUserId));
    room.emit('message:new', payload);
  }

  threadRead(to: ThreadAudience): void {
    if (!this.server) return;
    this.server.to(threadRoom(to.threadId)).emit('thread:read', { leaseId: to.leaseId, threadId: to.threadId });
  }

  /** The same two events for a broker conversation (2026-10-26), named by its placement. */
  placementMessageNew(to: PlacementAudience): void {
    if (!this.server) return;
    this.server
      .to(threadRoom(to.threadId))
      .to(workspaceRoom(to.workspaceId))
      .to(userRoom(to.brokerUserId))
      .emit('message:new', { placementId: to.placementId, threadId: to.threadId });
  }

  placementThreadRead(to: PlacementAudience): void {
    if (!this.server) return;
    this.server.to(threadRoom(to.threadId)).emit('thread:read', { placementId: to.placementId, threadId: to.threadId });
  }
}
