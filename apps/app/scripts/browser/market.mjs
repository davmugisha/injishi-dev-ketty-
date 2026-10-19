#!/usr/bin/env node
/**
 * The guest account's saved lists and the Explore heart, in a real browser: Sarah signs in, opens Saved on
 * /trips, creates a list that survives a reload, hearts a stay on /explore and finds it still saved after a
 * reload, then takes the heart off again. On the checkout she edits Your details: the new mobile number is
 * saved to her account and is still there after a reload (then put back). On the property page Report this
 * listing opens a real support ticket.
 *
 *   APP_URL=http://localhost:3040 node scripts/browser/market.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER MARKET OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");
const NAME = `Browser list ${Date.now().toString(36)}`;

/**
 * Opens a tab with a real pointer press (React Aria ignores a synthetic click()), pressing again until `ready`
 * holds: a press that lands before the page has hydrated does nothing, so one press is not proof either way.
 */
async function openTab(page, id, ready, what) {
  const until = Date.now() + 60_000;
  while (Date.now() < until) {
    const box = await page.eval(
      `(() => { const t = [...document.querySelectorAll('[role=tab]')].find((el) => el.getAttribute('data-key') === '${id}' || el.id.endsWith('${id}') || /${id}/i.test(el.innerText)); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
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
  throw new Error(`could not open the ${id} tab (${what})`);
}

/** The first stay heart that is not pressed, as its aria-label. */
const firstUnsaved = `(() => [...document.querySelectorAll('button[aria-label^="Save "]')].map((b) => b.getAttribute('aria-label'))[0] ?? null)()`;

const { page, close } = await launch();
try {
  await page.goto(`${APP}/api/demo/sign-in?persona=guest&next=/trips`);
  await page.waitFor("location.pathname === '/trips'", "/trips after signing in", 120_000);
  await page.waitForText("Upcoming", 120_000);
  console.log("  signed in as Sarah and landed on /trips");

  await openTab(page, "saved", "document.body.innerText.includes('New collection')", "the Saved tab's collections");
  await page.press("New collection");
  await page.waitFor("!!document.getElementById('new-col')", "the new collection field");
  await page.type("#new-col", NAME);
  await page.press("Create");
  await page.waitFor(
    `document.body.innerText.includes(${JSON.stringify(NAME)}) && !document.getElementById('new-col')`,
    "the new list to appear",
  );
  await page.reload();
  await page.waitForText("Upcoming", 60_000);
  await openTab(
    page,
    "saved",
    `document.body.innerText.includes(${JSON.stringify(NAME)})`,
    "the new list after the reload",
  );
  console.log(`  created "${NAME}" on the Saved tab, and it is still there after a reload`);

  await page.goto(`${APP}/explore`);
  await page.waitFor(`!!${firstUnsaved}`, "a stay that is not saved yet", 90_000);
  const label = await page.eval(firstUnsaved);
  const place = label.replace(/^Save /, "");
  await page.eval(`document.querySelector('button[aria-label=${JSON.stringify(label)}]').click()`);
  const removeLabel = `Remove ${place} from saved`;
  await page.waitFor(
    `!!document.querySelector('button[aria-label=${JSON.stringify(removeLabel)}]')`,
    `${place} to show as saved`,
  );
  await page.reload();
  await page.waitFor(
    `!!document.querySelector('button[aria-label=${JSON.stringify(removeLabel)}]')`,
    `${place} still saved after a reload`,
    90_000,
  );
  console.log(`  hearted ${place} on /explore, and it is still saved after a reload`);

  await page.eval(`document.querySelector('button[aria-label=${JSON.stringify(removeLabel)}]').click()`);
  await page.waitFor(
    `!!document.querySelector('button[aria-label=${JSON.stringify(label)}]')`,
    `${place} to show as unsaved`,
  );
  await page.reload();
  await page.waitFor(
    `!!document.querySelector('button[aria-label=${JSON.stringify(label)}]')`,
    `${place} still unsaved after a reload`,
    90_000,
  );
  console.log(`  took the heart off ${place}, and it stays off after a reload`);

  // Your details on the checkout: saved to her account (PUT /me/guest-contact), so a reload shows it.
  await page.goto(`${APP}/book`);
  await page.waitForText("Your details", 90_000);
  const summary = () =>
    page.eval(
      "[...document.querySelectorAll('h2')].find((h) => h.innerText.includes('Your details'))?.parentElement?.innerText ?? ''",
    );
  const was = ((await summary()).split(" · ").pop() ?? "").trim();
  const setMobile = async (value) => {
    await page.press("Edit");
    await page.waitFor("!!document.getElementById('ph')", "the mobile field");
    await page.eval("(() => { const el = document.getElementById('ph'); el.focus(); el.select(); })()");
    await page.send("Input.insertText", { text: value });
    await page.press("Done");
    await page.waitForText("Saved to your account", 30_000);
  };
  const MOBILE = "+250788400199";
  await setMobile(MOBILE);
  await page.reload();
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(MOBILE)})`, "the saved mobile after a reload", 90_000);
  console.log(`  Your details: mobile changed to ${MOBILE}, saved to her account, still there after a reload`);
  if (was && was !== MOBILE) await setMobile(was);

  // Report this listing: a support ticket about the place, its number on the page.
  const slug = await page.eval(
    `(document.querySelector('a[aria-label^="Back to"]')?.getAttribute('href') ?? '').split('/').pop()`,
  );
  if (!slug) throw new Error("no property link on the checkout");
  await page.goto(`${APP}/explore/${slug}`);
  await page.waitForText("Report this listing", 90_000);
  await page.press("Report this listing");
  await page.waitForText("Why are you reporting this listing?", 30_000);
  await page.press("Send report");
  await page.waitForText("Sent to Injishi support · ticket", 60_000);
  console.log(`  reported /explore/${slug}: a support ticket number came back`);

  console.log("BROWSER MARKET OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
