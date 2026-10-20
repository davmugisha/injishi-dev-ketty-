#!/usr/bin/env node
/**
 * The housekeeping board on real data, in a real browser: the manager opens /housekeeping, the board
 * comes from Postgres (no sample-data mark), Pass moves room 102 from "Clean · awaiting inspection" to
 * "Inspected", Add task puts a new card in "To do", and both survive a reload.
 *
 *   APP_URL=http://localhost:3043 node scripts/browser/operations.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER OPERATIONS OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3043").replace(/\/$/, "");

const fail = (message) => {
  throw new Error(message);
};

/** The cards of each board column, as the room numbers they show. */
const columns = `(() => {
  const out = {};
  for (const title of ["To do", "In progress", "Clean · awaiting inspection", "Inspected"]) {
    const list = document.querySelector('[aria-label="' + title + '"]');
    out[title] = list ? (list.innerText.match(/\\b\\d{3}\\b/g) ?? []) : null;
  }
  return out;
})()`;

const { page, close } = await launch({ width: 1440, height: 1000 });
try {
  await page.goto(`${APP}/api/demo/sign-in?persona=manager&next=/housekeeping?view=tasks`);
  await page.waitFor("location.pathname === '/housekeeping'", "/housekeeping after signing in", 120_000);
  await page.waitForText("Inspection Gate", 120_000);
  // Wait for hydration: a button pressed before React attaches its handlers does nothing.
  await page.waitFor(
    `Object.keys(document.querySelector('[aria-label="Pass inspection of room 102"]') ?? {}).some((k) => k.startsWith("__reactProps"))`,
    "the board to hydrate",
    120_000,
  );
  console.log("  signed in as Aline through the API and opened the housekeeping board");

  const before = await page.eval(columns);
  if (!before["Clean · awaiting inspection"]?.includes("102"))
    fail(`102 is not awaiting inspection: ${JSON.stringify(before)}`);
  if (!before.Inspected?.includes("406")) fail(`406 is not in Inspected: ${JSON.stringify(before)}`);
  if ((await page.text()).includes("Sample data"))
    fail("/housekeeping is marked as sample data, but every collection it reads is live");
  console.log("  the board shows the seeded day from Postgres, with no sample-data mark");

  await page.press("Pass", {
    within: `document.querySelector('[aria-label="Pass inspection of room 102"]').parentElement`,
  });
  await page.waitFor(
    `(() => { const c = ${columns}; return c["Inspected"]?.includes("102") && !c["Clean · awaiting inspection"]?.includes("102"); })()`,
    "room 102 to reach Inspected",
  );
  await page.reload();
  await page.waitForText("Inspection Gate", 60_000);
  await page.waitFor(
    `Object.keys(document.querySelector("[aria-label=View]") ?? {}).some((k) => k.startsWith("__reactProps"))`,
    "the board to hydrate again",
    120_000,
  );
  const passed = await page.eval(columns);
  if (!passed.Inspected?.includes("102")) fail(`after a reload 102 is not Inspected: ${JSON.stringify(passed)}`);
  console.log("  Pass moved 102 to Inspected, and it is still there after a reload");

  const todo = passed["To do"]?.length ?? 0;
  await page.press("Add task");
  await page.waitFor("!!document.querySelector('[role=dialog]')", "the Add a cleaning task dialog");
  await page.press("Add task", { within: "document.querySelector('[role=dialog]')" });
  await page.waitFor(
    `(() => { const c = ${columns}; return (c["To do"]?.length ?? 0) === ${todo + 1}; })()`,
    "a new card in To do",
  );
  await page.reload();
  await page.waitForText("Inspection Gate", 60_000);
  const added = await page.eval(columns);
  if ((added["To do"]?.length ?? 0) !== todo + 1)
    fail(`after a reload To do holds ${added["To do"]?.length}, expected ${todo + 1}`);
  console.log("  Add task put a new card in To do, and it is still there after a reload");

  console.log("BROWSER OPERATIONS OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
