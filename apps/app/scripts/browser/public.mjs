#!/usr/bin/env node
/**
 * The hosts page, in a real browser, as a visitor with no account: Join the waitlist sends the owner signup to
 * the API, and after a reload the same address is recognised as already on the list (so the first press was
 * stored, not just shown); Request demo opens a real support ticket and prints its number.
 *
 *   APP_URL=http://localhost:3040 node scripts/browser/public.mjs
 *
 * Needs the app's dev server (pointed at a demo API). The API throttles the waitlist to five signups an hour
 * per client, and this makes two. Prints "BROWSER PUBLIC OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");
const RUN = Date.now().toString(36);
const EMAIL = `browser.waitlist.${RUN}@app.demo.injishi.com`;

/** Type into the nth text field of a section (focus, select what is there, insert as a person would). */
async function fill(page, section, n, text) {
  const ok = await page.eval(`(() => {
    const inputs = [...document.querySelectorAll(${JSON.stringify(`${section} input`)})].filter(
      (i) => i.type !== 'checkbox' && i.type !== 'hidden',
    );
    const el = inputs[${n}];
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.focus();
    el.select();
    return true;
  })()`);
  if (!ok) throw new Error(`no field ${n} in ${section}`);
  await page.send("Input.insertText", { text });
}

async function joinWaitlist(page) {
  await page.waitForText("Join the Waitlist", 90_000);
  await fill(page, "#waitlist", 0, "Browser Owner");
  await fill(page, "#waitlist", 1, EMAIL);
  await fill(page, "#waitlist", 2, "078 300 1122");
  await fill(page, "#waitlist", 3, "Browser Check Lodge (demo)");
  await page.press("Join the waitlist", { within: "document.getElementById('waitlist')" });
}

const { page, close } = await launch();
try {
  await page.goto(`${APP}/hosts`);
  await joinWaitlist(page);
  await page.waitForText("on the waitlist", 60_000);
  if ((await page.text()).includes("Already on the waitlist")) throw new Error(`${EMAIL} was already on the list`);
  console.log(`  ${EMAIL} joined the owner waitlist from /hosts`);

  await page.reload();
  await joinWaitlist(page);
  await page.waitForText("Already on the waitlist", 60_000);
  console.log("  after a reload the same address is recognised: the first signup was stored by the API");

  const demo = "document.querySelector('section[aria-labelledby=\"demo-h\"]')";
  await fill(page, 'section[aria-labelledby="demo-h"]', 0, "Browser Owner");
  await fill(page, 'section[aria-labelledby="demo-h"]', 1, `browser.demo.${RUN}@app.demo.injishi.com`);
  await fill(page, 'section[aria-labelledby="demo-h"]', 2, "Browser Check Lodge (demo)");
  await fill(page, 'section[aria-labelledby="demo-h"]', 3, "078 300 1122");
  await page.press("Request demo", { within: demo });
  await page.waitForText("Sent to Injishi support · ticket", 60_000);
  const ticket = (await page.text()).match(/ticket ([0-9A-F]{8})/)?.[1];
  if (!ticket) throw new Error("the demo request came back without a ticket number");
  console.log(`  Request demo opened support ticket ${ticket}`);

  console.log("BROWSER PUBLIC OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
