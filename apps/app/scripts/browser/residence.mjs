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

  console.log("BROWSER RESIDENCE OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
