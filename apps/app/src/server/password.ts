/**
 * A tenant's password (2026-10-23), against the API's Better Auth. Passwords are for tenants only:
 * the API refuses everybody else, and answers an address with no password exactly as it answers an
 * unknown one, so nothing here can tell who holds an account.
 *
 * Every call settles in words from `@injishi/auth/client` (`passwordFailure`), never Better Auth's.
 */

import { PASSWORD_MESSAGES, passwordFailure } from "@injishi/auth/client";
import { ApiError, apiBaseUrl, apiOrigin, apiRequest, clientIpHeaders, type SessionCookie } from "./api";
import { authCookiesFrom, cookieHeaderFor, type ForwardedCookie } from "./session-cookies";

const AUTH = "/api/auth";

export type PasswordResult = { ok: true } | { ok: false; message: string };

/** Whether this person is offered a password (a tenant), and whether one is set. */
export interface PasswordStatus {
  offered: boolean;
  set: boolean;
}

async function post(
  path: string,
  body: unknown,
  opts: { cookie?: SessionCookie | null; clientIp?: string | null; userAgent?: string | null } = {},
): Promise<Response | null> {
  try {
    return await fetch(`${apiBaseUrl()}${AUTH}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        origin: apiOrigin(),
        ...clientIpHeaders(opts.clientIp),
        ...(opts.userAgent ? { "user-agent": opts.userAgent } : {}),
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }
}

async function failure(response: Response | null): Promise<PasswordResult> {
  if (!response) return { ok: false, message: PASSWORD_MESSAGES.failed };
  const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
  return { ok: false, message: passwordFailure({ code: body?.code, status: response.status }) };
}

export type PasswordSignIn =
  | { ok: true; cookie: SessionCookie; setCookies: ForwardedCookie[] }
  | { ok: false; message: string };

/** Sign in with an email and password. A wrong password and an unknown address read the same. */
export async function signInWithPassword(
  email: string,
  password: string,
  clientIp?: string | null,
  userAgent?: string | null,
): Promise<PasswordSignIn> {
  const response = await post(
    "/sign-in/email",
    { email: email.trim().toLowerCase(), password, rememberMe: true },
    { clientIp, userAgent },
  );
  if (!response?.ok) return (await failure(response)) as { ok: false; message: string };
  const setCookies = authCookiesFrom(response);
  const cookie = cookieHeaderFor(setCookies);
  if (!cookie) return { ok: false, message: PASSWORD_MESSAGES.failed };
  return { ok: true, cookie, setCookies };
}

/**
 * Email a password code (forgot, or a tenant's first from their account). The API answers every
 * address the same and mails nothing to somebody who may not hold a password.
 */
export async function sendPasswordCode(email: string, clientIp?: string | null): Promise<PasswordResult> {
  const response = await post("/email-otp/request-password-reset", { email: email.trim().toLowerCase() }, { clientIp });
  return response?.ok ? { ok: true } : failure(response);
}

/** Spend that code on a new password. */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  password: string,
  clientIp?: string | null,
): Promise<PasswordResult> {
  const response = await post(
    "/email-otp/reset-password",
    { email: email.trim().toLowerCase(), otp: code.replace(/\D/g, ""), password },
    { clientIp },
  );
  return response?.ok ? { ok: true } : failure(response);
}

export type PasswordChange = { ok: true; setCookies: ForwardedCookie[] } | { ok: false; message: string };

/** Change a password: needs the current one. With `revokeOtherSessions` every other device is signed out. */
export async function changePassword(
  cookie: SessionCookie,
  currentPassword: string,
  newPassword: string,
  revokeOtherSessions: boolean,
): Promise<PasswordChange> {
  const response = await post("/change-password", { currentPassword, newPassword, revokeOtherSessions }, { cookie });
  if (!response?.ok) return (await failure(response)) as { ok: false; message: string };
  // Signing other devices out replaces this session too: the browser is handed the new cookie.
  return { ok: true, setCookies: authCookiesFrom(response) };
}

/** `GET /api/v1/me/password`. */
export async function passwordStatus(cookie: SessionCookie): Promise<PasswordStatus> {
  return apiRequest<PasswordStatus>(cookie, "/api/v1/me/password");
}

/** `POST /api/v1/me/password`: a tenant's first password, straight after the invitation's code. */
export async function createPassword(cookie: SessionCookie, password: string): Promise<PasswordResult> {
  try {
    await apiRequest(cookie, "/api/v1/me/password", { method: "POST", body: { password } });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status < 500 && error.message) return { ok: false, message: error.message };
    return { ok: false, message: PASSWORD_MESSAGES.failed };
  }
}
