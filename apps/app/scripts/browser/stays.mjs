#!/usr/bin/env node
/**
 * The stays screens, in a real browser, on Postgres through the API, as Eric (front desk):
 *
 *   - Messages: a reply sent through the screen's server action remains on the conversation after a reload;
 *   - Stay and folio (the guest Checkout opens on): a desk charge posted from the drawer, typed before VAT,
 *     is on the bill after a reload; cash recorded from the payment drawer is on the bill after a reload.
 *
 *   APP_URL=http://localhost:3042 node scripts/browser/stays.mjs
 *
 * Needs the app's dev server and a freshly seeded demo API. Prints "BROWSER STAYS OK" only after each
 * change has been read back after a reload.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3042").replace(/\/$/, "");
const { page, close } = await launch();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (message) => {
  throw new Error(message);
};

/** Press the element an expression returns, with real pointer events (React Aria ignores element.click()). */
async function pressAt(expression, what) {
  const box = await page.eval(`(() => {
    const el = ${expression};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) fail(`nothing to press: ${what}`);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
  }
}

/** Mark the input whose label reads `label` inside the open dialog, so `page.type` can find it. */
async function markInput(label, mark) {
  const ok = await page.eval(`(() => {
    const input = [...document.querySelectorAll('[role=dialog] input')].find((i) =>
      [...(i.labels ?? [])].some((l) => l.innerText.trim().startsWith(${JSON.stringify(label)})),
    );
    if (!input) return false;
    input.setAttribute('data-check', ${JSON.stringify(mark)});
    return true;
  })()`);
  if (!ok) fail(`no input labelled "${label}" in the drawer`);
}

/** Open a drawer by pressing its button until the dialog shows (the first press can precede hydration). */
async function openDrawer(button) {
  for (let tries = 0; tries < 10 && !(await page.eval("!!document.querySelector('[role=dialog]')")); tries++) {
    await page.press(button);
    await sleep(2_000);
  }
  await page.waitFor("!!document.querySelector('[role=dialog]')", `the drawer behind "${button}"`);
}

try {
  await page.goto(`${APP}/api/demo/sign-in?persona=frontdesk&next=${encodeURIComponent("/messages")}`);
  await page.waitFor("location.pathname === '/messages'", "Messages after signing in", 120_000);
  await page.waitForText("Guest Messages", 120_000);
  await page.waitFor(
    "document.querySelector('#draft') && !document.querySelector('#draft').disabled",
    "an open conversation",
  );
  // The initial development render can precede hydration. Typing must survive it before sending.
  await sleep(2_000);
  const body = `Browser check ${new Date().toISOString()}: your room is being prepared.`;
  await page.type("#draft", body);
  await page.press("Send");
  await page.waitFor(
    `document.querySelector('#draft')?.value === '' && document.body.innerText.includes(${JSON.stringify(body)})`,
    "the saved reply on the conversation",
    60_000,
  );
  await page.reload();
  await page.waitForText("Guest Messages", 120_000);
  await page.waitForText(body, 60_000);
  console.log("  Eric sent a reply from Messages; it remains on the conversation after a reload");

  // The guest Checkout opens on, and their stay page.
  await page.goto(`${APP}/check-out`);
  await page.waitForText("1 · Verify the Balance", 120_000);
  const stayHref = await page.eval(
    `[...document.querySelectorAll('a')].find((a) => a.innerText.includes('Open stay and folio'))?.getAttribute('href') ?? ''`,
  );
  if (!stayHref.startsWith("/stays/")) fail(`Checkout links to no stay: "${stayHref}"`);
  await page.goto(`${APP}${stayHref}`);
  await page.waitForText("Payments and Balance", 120_000);
  console.log(`  Checkout opens on ${stayHref}; its stay page reads the live bill`);

  // Post a desk charge, typed before VAT.
  const charge = `Browser check minibar ${Date.now() % 100000}`;
  await openDrawer("Post charge");
  await pressAt(
    `document.querySelector('[role=dialog] [role=radiogroup] label, [role=dialog] [role=radio]')`,
    "the first department",
  );
  await markInput("Amount before VAT", "amount");
  await page.type("[data-check=amount]", "4000");
  await page.eval(`(() => {
    const select = document.querySelector('[role=dialog] select');
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    set.call(select, 'Minibar count');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await markInput("Description on folio", "description");
  await page.type("[data-check=description]", charge);
  await page.press("Post charge", { within: "document.querySelector('[role=dialog]')" });
  await page.waitFor("!document.querySelector('[role=dialog]')", "the charge drawer to close after posting", 60_000);
  await page.reload();
  await page.waitForText("Payments and Balance", 120_000);
  await page.waitForText(charge, 60_000);
  const line = await page.eval(
    `[...document.querySelectorAll('tr')].map((r) => r.innerText).find((t) => t.includes(${JSON.stringify(charge)})) ?? ''`,
  );
  // Amounts are formatted with a no-break space ("RWF 4,720"), which \s matches.
  if (!/RWF\s4,720/.test(line)) fail(`the posted line reads: ${line.replace(/\s+/g, " ")}`);
  console.log(`  posted "${charge}" RWF 4,000 before VAT: after a reload it reads RWF 4,720 with its VAT`);

  // Record cash, exactly as typed.
  await openDrawer("Take payment");
  await markInput("Cash received", "cash");
  await page.type("[data-check=cash]", "1234");
  const record = await page.eval(
    `[...document.querySelectorAll('[role=dialog] button')].map((b) => b.innerText.replace(/\\s+/g, " ").trim()).find((t) => t.startsWith("Record")) ?? ""`,
  );
  if (record !== "Record RWF 1,234 cash") fail(`the drawer offers "${record}" for RWF 1,234 typed`);
  await page.press("Record", { within: "document.querySelector('[role=dialog]')" });
  await page.waitFor("!document.querySelector('[role=dialog]')", "the payment drawer to close after recording", 60_000);
  await page.reload();
  await page.waitForText("Payments and Balance", 120_000);
  await page.waitFor(
    `document.body.innerText.replace(/\\s+/g, " ").includes("Cash · RWF 1,234")`,
    "the recorded cash on the bill",
    60_000,
  );
  console.log("  recorded RWF 1,234 cash from the drawer: it is on the bill after a reload");

  console.log("BROWSER STAYS OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
