import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { AUTH_REGISTRY, type AuthRegistry } from '../../../modules/auth/auth.module';
import { LeaseMessagesService } from '../../../modules/rentals/application/lease-messages.service';
import { MessageEvents, threadRoom, userRoom, workspaceRoom } from '../../../modules/rentals/application/message-events';
import { PlacementMessagesService } from '../../../modules/rentals/application/placement-messages.service';
import { TwoFactorService } from '../../../shared/auth/two-factor.service';
import { WorkspaceService } from '../../../shared/auth/workspace.service';
import { hostFromHeaders, resolveAuthSurface } from '../../../shared/config/auth-surface';

type GetSession = (args: { headers: Headers }) => Promise<{ user?: { id: string }; session?: { id: string } } | null>;

interface SocketData {
  userId?: string;
  sessionId?: string;
  /** Settles once the handshake's session is read; an early event waits on it. */
  ready?: Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toHeaders(raw: Record<string, string | string[] | undefined>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value != null) headers.append(key, String(value));
  }
  return headers;
}

/**
 * The live line to open message screens (rentals P3.4, ported from
 * feat/rentals). A socket is the session's: the Better Auth cookie is read at
 * the handshake, as `SessionGuard` reads it on HTTP, and a socket without one
 * is dropped. Each socket joins its person's room at once (the tenant's
 * sidebar count). A landlord's screen asks to join its business's room, with
 * the membership, second factor and `message.send` checks `WorkspaceGuard`
 * makes; an open conversation asks to join that lease's thread room, which a
 * tenant gets for their own lease and a landlord's reader for a lease of the
 * business they joined. Events carry ids only (`MessageEvents`).
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    // The registry, not the per-request instance: a gateway is built once, so
    // it picks the surface from each handshake's host, as HTTP does per request.
    @Inject(AUTH_REGISTRY) private readonly registry: AuthRegistry,
    private readonly events: MessageEvents,
    private readonly messages: LeaseMessagesService,
    private readonly placements: PlacementMessagesService,
    private readonly workspaces: WorkspaceService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  afterInit(server: Server): void {
    this.events.attach(server);
  }

  handleConnection(client: Socket): Promise<void> {
    // Socket.IO says "connected" before this finishes, so a screen's first
    // event can arrive while the session is still being read. It waits.
    const ready = this.identify(client);
    (client.data as SocketData).ready = ready;
    return ready;
  }

  private async identify(client: Socket): Promise<void> {
    try {
      const auth = this.registry.for(resolveAuthSurface(hostFromHeaders(client.handshake.headers), this.registry.oversightHosts));
      const getSession = auth.api.getSession as unknown as GetSession;
      const session = await getSession({ headers: toHeaders(client.handshake.headers) });
      if (!session?.user?.id) {
        client.disconnect(true);
        return;
      }
      const data = client.data as SocketData;
      data.userId = session.user.id;
      data.sessionId = session.session?.id;
      await client.join(userRoom(session.user.id));
    } catch (error) {
      this.logger.warn(`Socket refused: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  /** A landlord's screen joins its business's room; it leaves any other it was in. */
  @SubscribeMessage('workspace')
  async joinWorkspace(@ConnectedSocket() client: Socket, @MessageBody() body: { workspaceId?: unknown }): Promise<{ ok: boolean }> {
    const data = client.data as SocketData;
    await data.ready;
    const workspaceId = typeof body?.workspaceId === 'string' && UUID.test(body.workspaceId) ? body.workspaceId : null;
    if (!data.userId || !workspaceId || !(await this.answersMessages(data, workspaceId))) return { ok: false };
    for (const room of client.rooms) {
      if (room.startsWith('ws:') && room !== workspaceRoom(workspaceId)) await client.leave(room);
    }
    await client.join(workspaceRoom(workspaceId));
    return { ok: true };
  }

  /**
   * An open conversation joins its thread's room (and leaves the one before):
   * the tenant for their own lease, a landlord's reader for a lease of the
   * business named. No thread yet is `ok: false`; the screen asks again once
   * the first message made one.
   */
  @SubscribeMessage('thread')
  async joinThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { leaseId?: unknown; placementId?: unknown; workspaceId?: unknown },
  ): Promise<{ ok: boolean }> {
    const data = client.data as SocketData;
    await data.ready;
    const leaseId = typeof body?.leaseId === 'string' && UUID.test(body.leaseId) ? body.leaseId : null;
    const placementId = typeof body?.placementId === 'string' && UUID.test(body.placementId) ? body.placementId : null;
    const workspaceId = typeof body?.workspaceId === 'string' && UUID.test(body.workspaceId) ? body.workspaceId : null;
    if (!data.userId || (!leaseId && !placementId)) return { ok: false };
    try {
      // A broker conversation (2026-10-26): the landlord's team as for the Brokers screen, or the placement's own broker.
      const permissions: readonly string[] = placementId ? ['lease.manage', 'message.send'] : ['message.send'];
      if (workspaceId && !(await this.answersMessages(data, workspaceId, permissions))) return { ok: false };
      const landlord = workspaceId ? { workspaceId } : null;
      const audience = placementId
        ? await this.placements.mayListen(data.userId, placementId, landlord)
        : await this.messages.mayListen(data.userId, leaseId as string, landlord);
      if (!audience) return { ok: false };
      for (const room of client.rooms) {
        if (room.startsWith('thread:') && room !== threadRoom(audience.threadId)) await client.leave(room);
      }
      await client.join(threadRoom(audience.threadId));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  private async answersMessages(data: SocketData, workspaceId: string, permissions: readonly string[] = ['message.send']): Promise<boolean> {
    if (!data.userId) return false;
    try {
      if (data.sessionId) await this.twoFactor.assertSatisfied(data.userId, data.sessionId);
      const access = await this.workspaces.resolveForUser(data.userId, workspaceId);
      return Boolean(access?.permissions.some((p) => permissions.includes(p)));
    } catch {
      return false;
    }
  }
}
