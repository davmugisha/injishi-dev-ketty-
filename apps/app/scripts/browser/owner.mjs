#!/usr/bin/env node
/**
 * The owner's Team and Roles screen in a real browser: Didier signs in, the members come from Postgres
 * (the open invitation and the revoked member the seed wrote among them), he invites somebody to the lodge,
 * the invitation is on the list after a reload, and cancelling it from Manage Member makes it read
 * "Revoked" after another reload. Every write went through the API (`POST /ops/team/invitations`,
 * `POST /ops/team/invitations/:id/revoke`).
 *
 *   APP_URL=http://localhost:3040 node scripts/browser/owner.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER OWNER OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");
const NAME = `Browser Invitee ${Date.now() % 100000}`;
const EMAIL = `browser.invitee.${Date.now()}@app.demo.injishi.com`;

const fail = (message) => {
  throw new Error(message);
};

/** Text of the members table, row by row. */
const rows = `[...document.querySelectorAll('table[aria-label="Members"] tbody tr, [aria-label="Members"] [role=row]')].map((r) => r.innerText.replace(/\\s+/g, ' '))`;

const { page, close } = await launch();

/** Focus the input of the field labelled `label` and type into it as a person would. */
async function fill(label, text) {
  const ok = await page.eval(`(() => {
    const l = [...document.querySelectorAll('label')].find((e) => e.innerText.trim().startsWith(${JSON.stringify(label)}));
    const field = l?.closest('[data-slot="text-field"], .text-field, div');
    const input = field?.querySelector('input, textarea') ?? (l?.htmlFor ? document.getElementById(l.htmlFor) : null);
    if (!input) return false;
    input.scrollIntoView({ block: 'center' });
    input.focus();
    return document.activeElement === input;
  })()`);
  if (!ok) fail(`no field labelled "${label}"`);
  await page.send("Input.insertText", { text });
}

/** Click the centre of the first visible element matching `selector` whose text contains `text`. */
async function click(selector, text = "") {
  const box = await page.eval(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && e.innerText.includes(${JSON.stringify(text)});
    });
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const x = r.left + Math.min(r.width / 2, 12), y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hits: !!hit && (el === hit || el.contains(hit)), hit: hit ? hit.tagName + '.' + hit.className : null };
  })()`);
  if (!box) fail(`nothing to click: ${selector} "${text}"`);
  if (!box.hits) fail(`${selector} "${text}" is covered by ${box.hit}`);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
  }
}

try {
  await page.goto(`${APP}/api/demo/sign-in?persona=owner&next=/settings/team`);
  await page.waitFor("location.pathname === '/settings/team'", "/settings/team after signing in", 120_000);
  await page.waitForText("Team and Roles", 120_000);
  await page.waitForText("Jacques Mugabo", 60_000);
  const seeded = (await page.eval(rows)).join("\n");
  for (const name of ["Didier Mugenzi", "Beatrice Mukandori", "Solange Uwimana", "Emmanuel Nkusi"])
    if (!seeded.includes(name)) fail(`${name} is not on the team`);
  if (!/Jacques Mugabo.*Invited/.test(seeded)) fail("Jacques Mugabo is not listed as invited");
  console.log("  signed in as Didier: the team, the open invitation and the revoked member come from Postgres");

  // The invite panel opens with the screen; fill it as the owner would.
  await page.waitForText("Invite a Member", 30_000);
  await fill("Full name", NAME);
  await fill("Email or mobile", EMAIL);
  await click("label", "Ishyamba Forest Lodge");
  await fill("Verify it", "123456");
  await page.press("Send invite");
  await page.waitForText(`Invite sent to ${NAME}`, 60_000);
  await page.reload();
  await page.waitForText(NAME, 90_000);
  const invited = (await page.eval(rows)).find((r) => r.includes(NAME)) ?? "";
  if (!/Invited/.test(invited) || !invited.includes("Ishyamba"))
    fail(`after a reload the invitation reads: ${invited}`);
  console.log(`  invited ${NAME} to Ishyamba: on the list after a reload (${invited.slice(0, 90)}…)`);

  // The invite panel opens with every visit; close it so the table is reachable.
  await page.press("Cancel");
  await page.waitFor("!document.body.innerText.includes('Invite a Member')", "the invite panel to close", 30_000);
  await click(`button[aria-label="Manage ${NAME}"]`);
  await page.waitForText("Manage Member", 30_000);
  await page.press("Cancel invite");
  await page.waitForText(`${NAME}: invite cancelled`, 60_000);
  await page.reload();
  await page.waitForText(NAME, 90_000);
  const cancelled = (await page.eval(rows)).find((r) => r.includes(NAME)) ?? "";
  if (!/Revoked/.test(cancelled) || !/Invite cancelled/.test(cancelled))
    fail(`after a reload the cancelled invitation reads: ${cancelled}`);
  console.log("  Cancel invite revoked it on the API: it reads Revoked after a reload");

  console.log("BROWSER OWNER OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
