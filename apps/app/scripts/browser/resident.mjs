#!/usr/bin/env node
/**
 * The tenant's phone on real data, in a real browser: Olivier opens /resident/requests, his requests come
 * from Postgres (no sample-data mark), he reports a slow drain, and the request comes back from the server
 * as Submitted with its WO number, and is still there after a reload. The visitor form opens EMPTY (no sample
 * visitor), he types a guest, a date and a window, gets the gate's code, and the guest is listed after a
 * reload. Pay rent opens on his own charge with the phone field empty, whatever the month.
 *
 *   APP_URL=http://localhost:3045 node scripts/browser/resident.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER RESIDENT OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3045").replace(/\/$/, "");
const TEXT = `Browser ${Date.now().toString(36).toUpperCase()}: the kitchen tap drips`;
const GUEST = `Browser Guest ${Date.now().toString(36).toUpperCase()}`;

const fail = (message) => {
  throw new Error(message);
};

/** Press a Segment item (React Aria) with real pointer events, until `ready` holds. */
async function openSegment(page, key, ready, what) {
  const until = Date.now() + 60_000;
  while (Date.now() < until) {
    const box = await page.eval(
      `(() => { const t = document.querySelector('[data-key="${key}"]') ?? [...document.querySelectorAll('[role=radio], [role=tab], button')].find((e) => e.innerText.trim().toLowerCase() === '${key}'); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    );
    if (box) {
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
        await page.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
      }
    }
    try {
      await page.waitFor(ready, what, 3_000);
      return;
    } catch {}
  }
  fail(`timed out opening ${what}`);
}

/** The visitors list, as its rows' text. */
const visitors = `(() => {
  const list = document.querySelector('[aria-label="Upcoming and recent visitors"]');
  return list ? [...list.querySelectorAll('[role=row], li')].map((r) => r.innerText) : null;
})()`;

/** The "My requests" list, as its rows' text. */
const requests = `(() => {
  const list = document.querySelector('[aria-label="My requests"]');
  return list ? [...list.querySelectorAll('[role=row], li')].map((r) => r.innerText) : null;
})()`;

const { page, close } = await launch({ width: 430, height: 932 });
try {
  await page.goto(`${APP}/api/demo/sign-in?persona=resident&next=/resident/requests`);
  await page.waitFor("location.pathname === '/resident/requests'", "/resident/requests after signing in", 120_000);
  await page.waitForText("Request a repair", 120_000);
  await page.waitFor(
    `Object.keys(document.getElementById('rq-d') ?? {}).some((k) => k.startsWith("__reactProps"))`,
    "the requests screen to hydrate",
    120_000,
  );
  if ((await page.text()).includes("Sample data"))
    fail("/resident/requests is marked as sample data, but every collection it reads is live");
  console.log("  signed in as Olivier through the API and opened Requests, with no sample-data mark");

  await page.type("#rq-d", TEXT);
  await page.press("Send request");
  await page.waitForText("sent to management", 60_000);
  await page.waitFor(
    `(${requests} ?? []).some((r) => r.includes(${JSON.stringify(TEXT)}) && /WO-\\d+/.test(r) && r.includes('Submitted'))`,
    "the request in My requests, Submitted with a WO number",
  );
  console.log("  Send request came back from the server as Submitted, with its WO number");

  await page.reload();
  await page.waitForText("Request a repair", 60_000);
  await page.waitFor(
    `(${requests} ?? []).some((r) => r.includes(${JSON.stringify(TEXT)}) && r.includes('Submitted'))`,
    "the request still listed after a reload",
  );
  console.log("  the request is still listed after a reload");

  await openSegment(page, "visitors", "!!document.getElementById('pv-n')", "the Visitors tab");
  const empty = await page.eval(`['pv-n', 'pv-d', 'pv-t'].every((id) => document.getElementById(id)?.value === '')`);
  if (!empty) fail("the visitor form opened pre-filled; it must start empty");
  await page.type("#pv-n", GUEST);
  await page.type("#pv-d", "Tomorrow");
  await page.type("#pv-t", "18:00–20:00");
  await page.press("Get access code");
  await page.waitForText(`Access code for ${GUEST}`, 60_000);
  console.log("  the visitor form opened empty; Get access code came back with the gate's code for the typed guest");

  await page.reload();
  await page.waitForText("Request a repair", 60_000);
  await openSegment(page, "visitors", "!!document.getElementById('pv-n')", "the Visitors tab after a reload");
  await page.waitFor(
    `(${visitors} ?? []).some((r) => r.includes(${JSON.stringify(GUEST)}))`,
    "the guest listed under Upcoming and recent after a reload",
  );
  console.log("  the guest is listed after a reload");

  await page.goto(`${APP}/resident/pay`);
  await page.waitForText("Pay rent", 60_000);
  await page.waitFor(
    `!!document.getElementById('phone') || document.body.innerText.includes('Nothing to pay')`,
    "the pay screen (its form, or nothing due)",
  );
  const phone = await page.eval(`document.getElementById('phone')?.value ?? ''`);
  if (phone !== "") fail(`the pay screen's phone field opened with "${phone}"; it must start empty`);
  console.log("  Pay rent opens on his own charge (no 404), with the phone field empty");

  console.log("BROWSER RESIDENT OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
