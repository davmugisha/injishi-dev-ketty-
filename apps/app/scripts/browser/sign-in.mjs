#!/usr/bin/env node
/**
 * One sign-in for web and the app, walked in a real browser:
 *   - a signed-out visitor opening a private page on WEB (/trips) is handed to the app's sign-in, carrying
 *     where they were going;
 *   - the sign-in screen offers nothing a production visitor cannot use (no "demo" Google note);
 *   - the address never rides in the url, and the code step needs the code the API mailed (read from
 *     Mailpit, or the demo's fixed code, filled in);
 *   - they land back on web's /trips, signed in, holding the API's own httpOnly session cookie and no
 *     `ij_session`;
 *   - the app accepts that same session, and signing out on web signs them out of the app too;
 *   - a hostile `?next=` is dropped before it reaches the form.
 *
 *   APP_URL=http://localhost:3002 WEB_URL=http://localhost:3000 INJISHI_API_URL=http://localhost:8000 \
 *     pnpm --filter @injishi/app exec tsx scripts/browser/sign-in.mjs
 *
 * Needs web, the app and the API running, web and the app built with each other's NEXT_PUBLIC_* urls.
 * Prints "BROWSER SIGN-IN OK" only when every step held.
 */
import { homeHref, personas } from "@injishi/data";
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3002").replace(/\/$/, "");
const WEB = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API = (process.env.INJISHI_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const MAILPIT = (process.env.MAILPIT_URL ?? "http://localhost:8025").replace(/\/$/, "");
const EMAIL = personas.guest.email;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

/** The newest sign-in code Mailpit holds for an address, sent after `since`. */
async function mailedCode(address, since) {
  const end = Date.now() + 30_000;
  while (Date.now() < end) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)).json();
    const fresh = (list.messages ?? []).find((m) => new Date(m.Created).getTime() >= since);
    if (fresh) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json();
      const code = String(message.Text ?? "").match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await sleep(500);
  }
  throw new Error(`no sign-in code reached Mailpit for ${address}`);
}

async function waitForUrl(page, test, what, timeout = 90_000) {
  const end = Date.now() + timeout;
  let last = "";
  while (Date.now() < end) {
    last = await page.url().catch(() => last);
    if (test(last)) return last;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}; the browser is on ${last}`);
}

const platform = await (await fetch(`${API}/api/v1/platform`)).json();
const demo = platform.environment === "demo";
const { page, close } = await launch();
try {
  // 1. A private page on web hands a signed-out visitor to the app's sign-in, carrying the way back.
  await page.goto(`${WEB}/trips`);
  const signIn = await waitForUrl(page, (u) => u.startsWith(`${APP}/sign-in`), "the app's sign-in");
  check(new URL(signIn).searchParams.get("redirect") === "/trips", `web did not say where to come back to: ${signIn}`);
  await page.waitForText("Welcome to Injishi");
  const screen = await page.text();
  check(!screen.includes("in the demo yet"), "the sign-in screen still says Google is missing from the demo");
  check(
    platform.googleSignIn ? !screen.includes("coming soon") : screen.includes("Sign in with Google is coming soon"),
    "the Google button does not match what the API offers",
  );
  check(demo === screen.includes("Explore the demo"), "the persona list shows where it must not, or hides on the demo");

  // 2. The code step: no address in the url, and the code the API issued.
  const sentAt = Date.now() - 1_000;
  await page.type('input[type="email"]', EMAIL);
  await page.press("Continue");
  const verify = await waitForUrl(page, (u) => u.startsWith(`${APP}/verify`), "the code step");
  check(!decodeURIComponent(verify).includes("@"), `the email address rides in the url: ${verify}`);
  await page.waitForText("Check your email");
  if (!demo) {
    const code = await mailedCode(EMAIL, sentAt);
    await page.type('input[autocomplete="one-time-code"]', code);
  }
  await page.press("Verify and continue");

  // 3. Back on web's page, signed in: web's own gate let them through.
  await waitForUrl(page, (u) => u === `${WEB}/trips`, "web's /trips after sign-in");
  await sleep(3_000);
  check((await page.url()) === `${WEB}/trips`, `web bounced the signed-in person again: ${await page.url()}`);
  const cookies = await page.cookies();
  const session = cookies.find((c) => c.name.endsWith(".session_token"));
  check(session, `the browser holds no Better Auth session: ${cookies.map((c) => c.name)}`);
  check(session.httpOnly, "the session cookie is readable by page scripts");
  check(!cookies.some((c) => c.name === "ij_session"), "the old app-only ij_session cookie was set");
  console.log(`  web: signed in on /trips with ${session.name} (httpOnly, ${session.domain})`);

  // 4. The app accepts the very same session.
  const home = homeHref("guest");
  await page.goto(`${APP}${home}`);
  await sleep(2_000);
  check(!(await page.url()).includes("/sign-in"), `the app sent a signed-in person to sign in: ${await page.url()}`);
  console.log(`  app: ${home} opens with the same session`);

  // 5. Signing out on web (what web's sign-out sends) signs them out of the app as well.
  await page.goto(`${WEB}/`);
  const out = await page.eval(
    `fetch(${JSON.stringify(`${API}/api/auth/sign-out`)}, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: "{}" }).then((r) => r.status)`,
  );
  check(out === 200, `web's sign-out answered ${out}`);
  await page.goto(`${APP}${home}`);
  await waitForUrl(page, (u) => u.startsWith(`${APP}/sign-in`), "the app's sign-in after signing out on web");
  console.log("  sign-out on web: the app asks for sign-in again");

  // 6. A hostile return target is dropped before it reaches the form.
  await page.goto(`${APP}/sign-in?next=${encodeURIComponent("/\\evil.example")}`);
  await page.waitForText("Welcome to Injishi");
  const carried = await page.eval(`document.querySelector('input[name="next"]')?.value ?? null`);
  check(carried === "", `a hostile next= reached the form: ${JSON.stringify(carried)}`);

  console.log(`BROWSER SIGN-IN OK (${demo ? "demo" : "production"} API)`);
} finally {
  await close();
}
