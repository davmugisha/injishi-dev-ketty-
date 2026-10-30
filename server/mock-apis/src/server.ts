import { type Server, createServer } from 'node:http';

import type { MockApisConfig } from './config.ts';
import { registerConsole } from './console/console.ts';
import { HttpError, Router, readBody, send } from './http.ts';
import { advance, notify } from './providers/gtbank.ts';
import { registerGtbank } from './providers/gtbank.ts';
import { registerRra } from './providers/rra.ts';
import { registerSmileId } from './providers/smile-id.ts';
import { Store } from './store.ts';

export interface MockApis {
  server: Server;
  store: Store;
  /** Stops the clock that moves payments along. The server is closed by its owner. */
  stop: () => void;
}

/**
 * Build the server: the store, every provider's routes, the console, and the
 * clock that moves pending payments along and sends their callbacks.
 */
export function buildMockApis(config: MockApisConfig, { quiet = false }: { quiet?: boolean } = {}): MockApis {
  const store = new Store(config.dataDir);
  const router = new Router();
  registerGtbank(router, store, config);
  registerRra(router, store, config);
  registerSmileId(router, store, config);
  registerConsole(router, store, config);

  const server = createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url ?? '/', 'http://mock.invalid');
    const method = (req.method ?? 'GET').toUpperCase();
    let status = 500;
    try {
      const matched = router.match(method, url.pathname);
      if (!matched) {
        status = router.knows(url.pathname) ? 405 : 404;
        send(res, { status, body: { error: status === 405 ? 'method_not_allowed' : 'not_found', path: url.pathname } });
        return;
      }
      const body = await readBody(req);
      const reply = await matched.handler({
        method,
        path: url.pathname,
        query: url.searchParams,
        params: matched.params,
        headers: req.headers,
        body,
      });
      status = reply.status;
      send(res, reply);
    } catch (error) {
      if (error instanceof HttpError) {
        status = error.status;
        send(res, { status: error.status, headers: error.headers, body: error.body });
      } else {
        status = 500;
        console.error(`[mock-apis] ${method} ${url.pathname} failed:`, error);
        send(res, { status: 500, body: { error: 'internal_error' } });
      }
    } finally {
      if (!quiet && !url.pathname.startsWith('/__mock/documents')) {
        console.log(`[mock-apis] ${method} ${url.pathname} ${status} ${Date.now() - started}ms`);
      }
    }
  });

  // The handset nobody is holding: once a second, move every pending payment
  // whose moment has come, and send the callback it asked for.
  const clock = setInterval(() => {
    for (const tx of store.transactions()) {
      if (tx.status === 'pending' || tx.reversesAt) advance(store, tx);
      if (tx.callbackUrl) void notify(tx, config.credentials.gtbank.webhookSecret);
    }
  }, 1_000);
  clock.unref();

  return { server, store, stop: () => clearInterval(clock) };
}
