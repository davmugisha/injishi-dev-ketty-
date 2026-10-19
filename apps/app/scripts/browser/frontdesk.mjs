#!/usr/bin/env node
/**
 * The front desk, in a real browser, on Postgres through the API: Eric (front desk) answers a request
 * to book on Reservations → Requests and the answer survives a reload; then on Today he gives the
 * arrival without a room a room from the assign drawer, and the room is still there after a reload;
 * then he checks a walk-in in from the walk-in screen and lands on the new stay's page, which reads the
 * stay after a reload.
 *
 *   APP_URL=http://localhost:3042 node scripts/browser/frontdesk.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER FRONTDESK OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3042").replace(/\/$/, "");

const fail = (message) => {
  throw new Error(message);
};

const requestCards = `document.querySelectorAll('[role=article][aria-label^="Request from"]').length`;
const firstRequest = `document.querySelector('[role=article][aria-label^="Request from"]')?.getAttribute('aria-label') ?? ''`;

const { page, close } = await launch();
try {
  await page.goto(
    `${APP}/api/demo/sign-in?persona=frontdesk&next=${encodeURIComponent("/reservations?view=requests")}`,
  );
  await page.waitFor("location.pathname === '/reservations'", "Reservations after signing in", 120_000);
  await page.waitForText("Request-to-book", 120_000);
  const before = await page.eval(requestCards);
  if (before < 2) fail(`${before} requests are waiting; reseed the interface world`);
  const answered = await page.eval(firstRequest);
  console.log(`  signed in as Eric; ${before} requests to book are waiting, first: ${answered}`);

  await page.press("Approve");
  await page.waitFor(`${requestCards} === ${before - 1}`, "the approved request to leave the queue", 60_000);
  await page.reload();
  await page.waitForText("Reservations", 60_000);
  await page.goto(`${APP}/reservations?view=requests`);
  await page.waitForText("Request-to-book", 60_000);
  const after = await page.eval(requestCards);
  if (after !== before - 1)
    fail(`after a reload ${after} requests wait, expected ${before - 1}: the approval did not persist`);
  if ((await page.eval(firstRequest)) === answered) fail(`${answered} is still waiting after it was approved`);
  console.log(`  approved: ${answered} left the queue, and it stays answered after a reload`);

  await page.goto(`${APP}/front-desk`);
  await page.waitForText("Quick Walk-in", 120_000);
  const roomless = await page.eval(
    `(() => { const p = [...document.querySelectorAll('p')].find((e) => e.innerText.includes('no room yet')); return p ? p.innerText : ''; })()`,
  );
  const guest = roomless.match(/rooms? can't be checked into without a manager override\.\s*(.+?) \(/)?.[1];
  if (!guest) fail(`Today names no arrival without a room: ${roomless}`);
  // The first press can land before the page has hydrated in a dev server; press until the drawer opens.
  for (let tries = 0; tries < 10 && !(await page.eval("!!document.querySelector('[role=dialog]')")); tries++) {
    await page.press("Assign room");
    await new Promise((r) => setTimeout(r, 2_000));
  }
  await page.waitFor("!!document.querySelector('[role=dialog]')", "the assign drawer");
  const picked = await page.eval(`(() => {
    const radio = [...document.querySelectorAll('[role=dialog] input[type=radio]')].find((r) => !r.disabled);
    if (!radio) return null;
    radio.click();
    return radio.value;
  })()`);
  if (!picked) fail("the drawer offers no ready room");
  await page.press(`Assign room ${picked}`);
  await page.waitFor(`!document.querySelector('[role=dialog]')`, "the drawer to close after assigning", 60_000);
  await page.reload();
  await page.waitForText("Quick Walk-in", 120_000);
  const row = await page.eval(
    `[...document.querySelectorAll('tr')].map((r) => r.innerText).find((t) => t.includes(${JSON.stringify(guest)})) ?? ''`,
  );
  if (!row.includes(picked)) fail(`after a reload ${guest}'s row reads: ${row.replace(/\s+/g, " ")}`);
  console.log(`  Today: ${guest} was given room ${picked} from the drawer, and keeps it after a reload`);

  // Walk-in: choose a room type with a room free tonight, name the guest, and check them in for real.
  await page.goto(`${APP}/walk-in`);
  await page.waitForText("Availability by Room Type", 120_000);
  await new Promise((r) => setTimeout(r, 2_000));
  const typeBox = await page.eval(`(() => {
    const radio = [...document.querySelectorAll('input[type=radio]')].find((r) => !r.disabled && r.closest('table'));
    const label = radio?.closest('label');
    if (!label) return null;
    label.scrollIntoView({ block: 'center' });
    const r = label.getBoundingClientRect();
    return { x: r.left + 12, y: r.top + r.height / 2 };
  })()`);
  if (!typeBox) fail("the walk-in screen offers no room type with a room free tonight");
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, x: typeBox.x, y: typeBox.y, button: "left", clickCount: 1 });
  }
  const walkInName = `Browser Walkin ${Date.now() % 100000}`;
  await page.type('input[placeholder="As on the guest\'s ID"]', walkInName);
  await page.press(`Check in ${walkInName}`);
  await page.waitFor("location.pathname.startsWith('/stays/')", "the walk-in's stay page", 60_000);
  const stayPath = await page.eval("location.pathname");
  await page.reload();
  await page.waitForText("Payments and Balance", 120_000);
  await page.waitForText(walkInName, 60_000);
  console.log(
    `  Walk-in: ${walkInName} was checked in from the walk-in screen; ${stayPath} reads the stay after a reload`,
  );

  console.log("BROWSER FRONTDESK OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
