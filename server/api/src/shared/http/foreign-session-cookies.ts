import type { IncomingMessage } from 'node:http';

import { dropForeignSessionCookies } from '@injishi/auth';

/**
 * Remove production's session cookies from a request, in place (ADR-043,
 * AC-14). Only a DEMO process calls this.
 *
 * Production and the demo both set cookies on `.injishi.com`, so a person
 * signed in to production carries that session to every demo host. The demo
 * could never verify it (it holds no production secret), but without this it
 * would log it and hand it to every handler. So the demo drops it as the first
 * thing it does with a request.
 *
 * Both header shapes are rewritten. `headers.cookie` is what Fastify, Better
 * Auth and the request logger read; `rawHeaders` is the untouched list Node
 * keeps beside it, and a library that reads that one instead would otherwise
 * still see the production value.
 */
export function scrubForeignSessionCookies(raw: IncomingMessage): void {
  const header = raw.headers.cookie;
  if (header) {
    const kept = dropForeignSessionCookies(header);
    if (kept) raw.headers.cookie = kept;
    else delete raw.headers.cookie;
  }

  const list = raw.rawHeaders;
  for (let i = list.length - 2; i >= 0; i -= 2) {
    if (list[i]?.toLowerCase() !== 'cookie') continue;
    const kept = dropForeignSessionCookies(list[i + 1]);
    if (kept) list[i + 1] = kept;
    else list.splice(i, 2);
  }
}
