import { ANONYMOUS_RETENTION_DAYS } from '../../../modules/assistant/domain/retention';

/**
 * The anonymous conversation cookie (ADR-061 D-c).
 *
 * `HttpOnly` so no script on the page can read a conversation that may hold a
 * stranger's words; `SameSite=Lax`, which the web app's cross origin but same
 * site calls to the API still carry; `Secure` everywhere but a laptop; scoped
 * to the assistant's own routes so it rides on nothing else. It lives as long
 * as an anonymous conversation may.
 */
export const ASSISTANT_COOKIE = 'injishi_assistant';

export interface AssistantCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
}

/** What the token readers need from a request. */
export interface AssistantTokenRequest {
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}

function header(req: AssistantTokenRequest, name: string): string | undefined {
  const raw = req.headers?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() || undefined;
}

/** The mobile app, which has no cookie jar and names itself (D-c). */
export function isNativeAssistantClient(req: AssistantTokenRequest): boolean {
  return header(req, 'x-assistant-client') === 'native';
}

/**
 * The anonymous token: the `x-assistant-token` header for a native client,
 * the cookie for everyone else, never both. A native request never reads the
 * cookie, so a page script that sends the native header cannot use it to lift
 * the `HttpOnly` value into a body it can read. The controller and the
 * throttler both read it here, so a conversation is one conversation to both.
 */
export function assistantTokenOf(req: AssistantTokenRequest): string | undefined {
  return isNativeAssistantClient(req) ? header(req, 'x-assistant-token') : req.cookies?.[ASSISTANT_COOKIE];
}

export function assistantCookieOptions(secure: boolean): AssistantCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/api/v1/assistant',
    maxAge: ANONYMOUS_RETENTION_DAYS * 24 * 60 * 60,
  };
}
