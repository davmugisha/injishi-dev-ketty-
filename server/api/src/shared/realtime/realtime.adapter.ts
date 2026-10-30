import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/** Where the socket listens: under `/api`, so a proxy that forwards the API forwards it too (contracts `REALTIME_PATH`). */
export const REALTIME_PATH = '/api/realtime';

/**
 * Socket.IO on the API's own port (rentals P3.4, ported from feat/rentals),
 * with the same origin list as HTTP CORS: never every origin, because the
 * socket rides the session cookie.
 */
export class RealtimeAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      path: REALTIME_PATH,
      cors: { origin: this.origins, credentials: true },
    }) as Server;
  }
}
