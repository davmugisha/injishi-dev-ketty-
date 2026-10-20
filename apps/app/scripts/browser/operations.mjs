#!/usr/bin/env node
/**
 * The housekeeping board on real data, in a real browser: the manager opens /housekeeping, the board
 * comes from Postgres (no sample-data mark), Pass moves room 102 from "Clean · awaiting inspection" to
 * "Inspected", Add task puts a new card in "To do", and both survive a reload. On Lost & Found, "Log item"
 * writes the intake on the API and the reference the register gave it is listed after a reload; photos are not
 * kept, so the drop zone says so and no tag is claimed printed. On Distribution, "Retry now" says it is not
 * available and nothing is marked queued.
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

  // Lost and found: an intake goes to the API; the register's reference survives a reload.
  const ITEM = `Browser umbrella ${Date.now() % 100000}`;
  await page.goto(`${APP}/lost-found`);
  await page.waitForText("Log a Found Item", 120_000);
  await page.waitFor(
    `Object.keys([...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Log item") ?? {}).some((k) => k.startsWith("__reactProps"))`,
    "the register to hydrate",
    120_000,
  );
  if (!(await page.text()).includes("Not available yet: the register does not store photos"))
    fail("the photo drop zone does not say photos are not kept");
  if ((await page.text()).includes("print tag")) fail("the intake still claims to print a tag");
  const typed = await page.eval(`(() => {
    const l = [...document.querySelectorAll('label')].find((e) => e.innerText.trim() === 'What was found');
    const input = l?.closest('div')?.querySelector('input');
    if (!input) return false;
    input.focus();
    return document.activeElement === input;
  })()`);
  if (!typed) fail("no 'What was found' field");
  await page.send("Input.insertText", { text: ITEM });
  // Finder and custodian start as the signed-in person, never a sample name; the area starts empty.
  const you = (await page.text()).match(/([A-Z][A-Za-z'’ -]+?) \(you\)/)?.[1]?.trim();
  if (!you) fail("the finder and custodian do not start as the signed-in person");
  if ((await page.text()).includes("Emmanuel Nsengimana (")) fail("a sample finder is still offered as the default");
  const area = await page.eval(`(() => {
    const l = [...document.querySelectorAll('label')].find((e) => e.innerText.trim().startsWith('Room or area'));
    const input = l?.closest('div')?.querySelector('input');
    if (!input || input.value !== '') return false;
    input.focus();
    return document.activeElement === input;
  })()`);
  if (!area) fail("no empty 'Room or area' field");
  await page.send("Input.insertText", { text: "Lobby" });
  await page.press("Log item");
  await page.waitForText("Logged as LF-", 60_000);
  const ref = (await page.text()).match(/Logged as (LF-\d{2}-\d{3})/)?.[1];
  if (!ref) fail("no reference in the intake toast");
  await page.reload();
  await page.waitForText(ITEM, 90_000);
  if (!(await page.text()).includes(ref)) fail(`after a reload ${ref} is not on the register`);
  const row = await page.eval(
    `[...document.querySelectorAll('tr')].find((r) => r.innerText.includes(${JSON.stringify(ITEM)}))?.innerText ?? ""`,
  );
  if (row.split(you).length - 1 < 2) fail(`${ref} does not name ${you} as finder and custodian: ${row}`);
  console.log(
    `  Log item wrote ${ref} on the API (found by and held by ${you}); it is on the register after a reload, with no photo claimed`,
  );

  // Distribution is sample data: Retry now says so and nothing is marked queued.
  await page.goto(`${APP}/channels`);
  await page.waitForText("Retry now", 120_000);
  await page.waitFor(
    `Object.keys([...document.querySelectorAll("button")].find((b) => b.innerText.includes("Retry now")) ?? {}).some((k) => k.startsWith("__reactProps"))`,
    "the distribution screen to hydrate",
    120_000,
  );
  await page.press("Retry now");
  await page.waitForText("is not available yet", 30_000);
  if ((await page.text()).includes("Retry queued")) fail("Retry now still marks a retry as queued");
  await page.reload();
  await page.waitForText("Retry now", 90_000);
  console.log("  Retry now said it is not available; nothing was marked queued and the issue is still there");

  console.log("BROWSER OPERATIONS OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
