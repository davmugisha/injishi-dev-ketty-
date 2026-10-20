#!/usr/bin/env node
/**
 * The tenant's phone on real data, in a real browser: Olivier opens /resident/requests, his requests come
 * from Postgres (no sample-data mark), he reports a slow drain, and the request comes back from the server
 * as Submitted with its WO number, and is still there after a reload.
 *
 *   APP_URL=http://localhost:3045 node scripts/browser/resident.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER RESIDENT OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3045").replace(/\/$/, "");
const TEXT = `Browser ${Date.now().toString(36).toUpperCase()}: the kitchen tap drips`;

const fail = (message) => {
  throw new Error(message);
};

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

  console.log("BROWSER RESIDENT OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
