#!/usr/bin/env node
/**
 * The guest account's saved lists and the Explore heart, in a real browser: Sarah signs in, opens Saved on
 * /trips, creates a list that survives a reload, hearts a stay on /explore and finds it still saved after a
 * reload, then takes the heart off again. On the checkout she edits Your details: the new mobile number is
 * saved to her account and is still there after a reload (then put back). On the property page Report this
 * listing opens a real support ticket. Reserve then opens the checkout for the stay chosen on the page (its
 * dates are the checkout's), whose mobile money field starts empty or with her own phone, never a sample's
 * number; she types one and pays, and the payer shown is the number she typed (this books a stay on the mock rail).
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
  const MOBILE = was === "+250788400199" ? "+250788400188" : "+250788400199";
  await setMobile(MOBILE);
  await page.waitFor(`!document.getElementById('ph')`, "the details to close after saving", 30_000);
  await page.reload();
  await page.waitForText("Your details", 90_000);
  try {
    await page.waitFor(
      `document.body.innerText.includes(${JSON.stringify(MOBILE)})`,
      "the saved mobile after a reload",
      60_000,
    );
  } catch (error) {
    console.error(`  Your details read: ${await summary()}`);
    throw error;
  }
  console.log(`  Your details: mobile changed to ${MOBILE}, saved to her account, still there after a reload`);
  if (was && was !== MOBILE) await setMobile(was);

  // Report this listing: a support ticket about the place, its number on the page.
  const slug = await page.eval(
    `(document.querySelector('a[aria-label^="Back to"]')?.getAttribute('href') ?? '').split('/').pop()`,
  );
  if (!slug) throw new Error("no property link on the checkout");
  await page.goto(`${APP}/explore/${slug}`);
  await page.waitForText("Report this listing", 90_000);
  // The tab names this property (it said "Isangano Lakeside Hotel" on every one), and "Verified business" shows
  // only when the business card carries a verification date from the API.
  const head = await page.eval(`(() => {
    const name = document.querySelector('h1')?.innerText.trim() ?? '';
    const text = document.body.innerText;
    return { name, title: document.title, chip: text.includes('Verified business'), dated: /Verified [0-9]{1,2} [A-Z][a-z]{2} [0-9]{4}/.test(text) };
  })()`);
  if (!head.name || !head.title.startsWith(`Marketplace · ${head.name}`))
    throw new Error(`the property page is titled "${head.title}", not for ${head.name}`);
  if (head.chip && !head.dated) throw new Error("a Verified business chip with no verification date on the page");
  console.log(
    `  /explore/${slug} is titled for ${head.name}; Verified business ${head.chip ? "backed by a date" : "not shown, none recorded"}`,
  );
  await page.press("Report this listing");
  await page.waitForText("Why are you reporting this listing?", 30_000);
  await page.press("Send report");
  await page.waitForText("Sent to Injishi support · ticket", 60_000);
  console.log(`  reported /explore/${slug}: a support ticket number came back`);

  // Reserve carries the stay chosen on the property page (room, dates, party, plan) to the checkout.
  const reserve = await page.eval(
    `(() => { const a = [...document.querySelectorAll('a[href^="/book?"]')].find((el) => /Reserve|Request to book/.test(el.innerText)); return a ? a.getAttribute('href') : null; })()`,
  );
  if (!reserve) throw new Error("the property page offers no Reserve link with the chosen stay");
  const chosen = new URL(reserve, APP).searchParams;
  if (!chosen.get("room") || !chosen.get("in") || !chosen.get("out") || !chosen.get("adults")) {
    throw new Error(`Reserve does not carry the stay: ${reserve}`);
  }
  await page.goto(`${APP}${reserve}`);
  await page.waitForText("Your details", 90_000);
  const dayOf = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`);
    return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${d.getUTCDate()}`;
  };
  await page.waitFor(
    `(() => { const s = document.querySelector('aside[aria-label="Booking summary"]')?.innerText ?? ''; return s.includes(${JSON.stringify(dayOf(chosen.get("in")))}) && s.includes(${JSON.stringify(dayOf(chosen.get("out")))}); })()`,
    `the checkout summary to show ${chosen.get("in")} to ${chosen.get("out")}`,
    30_000,
  );
  console.log(`  Reserve opened the checkout for the chosen stay: ${chosen.get("in")} to ${chosen.get("out")}`);

  // The mobile money number is the person's own or empty, never a sample's; the payer shown is what was typed.
  const field = await page.eval(`document.querySelector('input[id^="msisdn-"]')?.value ?? null`);
  if (field === null) throw new Error("no mobile money number field on the checkout");
  if (field.replace(/\D/g, "").endsWith("8124417"))
    throw new Error(`the field starts with the sample number: ${field}`);
  await page.eval(`(() => { const el = document.querySelector('input[id^="msisdn-"]'); el.focus(); el.select(); })()`);
  await page.send("Input.insertText", { text: "078 300 1234" });
  const isRequest = await page.eval("/Request to book/.test(document.querySelector('h1')?.innerText ?? '')");
  await page.press(isRequest ? "Send request" : "Pay RWF");
  await page.waitFor(
    "/Approve on your phone|You’re booked!|Request sent/.test(document.body.innerText)",
    "the press of Pay to reach the API",
    60_000,
  );
  const shown = await page.eval("document.body.innerText");
  if (shown.includes("4417")) throw new Error("the sample number is shown after paying");
  if (!/783•+234|078 ••• 1234/.test(shown)) throw new Error("the payer shown is not the number typed");
  console.log("  the MoMo field started empty or with her own phone; the payer shown is the number she typed");

  console.log("BROWSER MARKET OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
