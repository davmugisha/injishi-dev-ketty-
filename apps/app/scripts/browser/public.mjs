#!/usr/bin/env node
/**
 * The hosts page, in a real browser, as a visitor with no account: Request demo opens a real support ticket and
 * prints its number, and the header carries the Sample data mark. Then Training's Verify reads the API's public
 * certificate check as the receptionist. (The owner waitlist is gone: main removed it in 4f32a8f1.)
 *
 *   APP_URL=http://localhost:3040 node scripts/browser/public.mjs
 *
 * Needs the app's dev server (pointed at a demo API). Prints "BROWSER PUBLIC OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");
const RUN = Date.now().toString(36);

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

const { page, close } = await launch();
try {
  await page.goto(`${APP}/hosts`);
  await page.waitForText("Request demo", 90_000);
  const demo = "document.querySelector('section[aria-labelledby=\"demo-h\"]')";
  await fill(page, 'section[aria-labelledby="demo-h"]', 0, "Browser Owner");
  await fill(page, 'section[aria-labelledby="demo-h"]', 1, `browser.demo.${RUN}@app.demo.injishi.com`);
  await fill(page, 'section[aria-labelledby="demo-h"]', 2, "Browser Check Lodge (demo)");
  await fill(page, 'section[aria-labelledby="demo-h"]', 3, "078 300 1122");
  // Nothing is chosen for the visitor: with business type, district and format unset the request is refused on
  // the page and no ticket is opened.
  const unset = await page.eval(
    `['d-type', 'd-dist', 'd-src'].every((id) => document.getElementById(id)?.value === '')`,
  );
  if (!unset) throw new Error("the demo form starts with a business type, district or source already chosen");
  await page.press("Request demo", { within: demo });
  await page.waitForText("Choose your business type, district", 30_000);
  if ((await page.text()).includes("Sent to Injishi support · ticket")) throw new Error("an unchosen form was sent");
  console.log("  the demo form starts unset and refuses to send until the visitor chooses");
  await page.eval(`(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    for (const [id, value] of [['d-type', 'lodge'], ['d-dist', 'Rubavu']]) {
      const el = document.getElementById(id);
      set.call(el, value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
  await page.press("At my property", { within: demo });
  await page.press("Request demo", { within: demo });
  await page.waitForText("Sent to Injishi support · ticket", 60_000);
  const ticket = (await page.text()).match(/ticket ([0-9A-F]{8})/)?.[1];
  if (!ticket) throw new Error("the demo request came back without a ticket number");
  console.log(`  Request demo opened support ticket ${ticket}`);

  // The hosts page still draws sample collections, so its header says so (the same mark as the workspace top bar).
  const marked = await page.eval(
    `[...document.querySelectorAll('[data-sample-mark="header"]')].some((m) => m.textContent.includes('Sample data'))`,
  );
  if (!marked) throw new Error("the hosts page shows no Sample data mark in its header");
  console.log("  the hosts page's header carries the Sample data mark");

  // Training: Verify asks the API's public check (GET /verify/:token), never the page's own register.
  await page.goto(`${APP}/api/demo/sign-in?persona=frontdesk&next=${encodeURIComponent("/training")}`);
  await page.waitForText("Verify a Certificate", 90_000);
  const code = `BROWSER${RUN.toUpperCase()}`;
  await fill(page, 'section[aria-labelledby="ver-h"]', 0, code);
  await page.press("Verify", { within: "document.querySelector('section[aria-labelledby=\"ver-h\"]')" });
  await page.waitForText(`No certificate matches “${code}”`, 60_000);
  console.log(`  Verify sent ${code} to the API's public check and shows its answer: not found`);

  console.log("BROWSER PUBLIC OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
