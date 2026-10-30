#!/usr/bin/env node
/**
 * The tracer, in a real browser: the housekeeper signs in on the sign-in page with the demo code, her
 * board at /staff comes from Postgres (no sample-data mark), Start cleaning then Mark clean moves a room
 * to Done today and the move survives a reload, a screen still on fixtures carries the mark, and Sign out
 * really ends the session.
 *
 *   APP_URL=http://localhost:3040 node scripts/browser/staff-board.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER STAFF BOARD OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");
const EMAIL = "jeanne@app.demo.injishi.com";

const fail = (message) => {
  throw new Error(message);
};

/** Text of the "Up next" and "Done today" sections of the board. */
const sections = `(() => {
  const done = document.getElementById('done-h')?.closest('section') ?? document.querySelector('[aria-label="Done today"]')?.parentElement;
  const next = document.getElementById('next-h')?.closest('section');
  return { next: next?.innerText ?? '', done: done?.innerText ?? '', starts: [...document.querySelectorAll('button')].filter((b) => b.innerText.includes('Start cleaning')).length };
})()`;

const { page, close } = await launch();
try {
  await page.goto(`${APP}/sign-in?next=/staff`);
  await page.waitFor("!!document.querySelector('input[type=email]')", "the email field");
  await page.type("input[type=email]", EMAIL);
  await page.press("Continue");
  await page.waitFor("location.pathname === '/verify'", "the code step", 90_000);
  await page.waitForText("every code is");
  await page.press("Verify and continue");
  await page.waitFor("location.pathname === '/staff'", "/staff after verifying", 120_000);
  await page.waitForText("Done today", 120_000);
  console.log("  signed in as Jeanne through the API and landed on /staff");

  const before = await page.eval(sections);
  for (const room of ["204", "211", "206", "209"])
    if (!before.next.includes(room)) fail(`room ${room} is not on the board`);
  for (const room of ["201", "203", "207"]) if (!before.done.includes(room)) fail(`room ${room} is not in Done today`);
  if (before.starts !== 4) fail(`${before.starts} rooms waiting to start, expected 4`);
  if ((await page.text()).includes("Sample data"))
    fail("/staff is marked as sample data, but both of its collections are live");
  console.log("  the board shows the seeded day from Postgres, with no sample-data mark");

  await page.press("Start cleaning");
  await page.waitForText("Mark clean");
  await page.press("Mark clean");
  // Wait for the server round trip (the action, then the refreshed Done list), not just the optimistic update:
  // reloading earlier aborts the action mid-flight.
  await page.waitFor(
    `(() => { const s = ${sections}; return s.starts === 3 && s.done.includes("204") && !s.next.includes("Mark clean"); })()`,
    "room 204 to reach Done today",
  );
  await page.reload();
  await page.waitForText("Done today", 60_000);
  const after = await page.eval(sections);
  if (after.starts !== 3) fail(`after a reload ${after.starts} rooms wait, expected 3: the change did not persist`);
  if (!after.done.includes("204") || !/Cleaned \d{2}:\d{2} · waiting for inspection/.test(after.done)) {
    fail(`after a reload Done today reads: ${after.done.replace(/\s+/g, " ").slice(0, 300)}`);
  }
  console.log("  Start cleaning → Mark clean moved 204 to Done today, and it is still there after a reload");

  await page.goto(`${APP}/staff/me`);
  await page.waitForText("Sign out", 90_000);
  if (!(await page.text()).includes("Sample data"))
    fail("/staff/me still draws fixture data but carries no sample-data mark");
  console.log("  /staff/me, still on fixtures, carries the sample-data mark");

  await page.press("Sign out");
  await page.waitFor("location.pathname === '/sign-in'", "the sign-in page after signing out", 60_000);
  await page.goto(`${APP}/staff`);
  await page.waitFor("location.pathname === '/sign-in'", "a signed-out visit to /staff to bounce to sign-in", 60_000);
  console.log("  Sign out ended the session: /staff now bounces to /sign-in");

  console.log("BROWSER STAFF BOARD OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
