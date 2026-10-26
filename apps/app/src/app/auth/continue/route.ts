import { type NextRequest, NextResponse } from "next/server";
import { APP_URL, destinationAfterSignIn, safeReturn, WEB_URL } from "@/lib/return-to";
import { ApiError } from "@/server/api";
import { type Account, accountFor } from "@/server/auth";
import { sessionCookieHeader } from "@/server/session-cookies";

/**
 * Where Google sends a person back: the `callbackURL` the Google button hands the API.
 *
 * By the time the browser lands here the API has set the session cookie itself, on the domain every app
 * reads, so there is nothing to forward. What is left is where to go:
 *
 *  1. No session: Google did not finish. Back to sign-in, saying so.
 *  2. The emailed step-up is owed (F-S02). A Google session is not stepped up when it opens, and the API
 *     refuses an operator's workspace calls until it is. Web already has that screen, and it comes back
 *     here once the code is in, so this asks again with the step-up done.
 *  3. Otherwise the same destination an email-code sign-in reaches.
 *
 * Absolute urls built on `APP_URL`, the app's public origin: behind the edge, the url this request
 * arrived on can name the container rather than the host the browser knows.
 */
export async function GET(request: NextRequest) {
  const next = safeReturn(request.nextUrl.searchParams.get("next"));
  const toSignIn = (error: string) => {
    const params = new URLSearchParams({ error });
    if (next) params.set("next", next);
    return NextResponse.redirect(new URL(`/sign-in?${params.toString()}`, APP_URL));
  };

  const cookie = sessionCookieHeader(request.cookies.getAll());
  if (!cookie) return toSignIn("google");

  let account: Account | null;
  try {
    account = await accountFor(cookie);
  } catch (error) {
    if (error instanceof ApiError && error.unauthenticated) return toSignIn("google");
    return toSignIn("unreachable");
  }
  if (!account) return toSignIn("google");

  if (account.twoFactor.required && !account.twoFactor.verified) {
    const self = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, APP_URL).toString();
    return NextResponse.redirect(`${WEB_URL}/two-factor/verify?${new URLSearchParams({ redirect: self }).toString()}`);
  }

  return NextResponse.redirect(new URL(destinationAfterSignIn(account.persona.id, next, account.user.email, account.persona.home), APP_URL));
}
