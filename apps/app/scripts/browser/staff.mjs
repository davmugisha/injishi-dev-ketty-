#!/usr/bin/env node
/**
 * The staff phone, in a real browser. Jeanne signs in with the demo code and works her current room on
 * /staff/task: she starts it, ticks a checklist step with a real press (the tick is `setRoomCheckAction`, so
 * it reaches the API) and finds it still ticked after a reload, then marks the room clean (through "Mark clean
 * anyway" when steps are left, which is the product's rule). Before that she logs a found item from a sheet that
 * opens empty (nothing pre-filled from an item already logged) and gets the register's reference back. She sends
 * a fault from /staff/report, whose form also opens empty (she picks where, what and how urgent), and gets a
 * real ticket number back; the leave form on /staff/schedule opens with no dates and no note. Beatrice then fails one check of that room on /staff/inspect with a photo taken on
 * the phone: the photo is uploaded (`POST /api/v1/uploads`) before "Return" is offered, and after the return
 * and a reload the room has left her queue. Jean-Paul's /staff/work-orders lists Jeanne's ticket.
 *
 *   APP_URL=http://localhost:3040 node scripts/browser/staff.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER STAFF OK" only when every step held.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fail = (message) => {
  throw new Error(message);
};

/** A real 32×24 PNG (a flat grey picture), so the phone can open, shrink and send it like a camera photo. */
function photoFile() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const width = 32;
  const height = 24;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // truecolour
  const rows = Buffer.alloc((width * 3 + 1) * height, 0x80);
  for (let y = 0; y < height; y++) rows[y * (width * 3 + 1)] = 0; // filter: none
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  const dir = mkdtempSync(path.join(os.tmpdir(), "ij-photo-"));
  const file = path.join(dir, "basin.png");
  writeFileSync(file, png);
  return { file, dir };
}

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

/** The checklist step's checkbox, by its label, as { checked, x, y } or null. */
const stepBox = (label) => `(() => {
  const input = [...document.querySelectorAll('input[type=checkbox]')].find((i) => {
    const l = i.closest('label');
    return l && l.innerText.trim() === ${JSON.stringify(label)};
  });
  if (!input) return null;
  const l = input.closest('label');
  l.scrollIntoView({ block: 'center' });
  const r = l.getBoundingClientRect();
  return { checked: input.checked, x: r.left + 24, y: r.top + r.height / 2 };
})()`;

/** A real pointer press at a point (React Aria ignores a synthetic click()). */
async function pressAt(page, { x, y }) {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
}

/** The centre of the first element matching `selector` (inside `within`) whose first line of text is `text`. */
const spotOf = (selector, text, within = "document") => `(() => {
  const el = [...${within}.querySelectorAll(${JSON.stringify(selector)})].find(
    (e) => ${text === null ? "true" : `e.innerText.trim().split('\\n')[0] === ${JSON.stringify(text)}`},
  );
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
})()`;

/** Press the element `spotOf` finds, waiting for it to be on screen. */
async function choose(page, selector, text, what, within) {
  await page.waitFor(`!!${spotOf(selector, text, within)}`, what, 30_000);
  await sleep(150);
  await pressAt(page, await page.eval(spotOf(selector, text, within)));
}

/** True when no option of the group labelled by `id` is chosen. */
const noneChosen = (id) =>
  `[...document.querySelectorAll('[aria-labelledby="${id}"] button, [aria-labelledby="${id}"] input')].every((e) => e.getAttribute('aria-checked') !== 'true' && e.getAttribute('aria-pressed') !== 'true' && !e.checked)`;

const { page, close } = await launch({ width: 420, height: 900 });
const photo = photoFile();
try {
  await signIn(page, "jeanne@app.demo.injishi.com", "/staff/task");
  await page.waitFor(
    "document.body.innerText.includes('Start cleaning room') || document.body.innerText.includes('Mark clean')",
    "her current room",
    120_000,
  );
  const room = await page.eval("(document.querySelector('h1')?.innerText.match(/Room (\\S+)/) ?? [])[1] ?? null");
  if (!room) fail("no room number in the task title");
  console.log(`  signed in as Jeanne and landed on room ${room}`);

  if ((await page.text()).includes("Start cleaning room")) await page.press("Start cleaning room");
  await page.waitForText("Mark clean", 60_000);

  // Tick the first step that is not ticked, with a real press, and wait for the API to have it.
  const label = await page.eval(`(() => {
    const input = [...document.querySelectorAll('input[type=checkbox]')].find((i) => !i.checked && i.closest('label'));
    return input ? input.closest('label').innerText.trim() : null;
  })()`);
  if (!label) fail("every checklist step is already ticked");
  const box = await page.eval(stepBox(label));
  await pressAt(page, box);
  await page.waitFor(`(${stepBox(label)})?.checked === true`, `"${label}" to show ticked`, 30_000);
  let held = false;
  for (let i = 0; i < 6 && !held; i++) {
    await sleep(2_000);
    await page.reload();
    await page.waitForText("Mark clean", 60_000);
    held = (await page.eval(stepBox(label)))?.checked === true;
  }
  if (!held) fail(`the tick on "${label}" did not survive a reload`);
  console.log(`  ticked "${label}" on room ${room}: still ticked after a reload (setRoomCheckAction reached the API)`);

  // Found an item: the sheet opens empty, and what she types and the spot she picks is what the register gets.
  await page.press("Found an item");
  const itemField = 'input[placeholder="Phone charger, white"]';
  await page.waitFor(`!!document.querySelector('${itemField}')`, "the found-item sheet", 30_000);
  await sleep(600);
  if ((await page.eval(`document.querySelector('${itemField}').value`)) !== "")
    fail("the found-item sheet opened with an item already filled in");
  if (!(await page.eval(noneChosen("fd-where")))) fail("the found-item sheet opened with a spot already chosen");
  const item = `Blue scarf ${Date.now() % 10_000}`;
  await page.type(itemField, item);
  await choose(page, '[aria-labelledby="fd-where"] button', "Wardrobe", "the Wardrobe spot");
  await page.press("Log the item");
  await page.waitFor(
    `document.body.innerText.includes(${JSON.stringify(item)}) && /LF-\\d/.test(document.body.innerText)`,
    "the logged item with the register's reference",
    60_000,
  );
  console.log(`  logged "${item}" from an empty sheet: the register's reference came back`);

  await page.press("Mark clean");
  await page.waitFor(
    "document.body.innerText.includes('Mark clean anyway') || document.body.innerText.includes('marked clean')",
    "the confirm sheet or the clean room",
    30_000,
  );
  if ((await page.text()).includes("Mark clean anyway")) {
    // The sheet slides up from the bottom of the phone: press once it has come to rest inside the window.
    await page.waitFor(
      `(() => {
        const b = [...document.querySelectorAll('button')].find((e) => e.innerText.trim() === 'Mark clean anyway');
        if (!b) return false;
        const r = b.getBoundingClientRect();
        const y = r.top + r.height / 2;
        const settled = window.__sheetY === y;
        window.__sheetY = y;
        return settled && y > 0 && y < window.innerHeight && document.elementFromPoint(r.left + r.width / 2, y) !== null;
      })()`,
      "the confirm sheet to settle",
      30_000,
    );
    await page.press("Mark clean anyway");
  }
  await page.waitForText(`Room ${room} marked clean`, 60_000);
  console.log(`  room ${room} marked clean (the unticked steps confirmed through "Mark clean anyway")`);

  const fault = `Socket by the lift sparks when used ${Date.now() % 10_000}`;
  await page.goto(`${APP}/staff/report`);
  await page.waitForText("Send report", 90_000);
  // The form opens empty: nothing is copied from a report she sent before.
  if ((await page.eval("document.querySelector('textarea').value")) !== "") fail("the report form opened pre-filled");
  for (const id of ["where-h", "cat-h", "sev-h"])
    if (!(await page.eval(noneChosen(id)))) fail(`the report form opened with "${id}" already chosen`);
  await choose(page, '[aria-labelledby="where-h"] button', null, "a place to report");
  await choose(page, '[aria-labelledby="cat-h"] button', "Electrical", "the Electrical category");
  // The group item itself has no box (display: contents); its label is what a finger presses.
  await choose(page, '[aria-labelledby="sev-h"] [data-slot="radio-content"]', "Today", "the Today urgency");
  await page.type("textarea", fault);
  await page.press("Send report");
  await page.waitForText("Sent to maintenance", 60_000);
  const ticket = (await page.text()).match(/WO-\d+/)?.[0];
  if (!ticket) fail("the report was sent but no WO- ticket number came back");
  console.log(`  the fault became ${ticket} through the API, from a form she filled in herself`);

  // The leave form opens with no dates and no note (no sample draft).
  await page.goto(`${APP}/staff/schedule`);
  await page.waitForText("My schedule", 90_000);
  await page.press("Leave");
  await page.waitForText("Ask for leave", 30_000);
  const leaveForm = await page.eval(`(() => {
    const from = document.querySelector('input[placeholder="15 Dec 2026"]');
    const to = document.querySelector('input[placeholder="19 Dec 2026"]');
    const note = [...document.querySelectorAll('textarea')][0];
    return from && to ? [from.value, to.value, note ? note.value : ''].join('|') : null;
  })()`);
  if (leaveForm !== "||") fail(`the leave form did not open empty: ${leaveForm}`);
  console.log("  the leave form opens with no dates and no note");

  // Beatrice inspects the room Jeanne just cleaned, fails one check and photographs it.
  await page.goto(`${APP}/api/demo/sign-in?persona=supervisor&next=/staff/inspect`);
  await page.waitFor("location.pathname === '/staff/inspect'", "/staff/inspect as Beatrice", 120_000);
  await page.waitForText("Checklist", 90_000);
  const pick = await page.eval(`(() => {
    const b = [...document.querySelectorAll('[role=radio], button')].find((e) => e.innerText.trim().split('\\n')[0] === ${JSON.stringify(room)});
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!pick) fail(`room ${room} is not in Beatrice's inspection queue`);
  await pressAt(page, pick);
  await page.waitFor(
    `[...document.querySelectorAll('h2')].some((h) => h.innerText.trim() === 'Room ${room}')`,
    `room ${room} open for inspection`,
    30_000,
  );
  await page.press("Fail");
  await page.waitForText("Add a photo of the problem", 30_000);
  // The camera is the file input: its chooser is intercepted and the photo handed to it, as a phone's camera would.
  await page.send("DOM.enable");
  await page.send("Page.setInterceptFileChooserDialog", { enabled: true });
  await page.press("Add a photo of the problem");
  const input = await page.send("Runtime.evaluate", { expression: "document.querySelector('input[type=file]')" });
  await page.send("DOM.setFileInputFiles", { files: [photo.file], objectId: input.result.objectId });
  await page.waitForText("Photo added", 60_000);
  console.log("  Beatrice failed a check and the photo she took was stored by the API");

  await page.press("Return to Jeanne");
  await page.waitForText("Returned to", 60_000);
  const history = await page.text();
  if (!/1 photo/.test(history)) fail("the room history does not name the photo that was sent");
  await sleep(1_500);
  await page.reload();
  await page.waitFor(
    `!document.body.innerText.includes('Checklist') || ![...document.querySelectorAll('[role=radio], button')].some((e) => e.innerText.trim().split('\\n')[0] === ${JSON.stringify(room)})`,
    `room ${room} to have left the queue after a reload`,
    60_000,
  );
  console.log(`  returned with the photo: room ${room} left the inspection queue and stays gone after a reload`);

  await page.goto(`${APP}/api/demo/sign-in?persona=technician&next=/staff/work-orders`);
  await page.waitFor("location.pathname === '/staff/work-orders'", "/staff/work-orders as Jean-Paul", 120_000);
  // The phone opens on one order; the list is behind "Back to my work orders".
  const back = `(() => {
    const b = document.querySelector('button[aria-label="Back to my work orders"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  })()`;
  await page.waitFor(`!!${back}`, "the back button to the work order list", 120_000);
  await pressAt(page, await page.eval(back));
  await page.waitForText("My work orders", 30_000);
  await page.waitForText(ticket, 60_000);
  console.log(`  Jean-Paul's work orders list ${ticket}`);

  console.log("BROWSER STAFF OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
  rmSync(photo.dir, { recursive: true, force: true });
}
