#!/usr/bin/env node
/**
 * The rent roll on real data, in a real browser: Solange opens /rent-roll, the roll comes from Postgres
 * (no sample-data mark), she opens A-03's ledger, records a bank transfer received at the office, and the
 * payment shows in the ledger as Pending (never as collected rent) and is still there after a reload.
 *
 *   APP_URL=http://localhost:3045 node scripts/browser/residence.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER RESIDENCE OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3045").replace(/\/$/, "");
const REF = `BK-BROWSER-${Date.now().toString(36).toUpperCase()}`;

const fail = (message) => {
  throw new Error(message);
};

/** The selected unit's ledger, as its rows' text. */
const ledger = `(() => {
  const list = document.querySelector('[aria-label="Charges and payment allocation"]');
  return list ? [...list.querySelectorAll('[role=row], li')].map((r) => r.innerText) : null;
})()`;

/** Press a tab with real pointer events (React Aria) until `ready` holds. */
async function openTab(page, label, ready, what) {
  const until = Date.now() + 60_000;
  while (Date.now() < until) {
    const box = await page.eval(
      `(() => { const t = [...document.querySelectorAll('[role=tab]')].find((el) => el.innerText.includes(${JSON.stringify(label)})); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
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
  throw new Error(`could not open the ${label} tab (${what})`);
}

const { page, close } = await launch({ width: 1440, height: 1000 });
try {
  await page.goto(`${APP}/api/demo/sign-in?persona=residence&next=/rent-roll`);
  await page.waitFor("location.pathname === '/rent-roll'", "/rent-roll after signing in", 120_000);
  await page.waitForText("Rent Roll", 120_000);
  await page.waitFor(
    `Object.keys(document.querySelector('[aria-label="Open A-03 ledger"]') ?? {}).some((k) => k.startsWith("__reactProps"))`,
    "the rent roll to hydrate",
    120_000,
  );
  if ((await page.text()).includes("Sample data"))
    fail("/rent-roll is marked as sample data, but every collection it reads is live");
  console.log("  signed in as Solange through the API and opened the rent roll, with no sample-data mark");

  await page.press("A-03", { within: `document.querySelector('[aria-label="Open A-03 ledger"]').parentElement` });
  await page.waitFor(
    `document.getElementById('led-h')?.closest('aside')?.innerText.includes('A-03 ·')`,
    "A-03's ledger in the side panel",
  );
  await page.press("Record payment");
  await page.waitFor(`!!document.querySelector('input[placeholder="From the bank slip or SMS"]')`, "the payment form");
  // Nothing matches a recorded payment to a statement, so the form no longer says something will.
  if ((await page.text()).includes("until Payments matches it")) fail("the form still promises a reconciliation");
  await page.waitForText("is not available yet", 10_000);
  await page.type("input[inputmode=numeric]", "250000");
  await page.type('input[placeholder="From the bank slip or SMS"]', REF);
  await page.press("Save as pending");
  await page.waitForText("saved as pending for A-03", 60_000);
  await page.waitFor(
    `(${ledger} ?? []).some((r) => r.includes(${JSON.stringify(REF)}) && r.includes('Pending'))`,
    "the payment in A-03's ledger as Pending",
  );
  console.log(`  recorded RWF 250,000 by bank transfer (${REF}); A-03's ledger shows it as Pending`);

  await page.reload();
  await page.waitForText("Rent Roll", 60_000);
  await page.waitFor(
    `Object.keys(document.querySelector('[aria-label="Open A-03 ledger"]') ?? {}).some((k) => k.startsWith("__reactProps"))`,
    "the rent roll to hydrate again",
    120_000,
  );
  await page.press("A-03", { within: `document.querySelector('[aria-label="Open A-03 ledger"]').parentElement` });
  await page.waitFor(
    `(${ledger} ?? []).some((r) => r.includes(${JSON.stringify(REF)}) && r.includes('Pending'))`,
    "the payment still Pending after a reload",
  );
  console.log("  the pending payment is still in the ledger after a reload");

  // Leases: a seeded filing row is sample data, so its Filings tab claims no stage, no "sent", no acknowledgement.
  await page.goto(`${APP}/leases`);
  await page.waitForText("Filings & declarations", 120_000);
  await openTab(page, "Filings", "document.body.innerText.includes('Lease filing')", "the Filings tab");
  const filings = await page.text();
  // ("Acknowledged" alone is also the stepper's last step label, so the chip and delivery texts are checked.)
  if (/Sent · needs follow-up|Acknowledgement not received|Recorded as filed/.test(filings))
    fail("the Filings tab still presents a sample filing as sent or acknowledged");
  if (!filings.includes("Sample record")) fail("the sample filing is not labelled as a sample record");
  console.log("  /leases: the first lease's filing reads as a sample record, never sent or acknowledged");

  console.log("BROWSER RESIDENCE OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
