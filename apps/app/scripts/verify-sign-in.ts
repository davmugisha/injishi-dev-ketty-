/**
 * Every persona signs in through the API with the demo code and resolves to its own interface shell;
 * a wrong code is refused; a forged cookie is nobody. The session the browser is handed is the API's
 * own cookie and reads back as the same person; the visitor's address reaches the API; sign-out ends the
 * session and clears the cookie; a return target never leaves the first-party origins.
 * Prints "SIGN-IN OK <n>" only when all of it holds.
 *
 *   INJISHI_API_URL=http://localhost:8040 pnpm --filter @injishi/app exec tsx scripts/verify-sign-in.ts
 */
import { PERSONA_IDS, personas } from "@injishi/data";
import { fromWebRedirect, safePath, safeReturn, WEB_URL } from "../src/lib/return-to";
import { apiRequest } from "../src/server/api";
import { accountFor, sendSignInCode, signOutOfApi, verifySignInCode } from "../src/server/auth";
import { sessionCookieHeader } from "../src/server/session-cookies";
import { check, cookieFor, demoCode, main } from "./lib/harness";

void main(async () => {
  await demoCode();
  for (const id of PERSONA_IDS) {
    const cookie = await cookieFor(id);
    const account = await accountFor(cookie);
    check(account, `${personas[id].email} signed in but the API does not know the session`);
    check(account.user.email === personas[id].email, `${id}: the session belongs to ${account.user.email}`);
    check(
      account.persona.id === id,
      `${personas[id].email} resolved to the "${account.persona.id}" shell, not "${id}"`,
    );
    console.log(
      `  ${id.padEnd(12)} ${account.user.email} → ${account.persona.id}, ${account.workspaces.length} workspace(s)`,
    );
  }

  // A wrong code is refused (and does not lock the account: the demo allows retries).
  const victim = personas.frontdesk.email;
  const sent = await sendSignInCode(victim);
  check(sent.ok, "could not send a code for the wrong-code check");
  const wrong = await verifySignInCode(victim, "000001");
  check(!wrong.ok && wrong.reason === "wrong-code", `a wrong code was not refused as wrong: ${JSON.stringify(wrong)}`);

  // A cookie the API never issued is nobody.
  const forged = await accountFor("injishi-demo.session_token=forged.signature");
  check(forged === null, "a forged session cookie resolved to an account");

  // The browser is handed the API's own session cookie, and reads back as the same person. Next decodes a
  // cookie's value when it reads it, so the round trip goes through the decoded form, as a page sees it.
  const visitor = "203.0.113.7";
  const guestEmail = personas.guest.email;
  check((await sendSignInCode(guestEmail, visitor)).ok, "could not send a code for the shared-cookie check");
  const signedIn = await verifySignInCode(guestEmail, await demoCode(), visitor);
  check(signedIn.ok, `the shared-cookie sign-in was refused: ${JSON.stringify(signedIn)}`);
  const token = signedIn.setCookies.find((c) => c.name.endsWith(".session_token"));
  check(token, `the API set no session cookie to hand the browser: ${signedIn.setCookies.map((c) => c.name)}`);
  check(token.httpOnly, "the session cookie handed to the browser is readable by scripts");
  const asBrowser = sessionCookieHeader(signedIn.setCookies.map(({ name, value }) => ({ name, value })));
  check(asBrowser, "the cookie the browser holds does not read back as a session");
  const viaBrowser = await accountFor(asBrowser);
  check(viaBrowser?.user.email === guestEmail, "the cookie the browser holds is not the person who signed in");

  // The visitor's address reached the API, so its per-IP limits count the visitor and not this server.
  const session = await apiRequest<{ session?: { ipAddress?: string | null } }>(asBrowser, "/api/auth/get-session");
  check(
    session.session?.ipAddress === visitor,
    `the API recorded ${session.session?.ipAddress ?? "no address"} for the session, not the visitor ${visitor}`,
  );

  // Sign-out ends the session and clears the cookie the browser holds.
  const cleared = await signOutOfApi(asBrowser);
  check(
    cleared.some((c) => c.name === token.name && (c.maxAge === 0 || (c.expires?.getTime() ?? 1) <= Date.now())),
    `sign-out did not clear ${token.name}: ${JSON.stringify(cleared.map((c) => [c.name, c.maxAge]))}`,
  );
  check((await accountFor(asBrowser)) === null, "the session still answers after sign-out");

  // Return targets: web's own pages and this app's screens, nothing else.
  check(
    fromWebRedirect("/claim-org?token=abc") === `${WEB_URL}/claim-org?token=abc`,
    "a web path did not go back to web",
  );
  check(safeReturn("/w/123?tab=1") === "/w/123?tab=1", "an app path was refused");
  for (const hostile of [
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "https://evil.example/x",
    "javascript:alert(1)",
  ]) {
    check(
      safeReturn(hostile) === null && fromWebRedirect(hostile) === null,
      `${JSON.stringify(hostile)} was accepted as a return`,
    );
  }
  check(safePath("/\\evil.example") === null, "a backslash path escaped the origin check");

  return `SIGN-IN OK ${PERSONA_IDS.length}`;
});
