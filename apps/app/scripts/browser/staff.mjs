#!/usr/bin/env node
/**
 * The staff phone, in a real browser: Jeanne signs in with the demo code, starts and finishes the room on
 * /staff/task and the move survives a reload, sends a fault from /staff/report and gets a real ticket
 * number back, and Jean-Paul's /staff/work-orders lists that ticket.
 *
 *   APP_URL=http://localhost:3040 node scripts/browser/staff.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER STAFF OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");

const fail = (message) => {
  throw new Error(message);
};

async function signIn(page, email, next) {
  await page.goto(`${APP}/sign-in?next=${next}`);
  await page.waitFor("!!document.querySelector('input[type=email]')", "the email field");
  await page.type("input[type=email]", email);
  await page.press("Continue");
  await page.waitFor("location.pathname === '/verify'", "the code step", 90_000);
  await page.waitForText("every code is");
  await page.press("Verify and continue");
  await page.waitFor(`location.pathname === '${next}'`, `${next} after verifying`, 120_000);
}

const { page, close } = await launch({ width: 420, height: 900 });
try {
  await signIn(page, "jeanne@app.demo.injishi.com", "/staff/task");
  await page.waitForText("Start cleaning room", 120_000);
  console.log("  signed in as Jeanne and landed on her current room");

  await page.press("Start cleaning room");
  await page.waitForText("Mark clean", 60_000);
  await page.press("Mark clean");
  await page.waitForText("waiting for inspection", 60_000);
  await page.reload();
  await page.waitFor(
    "!document.body.innerText.includes('Start cleaning room') || document.body.innerText.includes('waiting for inspection')",
    "the finished room to survive a reload",
    60_000,
  );
  console.log("  Start cleaning → Mark clean reached the server and held after a reload");

  const fault = `Socket by the lift sparks when used ${Date.now() % 10_000}`;
  await page.goto(`${APP}/staff/report`);
  await page.waitForText("Send report", 90_000);
  await page.type("textarea", fault);
  await page.press("Send report");
  await page.waitForText("Sent to maintenance", 60_000);
  const ticket = (await page.text()).match(/WO-\d+/)?.[0];
  if (!ticket) fail("the report was sent but no WO- ticket number came back");
  console.log(`  the fault became ${ticket} through the API`);

  await page.goto(`${APP}/staff/me`);
  await page.waitForText("Sign out", 90_000);
  await page.press("Sign out");
  await page.waitFor("location.pathname === '/sign-in'", "the sign-in page after signing out", 60_000);
  await signIn(page, "jeanpaul@app.demo.injishi.com", "/staff/work-orders");
  await page.waitForText(ticket, 120_000);
  console.log(`  Jean-Paul's work orders list ${ticket}`);

  console.log("BROWSER STAFF OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
