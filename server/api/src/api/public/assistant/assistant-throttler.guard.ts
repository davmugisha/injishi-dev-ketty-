import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions } from '@nestjs/throttler';

import { type AssistantTokenRequest, assistantTokenOf } from './assistant-cookie';

/**
 * Rate limits for `POST /api/v1/assistant/messages` (ADR-061 D-n).
 *
 * Every message can cost a model call, and the route takes anonymous callers,
 * so it is limited on two keys at once, like the support intake:
 *
 * - PER CLIENT (address): 60 an hour. Stops one machine from minting fresh
 *   conversations (a new cookie each time) to dodge the second limit. Sixty
 *   rather than ten because a hotel lobby or a campus sits behind one address.
 * - PER CONVERSATION: 30 an hour, keyed by the anonymous token (the cookie, or
 *   the mobile app's `x-assistant-token` header). A person in a real
 *   conversation asks far fewer; a loop on one conversation stops here. A
 *   request with no token is counted against its address.
 *
 * Its own buckets, never `ThrottlerModule.forRoot`, which would throttle every
 * other guarded controller too. The same caveats as the support guard: the
 * address is `req.ip` under `TRUST_PROXY`, and counts live in process memory.
 */
const HOUR_MS = 60 * 60_000;

interface RawRequest extends AssistantTokenRequest {
  ip?: string;
}

function clientOf(req: RawRequest): string {
  return req.ip ?? 'unknown';
}

function conversationOf(req: RawRequest): string {
  const token = assistantTokenOf(req);
  return token ? `conversation:${token.slice(0, 64)}` : `client:${clientOf(req)}`;
}

export const ASSISTANT_CLIENT_LIMIT = 60;
export const ASSISTANT_CONVERSATION_LIMIT = 30;

export const ASSISTANT_THROTTLERS: ThrottlerOptions[] = [
  {
    name: 'assistant-client',
    limit: ASSISTANT_CLIENT_LIMIT,
    ttl: HOUR_MS,
    getTracker: (req) => clientOf(req),
  },
  {
    name: 'assistant-conversation',
    limit: ASSISTANT_CONVERSATION_LIMIT,
    ttl: HOUR_MS,
    getTracker: (req) => conversationOf(req),
  },
];

@Injectable()
export class AssistantThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = ASSISTANT_THROTTLERS;
  }
}
