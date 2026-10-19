#!/usr/bin/env node
/**
 * The HR officer's decisions, in a real browser: Diane signs in, the Leave screen draws from Postgres
 * (no sample-data mark), she declines a leave request with a reason and the decision survives a reload (and
 * the screen no longer claims anyone was notified: nothing delivers messages yet);
 * then on Attendance she approves a clock correction and it survives a reload too.
 *
 *   APP_URL=http://localhost:3040 node scripts/browser/people.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER PEOPLE OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");

const fail = (message) => {
  throw new Error(message);
};

/** The data-key of the first table row whose text includes `name`. */
const rowKey = (name) =>
  `(() => { const r = [...document.querySelectorAll('[role=row]')].find((x) => x.innerText.includes(${JSON.stringify(name)})); return r ? r.getAttribute('data-key') : null; })()`;

const { page, close } = await launch();
try {
  await page.goto(`${APP}/api/demo/sign-in?persona=hr&next=/leave`);
  await page.waitFor("location.pathname === '/leave'", "/leave after signing in", 120_000);
  await page.waitForText("Leave Calendar", 120_000);
  if ((await page.text()).includes("Sample data"))
    fail("/leave is marked as sample data, but its collections are live");
  console.log("  signed in as Diane; /leave draws from Postgres with no sample-data mark");

  // Vestine's annual leave is with HR: decline it with a reason.
  const id = await page.eval(rowKey("Vestine Uwimana"));
  if (!id) fail("Vestine's request is not in the queue");
  await page.goto(`${APP}/leave?request=${id}`);
  await page.waitForText("Approve as HR", 60_000);
  await page.press("Decline");
  await page.waitFor("!!document.querySelector('textarea')", "the reason field");
  await page.type("textarea", "Housekeeping is short that day; please pick another date");
  await page.press("Confirm decline");
  await page.waitForText("Declined · Vestine sees it in the staff app", 60_000);
  // Wait for the server round trip before leaving the page: a fresh render of the screen carries the reason.
  await page.waitFor(
    `fetch('/leave?request=${id}&tab=done', { cache: 'no-store' }).then((r) => r.text()).then((t) => t.includes('Housekeeping is short that day'))`,
    "the decline to reach the API",
    60_000,
  );
  await page.goto(`${APP}/leave?request=${id}&tab=done`);
  await page.waitForText("Declined · Vestine sees it in the staff app", 60_000);
  if (!(await page.text()).includes("Housekeeping is short that day"))
    fail("the decline reason did not survive a reload");
  if ((await page.text()).includes("notified")) fail("the leave screen still claims somebody was notified");
  console.log("  declined Vestine's leave with a reason; it is still declined after a reload");

  // Attendance: approve the first correction waiting for HR.
  await page.goto(`${APP}/attendance`);
  await page.waitForText("Correction Requests", 120_000);
  if ((await page.text()).includes("Sample data"))
    fail("/attendance is marked as sample data, but its collections are live");
  const waiting = await page.eval(
    `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Approve correction').length`,
  );
  if (waiting < 1) fail("no correction is waiting for HR");
  await page.press("Approve correction");
  await page.waitFor(
    `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Approve correction').length === ${waiting - 1}`,
    "the correction to leave the waiting list",
    60_000,
  );
  await page.waitForText("Approved by Diane Ingabire", 60_000);
  await page.reload();
  await page.waitForText("Correction Requests", 60_000);
  if (!(await page.text()).includes("Approved by Diane Ingabire"))
    fail("the approved correction did not survive a reload");
  console.log("  approved a clock correction; it is still approved after a reload");

  console.log("BROWSER PEOPLE OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
