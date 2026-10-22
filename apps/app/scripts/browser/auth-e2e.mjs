#!/usr/bin/env node
/**
 * Sign-in and sign-out in the production shape (`prod-shape.mjs`): https, `www.`, `app.` and `api.` hosts
 * under one parent domain, the API in production mode mailing random codes (read here from Mailpit).
 *
 *   node apps/app/scripts/browser/prod-stack.mjs --build      # in one terminal
 *   node apps/app/scripts/browser/auth-e2e.mjs --flow <name>  # in another; --flow all runs every flow
 *
 * Flows (each prints "AUTH E2E <name> OK" only when every step held):
 *   header-sign-in  web's header "Sign In" → the app's code step → web shows the person signed in, holding
 *                   one httpOnly Secure `__Secure-` session cookie on the parent domain
 *   web-sign-out    web's account menu "Sign out" ends the session on the API, web and the app
 *   app-sign-out    after signing in on the app, the sign-out where a guest lands (web's /trips) and where a
 *                   business owner lands (the workspace's user menu) does the same
 *   register        web's /register email step: a wrong code is refused as a mismatch, the mailed one signs in
 *   return-to       a private web page sends a visitor to sign in and back to that page, signed in
 *   stale-sign-out  a session revoked elsewhere, or one the API can no longer verify, is signed out on the API,
 *                   web and the app, and signing in again works over the dead cookie
 *   sessions        the app's "Sign-in & sessions" lists real sessions and signing one out revokes it
 *
 * Every flow uses fresh addresses and its own visitor address (the edge's CLIENT_IP_HEADER), so the
 * API's per-address and per-IP send budgets stay as production holds them, run after run.
 */
import { randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import { personas } from "@injishi/data";
import { launch } from "../lib/cdp.mjs";
import { API, APP, CERT, CHROMIUM_ARGS, CLIENT_IP_HEADER, COOKIE_DOMAIN, MAILPIT, WEB } from "./prod-shape.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

const agent = new https.Agent({ ca: readFileSync(CERT) });

/** A request from this process (not the browser) through the edge, as another visitor would make it. */
function edgeRequest(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request(
      {
        host: "127.0.0.1",
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        servername: target.hostname,
        agent,
        headers: { host: target.host, ...headers },
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const uniqueEmail = (flow) => `e2e-${flow}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}@example.test`;
const visitorIp = () => `10.${randomInt(1, 254)}.${randomInt(1, 254)}.${randomInt(1, 254)}`;

/** The newest sign-in code Mailpit holds for an address, sent after `since`. */
async function mailedCode(address, since) {
  const end = Date.now() + 45_000;
  while (Date.now() < end) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)).json();
    const fresh = (list.messages ?? [])
      .filter((m) => new Date(m.Created).getTime() >= since)
      .sort((a, b) => new Date(b.Created) - new Date(a.Created))[0];
    if (fresh) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json();
      const code = String(message.Text ?? "").match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await sleep(500);
  }
  throw new Error(`no sign-in code reached Mailpit for ${address}`);
}

async function waitForUrl(page, test, what, timeout = 120_000) {
  const end = Date.now() + timeout;
  let last = "";
  while (Date.now() < end) {
    last = await page.url().catch(() => last);
    if (test(last)) return last;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}; the browser is on ${last}`);
}

/** A browser that is one distinct visitor: its own profile and its own address at the edge. */
async function visitor() {
  const browser = await launch({ args: CHROMIUM_ARGS });
  await browser.page.send("Network.enable");
  await browser.page.send("Network.setExtraHTTPHeaders", { headers: { [CLIENT_IP_HEADER]: visitorIp() } });
  return browser;
}

/** Press the element a selector names, with real pointer events (React Aria and Radix ignore click()). */
async function pressSelector(page, selector, what = selector, timeout = 30_000) {
  const end = Date.now() + timeout;
  let box = null;
  while (Date.now() < end) {
    box = await page.eval(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !e.disabled && e.getAttribute('aria-disabled') !== 'true';
      });
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (box) break;
    await sleep(250);
  }
  if (!box) throw new Error(`no visible, enabled ${what}`);
  await sleep(150);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
  }
}

/**
 * Replace a field's whole value: empty it the way React hears (the native setter, then an input event),
 * then type. Selecting and typing over is not enough: a one-time-code field manages its own selection,
 * and a full field refuses more digits.
 */
async function retype(page, selector, text) {
  const ok = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.focus();
    if (el.value) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  })()`);
  if (!ok) throw new Error(`no element ${selector}`);
  await page.send("Input.insertText", { text });
}

const sessionCookies = async (page) => (await page.cookies()).filter((c) => c.name.endsWith(".session_token"));

/** Who the API says the browser is, asked from web's origin exactly as web's own code asks. */
async function apiUser(page) {
  if (!(await page.url()).startsWith(WEB)) await page.goto(`${WEB}/robots.txt`);
  return page.eval(
    `fetch(${JSON.stringify(`${API}/api/auth/get-session`)}, { credentials: "include" }).then((r) => r.json()).then((b) => b?.user?.email ?? null)`,
  );
}

/** Web's header, once the session lookup settles: the person's account menu, or "Sign In". */
async function webHeader(page) {
  await page.goto(`${WEB}/`);
  await page.waitFor(
    `!!document.querySelector('[aria-label^="Account menu for"]') || [...document.querySelectorAll('header a')].some((a) => a.innerText.trim() === 'Sign In')`,
    "web's header to settle on signed in or signed out",
  );
  const label = await page.eval(
    `document.querySelector('[aria-label^="Account menu for"]')?.getAttribute('aria-label') ?? null`,
  );
  return label ? { signedIn: true, label } : { signedIn: false };
}

/** Whether the app lets this browser into a private screen, or sends it to sign in. */
async function appLetsIn(page, path = "/guest") {
  await page.goto(`${APP}${path}`);
  await sleep(1_500);
  return !(await page.url()).startsWith(`${APP}/sign-in`);
}

/**
 * Type into a field until the page has taken it: a button that enables on a complete value is the sign.
 * Text typed before React hydrates lands in the DOM and never in state, so the button stays disabled.
 */
async function typeUntilAccepted(page, selector, text, buttonLabel) {
  const enabled = `[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === ${JSON.stringify(buttonLabel)} && !b.disabled && b.getAttribute('aria-disabled') !== 'true')`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.waitFor(`!!document.querySelector(${JSON.stringify(selector)})`, selector);
    await retype(page, selector, text);
    const end = Date.now() + 4_000;
    while (Date.now() < end) {
      if (await page.eval(enabled)) return;
      await sleep(200);
    }
  }
  throw new Error(`"${buttonLabel}" never enabled after typing into ${selector}`);
}

/**
 * Wait until React owns the page. Text typed into server-rendered markup before then never reaches
 * component state, and a form submitted then posts whatever the DOM held.
 */
const hydrated = (page) =>
  page.waitFor(
    `[...document.querySelectorAll('button, input')].some((e) => Object.keys(e).some((k) => k.startsWith('__reactProps')))`,
    "the page to hydrate",
  );

/** The app's code step, from its sign-in screen: type the address, then the code the API mailed. */
async function signInOnApp(page, email) {
  await page.waitForText("Welcome to Injishi");
  await hydrated(page);
  const since = Date.now() - 2_000;
  await typeUntilAccepted(page, 'input[type="email"]', email, "Continue");
  await page.press("Continue");
  await waitForUrl(page, (u) => u.startsWith(`${APP}/verify`), "the app's code step");
  await page.waitForText("Check your email");
  await hydrated(page);
  await typeUntilAccepted(
    page,
    'input[autocomplete="one-time-code"]',
    await mailedCode(email, since),
    "Verify and continue",
  );
  await page.press("Verify and continue");
  return waitForUrl(
    page,
    (u) => !u.startsWith(`${APP}/verify`) && !u.startsWith(`${APP}/sign-in`),
    "the page after sign-in",
  );
}

/** The cookie production depends on: one, httpOnly, Secure, `__Secure-`, on the parent domain. */
async function checkSessionCookie(page) {
  const cookies = await sessionCookies(page);
  check(cookies.length === 1, `expected one session cookie, found ${cookies.map((c) => `${c.name}@${c.domain}`)}`);
  const [cookie] = cookies;
  check(cookie.name.startsWith("__Secure-"), `the session cookie is not __Secure- prefixed: ${cookie.name}`);
  check(cookie.domain === COOKIE_DOMAIN, `the session cookie is on ${cookie.domain}, not ${COOKIE_DOMAIN}`);
  check(cookie.httpOnly && cookie.secure, `the session cookie is not httpOnly and Secure: ${JSON.stringify(cookie)}`);
  check(!(await page.cookies()).some((c) => c.name === "ij_session"), "the old app-only ij_session cookie was set");
  return cookie;
}

/** Signed out everywhere: the API, web's header, the app's gate, and the browser's cookie jar. */
async function checkSignedOutEverywhere(page, where) {
  check((await apiUser(page)) === null, `${where}: the API still has a session for this browser`);
  check(!(await webHeader(page)).signedIn, `${where}: web's header still shows the person signed in`);
  check(!(await appLetsIn(page)), `${where}: the app still lets the browser into a private screen`);
  const left = await sessionCookies(page);
  check(left.length === 0, `${where}: the browser still holds ${left.map((c) => `${c.name}@${c.domain}`)}`);
}

const flows = {
  async "header-sign-in"() {
    const { page, close } = await visitor();
    try {
      const email = uniqueEmail("header");
      const header = await webHeader(page);
      check(!header.signedIn, "a fresh browser is already signed in on web");
      await page.press("Sign In", { within: "document.querySelector('header')" });
      await waitForUrl(page, (u) => u.startsWith(`${APP}/sign-in`), "the app's sign-in from web's header");
      const landing = await signInOnApp(page, email);
      // A person with no business grant belongs on web's personal workspace, never the demo guest's trip.
      check(landing.startsWith(`${WEB}/trips`), `a new person landed on ${landing}, not web's /trips`);
      const cookie = await checkSessionCookie(page);
      check((await apiUser(page)) === email, "the API does not know this browser as the person who signed in");
      const after = await webHeader(page);
      check(after.signedIn, "web's header still says Sign In after signing in");
      console.log(
        `  signed in from web's header; landed on ${landing}; web shows "${after.label}"; ${cookie.name}@${cookie.domain}`,
      );
      console.log("AUTH E2E header-sign-in OK");
    } finally {
      await close();
    }
  },

  async "web-sign-out"() {
    const { page, close } = await visitor();
    try {
      const email = uniqueEmail("websignout");
      await page.goto(`${APP}/sign-in`);
      await signInOnApp(page, email);
      check((await webHeader(page)).signedIn, "web does not show the person signed in");
      await pressSelector(page, '[aria-label^="Account menu for"]', "web's account menu");
      await page.waitFor(
        `[...document.querySelectorAll('[role=menuitem]')].some((e) => e.innerText.trim() === 'Sign out')`,
        "web's Sign out item",
      );
      await pressMenuItem(page, "Sign out");
      const landed = await waitForUrl(
        page,
        (u) => u.startsWith(`${WEB}/`) && !u.includes("/sign-in") && u !== `${WEB}/robots.txt`,
        "web's landing after sign-out",
      );
      await page.waitForText("signed out", 30_000).catch(() => {});
      await checkSignedOutEverywhere(page, "after web's sign-out");
      console.log(`  web's Sign out landed on ${landed}; API, web, app and cookie jar all signed out`);
      console.log("AUTH E2E web-sign-out OK");
    } finally {
      await close();
    }
  },

  async "app-sign-out"() {
    const cases = [
      { who: "a new person (guest)", email: uniqueEmail("appsignout"), lands: `${WEB}/trips` },
      { who: "a business owner", email: personas.owner.email, lands: APP },
    ];
    for (const { who, email, lands } of cases) {
      const { page, close } = await visitor();
      try {
        await page.goto(`${APP}/sign-in`);
        const landing = await signInOnApp(page, email);
        check(landing.startsWith(lands), `${who}: landed on ${landing}, expected ${lands}…`);
        check((await apiUser(page)) === email, `${who}: not signed in after the code`);
        await page.goto(landing);
        await hydrated(page);
        await signOutVia(page, landing);
        await waitForUrl(
          page,
          (u) => u.startsWith(`${APP}/sign-in`) || u.includes("signed-out=1") || u === `${WEB}/`,
          `${who}: the page after signing out`,
        );
        await checkSignedOutEverywhere(page, `${who}, after signing out from ${landing}`);
        console.log(`  ${who}: signed out from ${landing}; API, web, app and cookie jar all signed out`);
      } finally {
        await close();
      }
    }
    console.log("AUTH E2E app-sign-out OK");
  },

  async register() {
    const { page, close } = await visitor();
    try {
      const email = uniqueEmail("register");
      const platform = JSON.parse((await edgeRequest(`${API}/api/v1/platform`)).text);
      await page.goto(`${WEB}/register?kind=hotel`);
      await page.waitForText("Start with your email");
      await hydrated(page);
      await sleep(1_500);
      const google = await page.eval(`document.body.innerText.includes('Continue with Google')`);
      check(
        google === (platform.googleSignIn === true),
        `"Continue with Google" is ${google ? "offered" : "hidden"}, but the API's googleSignIn is ${platform.googleSignIn}`,
      );
      const since = Date.now() - 2_000;
      await typeUntilAccepted(page, 'input[name="email"]', email, "Send code");
      await page.press("Send code");
      await page.waitFor(`!!document.querySelector('input[autocomplete="one-time-code"]')`, "the code field");
      const code = await mailedCode(email, since);
      const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
      await typeUntilAccepted(page, 'input[autocomplete="one-time-code"]', wrong, "Verify and continue");
      await page.press("Verify and continue");
      await page.waitForText("That code doesn't match", 30_000);
      check((await apiUser(page)) === null, "a wrong code opened a session");
      // A fresh page, a fresh send: the newest code is the one that counts.
      await page.goto(`${WEB}/register?kind=hotel`);
      await page.waitForText("Start with your email");
      await hydrated(page);
      const again = Date.now() - 2_000;
      await typeUntilAccepted(page, 'input[name="email"]', email, "Send code");
      await page.press("Send code");
      await page.waitFor(`!!document.querySelector('input[autocomplete="one-time-code"]')`, "the code field");
      await typeUntilAccepted(
        page,
        'input[autocomplete="one-time-code"]',
        await mailedCode(email, again),
        "Verify and continue",
      );
      await page.press("Verify and continue");
      await page.waitFor(
        `!document.querySelector('input[autocomplete="one-time-code"]')`,
        "the step after the email",
        60_000,
      );
      const text = await page.text();
      check(!text.includes("did not keep you signed in"), "the code was accepted but the browser kept no session");
      await checkSessionCookie(page);
      check((await apiUser(page)) === email, "the API does not know the registering person");
      check((await webHeader(page)).signedIn, "web's header does not show the registering person signed in");
      check(await appLetsIn(page), "the app does not accept the session /register opened");
      console.log("  /register: wrong code refused as a mismatch; the mailed code signed in on web and the app");
      console.log("AUTH E2E register OK");
    } finally {
      await close();
    }
  },

  async "return-to"() {
    const { page, close } = await visitor();
    try {
      const email = uniqueEmail("returnto");
      await page.goto(`${WEB}/trips`);
      const signIn = await waitForUrl(page, (u) => u.startsWith(`${APP}/sign-in`), "the app's sign-in from /trips");
      check(
        new URL(signIn).searchParams.get("redirect") === "/trips",
        `web did not say where to come back to: ${signIn}`,
      );
      const landing = await signInOnApp(page, email);
      check(landing.startsWith(`${WEB}/trips`), `sign-in did not return to web's /trips: ${landing}`);
      await sleep(3_000);
      check((await page.url()).startsWith(`${WEB}/trips`), `web bounced the signed-in person: ${await page.url()}`);
      check((await webHeader(page)).signedIn, "web's header does not show the person signed in");
      console.log("  /trips → sign in → back on /trips, signed in");
      console.log("AUTH E2E return-to OK");
    } finally {
      await close();
    }
  },

  async "stale-sign-out"() {
    const { page, close } = await visitor();
    try {
      const cases = ["revoked elsewhere", "no longer verifiable"];
      for (const why of cases) {
        await page.goto(`${APP}/sign-in`);
        const landing = await signInOnApp(page, uniqueEmail("stale"));
        const [cookie] = await sessionCookies(page);
        check(cookie, "no session cookie after signing in");
        if (why === "revoked elsewhere") {
          // Another device signs this session out: the API forgets it, this browser still holds the cookie.
          const out = await edgeRequest(`${API}/api/auth/sign-out`, {
            method: "POST",
            headers: {
              origin: WEB,
              "content-type": "application/json",
              cookie: `${cookie.name}=${cookie.value}`,
              [CLIENT_IP_HEADER]: visitorIp(),
            },
            body: "{}",
          });
          check(out.status === 200, `revoking the session elsewhere answered ${out.status}`);
        } else {
          // The API's secret changed under the cookie: same name, domain and flags, a signature nobody can verify.
          await page.send("Network.setCookie", {
            name: cookie.name,
            value: `${cookie.value.split(".")[0]}.tampered${randomBytes(8).toString("hex")}`,
            domain: cookie.domain,
            path: cookie.path,
            secure: true,
            httpOnly: true,
            sameSite: cookie.sameSite,
            expires: cookie.expires,
          });
        }
        // The cookie is still in the browser, and no surface may honour it.
        check((await apiUser(page)) === null, `${why}: the API still honours the dead cookie`);
        check(!(await webHeader(page)).signedIn, `${why}: web still shows the person signed in`);
        check(!(await appLetsIn(page, "/account")), `${why}: the app still opens a private screen`);
        // And the dead cookie is no obstacle: signing in again replaces it with a live one.
        await page.goto(`${APP}/sign-in`);
        const again = uniqueEmail("stale");
        await signInOnApp(page, again);
        await checkSessionCookie(page);
        check((await apiUser(page)) === again, `${why}: signing in again over the dead cookie did not take`);
        console.log(
          `  ${why}: treated as signed out on the API, web and the app; signing in again works (from ${landing})`,
        );
        await page.send("Network.clearBrowserCookies");
      }
      console.log("AUTH E2E stale-sign-out OK");
    } finally {
      await close();
    }
  },

  async sessions() {
    const email = uniqueEmail("sessions");
    const first = await visitor();
    const second = await visitor();
    try {
      await first.page.goto(`${APP}/sign-in`);
      await signInOnApp(first.page, email);
      await second.page.goto(`${APP}/sign-in`);
      await signInOnApp(second.page, email);
      check((await apiUser(second.page)) === email, "the second browser is not signed in");

      const { page } = first;
      await page.goto(`${APP}/account`);
      check(!(await page.url()).startsWith(`${APP}/sign-in`), "the app sent a signed-in person away from /account");
      await page.waitForText("Sign-in & sessions");
      const rows = await page.eval(
        `[...document.querySelectorAll('[aria-label="Active sessions"] [role=row]')].slice(1).map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`,
      );
      check(
        rows.length === 2,
        `expected this person's 2 sessions, the table shows ${rows.length}: ${JSON.stringify(rows)}`,
      );
      check(
        rows.every((r) => r.startsWith("Chrome on ")),
        `each session should name the browser that opened it: ${JSON.stringify(rows)}`,
      );
      await page.press("Sign out all other sessions");
      await page.waitFor(
        `[...document.querySelectorAll('[aria-label="Active sessions"] [role=row]')].slice(1).length === 1`,
        "the table to show only this session",
        30_000,
      );
      check(
        (await apiUser(second.page)) === null,
        "the other browser's session survived 'Sign out all other sessions'",
      );
      check((await apiUser(page)) === email, "signing out the other sessions signed this one out too");
      console.log(
        `  two real sessions listed (${rows.join(" | ")}); signing out the others revoked the second browser`,
      );
      console.log("AUTH E2E sessions OK");
    } finally {
      await first.close();
      await second.close();
    }
  },
};

/** Press a menu item by its exact label (Radix and React Aria menus render role=menuitem). */
async function pressMenuItem(page, label) {
  const index = await page.eval(
    `[...document.querySelectorAll('[role=menuitem]')].findIndex((e) => e.innerText.trim() === ${JSON.stringify(label)} && e.getBoundingClientRect().width > 0)`,
  );
  check(index >= 0, `no menu item "${label}"`);
  const box = await page.eval(`(() => {
    const el = [...document.querySelectorAll('[role=menuitem]')][${index}];
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
  }
}

/**
 * The app's sign-out from the screen a person is on: a "Sign out" button there, or the account menu's
 * "Sign out". Fails when the screen offers neither, which is a person who cannot sign out.
 */
async function signOutVia(page, on) {
  const visible = `(e) => e.getBoundingClientRect().width > 0 && e.innerText.trim() === 'Sign out'`;
  const direct = await page.eval(`[...document.querySelectorAll('button, [role=button], a')].some(${visible})`);
  if (direct) return page.press("Sign out");
  const menu = await page.eval(`!!document.querySelector('[aria-label$="Account menu"]')`);
  check(menu, `no way to sign out on ${on}: no "Sign out" control and no account menu`);
  await pressSelector(page, '[aria-label$="Account menu"]', "the account menu");
  await page.waitFor(
    `[...document.querySelectorAll('[role=menuitem]')].some(${visible})`,
    `"Sign out" in the account menu on ${on}`,
  );
  await pressMenuItem(page, "Sign out");
}

const flow = process.argv.includes("--flow") ? process.argv[process.argv.indexOf("--flow") + 1] : "all";
const names = flow === "all" ? Object.keys(flows) : [flow];
for (const name of names) {
  if (!flows[name]) throw new Error(`no flow "${name}"; one of: ${Object.keys(flows).join(", ")}, all`);
  console.log(`flow ${name}`);
  await flows[name]();
}
