#!/usr/bin/env node
/**
 * The housekeeper's phone, honest about what it can do (real-data 1.5.2):
 *   - with ?offline=1 the board says nothing is saved on the phone, and Start cleaning / Mark clean are disabled;
 *   - a press the API refuses (the room was finished on another device while this screen was open) shows the
 *     API's words in a toast and leaves the board readable, instead of breaking the page;
 *   - presses the API accepts (Start cleaning, then Mark clean) survive a reload.
 *
 * It works on two rooms the manager puts on Jeanne's board for the run, at the top, and leaves both finished, so
 * the seeded rooms (staff-board.mjs) are untouched.
 *
 *   APP_URL=http://localhost:3062 INJISHI_API_URL=http://localhost:8062 node scripts/browser/platform.mjs
 *
 * Needs the app's dev server (pointed at a demo API) and a freshly seeded interface world. Prints
 * "BROWSER PLATFORM OK" only when every step held.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3040").replace(/\/$/, "");
const API = (process.env.INJISHI_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const ORIGIN = (process.env.INJISHI_API_ORIGIN ?? APP).replace(/\/$/, "");
const CODE = process.env.INJISHI_DEMO_CODE ?? "123456";

const fail = (message) => {
  throw new Error(message);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** An API session as another device would hold it: the demo code, through Better Auth. */
async function apiSession(email) {
  const post = (path, body) =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify(body),
    });
  await post("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  const signed = await post("/api/auth/sign-in/email-otp", { email, otp: CODE });
  if (!signed.ok) fail(`${email} could not sign in on the API: HTTP ${signed.status}`);
  const cookie = signed.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => /session_(token|data)=/.test(c))
    .join("; ");
  const get = async (path) => (await fetch(`${API}${path}`, { headers: { cookie, origin: ORIGIN } })).json();
  const { workspaces } = await get("/api/v1/me/workspaces");
  const ws = workspaces.find((w) => w.kind === "business" && w.domain === "hospitality");
  if (!ws) fail(`${email} holds no hotel workspace`);
  const { user } = await get("/api/auth/get-session");
  const call = async (method, path, body) => {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: {
        cookie,
        origin: ORIGIN,
        "x-workspace-id": ws.workspaceId,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, body: text ? JSON.parse(text) : null };
  };
  return { call, userId: user.id };
}

/** The room numbers of the cards still waiting to start, in board order. */
const waiting = `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Start cleaning').map((b) => {
  let el = b;
  while (el && !/\\b\\d{3}\\b/.test(el.innerText)) el = el.parentElement;
  return el?.innerText.match(/\\b\\d{3}\\b/)?.[0] ?? null;
})`;
const hydrated = (label) =>
  `Object.keys([...document.querySelectorAll("button")].find((b) => b.innerText.trim() === ${JSON.stringify(label)}) ?? {}).some((k) => k.startsWith("__reactProps"))`;

const { page, close } = await launch({ width: 430, height: 900 });
try {
  const manager = await apiSession("aline@app.demo.injishi.com");
  const jeanne = await apiSession("jeanne@app.demo.injishi.com");

  // Two rooms at the top of Jeanne's board for this run.
  const { body: roomList } = await manager.call("GET", "/api/v1/ops/rooms");
  const made = [];
  for (const label of ["210", "212", "305", "306", "307", "308", "309", "310"]) {
    if (made.length === 2) break;
    const room = roomList.rooms.find((r) => r.label === label);
    if (!room) continue;
    const created = await manager.call("POST", "/api/v1/ops/housekeeping-tasks", {
      roomId: room.id,
      taskType: "checkout_clean",
      assignedToUserId: jeanne.userId,
      priority: 95 - made.length * 5,
      note: "Due 15:00 · browser check",
    });
    if (created.ok) made.push({ id: created.body.id, room: label });
  }
  if (made.length !== 2) fail(`could not put two rooms on Jeanne's board: ${JSON.stringify(made)}`);
  const [stale, fresh] = made;
  console.log(`  the manager put rooms ${stale.room} and ${fresh.room} at the top of Jeanne's board`);

  await page.goto(`${APP}/api/demo/sign-in?persona=housekeeper&next=${encodeURIComponent("/staff?offline=1")}`);
  await page.waitFor("location.pathname === '/staff'", "/staff after signing in", 120_000);
  await page.waitForText("No connection", 120_000);
  const offline = await page.text();
  if (!offline.includes("Nothing is saved on this phone")) fail("the offline banner does not say nothing is saved");
  if (/saved on this phone\. They send/.test(offline)) fail("the offline banner still claims updates are saved");
  const pressable = await page.eval(
    "[...document.querySelectorAll('button')].filter((b) => /Start cleaning|Mark clean/.test(b.innerText) && !b.disabled && b.getAttribute('aria-disabled') !== 'true').length",
  );
  if (pressable !== 0) fail(`${pressable} room buttons are still pressable while offline`);
  console.log("  offline: the banner says nothing is saved on the phone, and no room can be started or finished");

  await page.goto(`${APP}/staff`);
  await page.waitForText("Done today", 90_000);
  await page.waitFor(hydrated("Start cleaning"), "the board to hydrate", 120_000);
  const rooms = await page.eval(waiting);
  if (rooms[0] !== stale.room || rooms[1] !== fresh.room)
    fail(`the board does not open on ${stale.room} then ${fresh.room}: ${JSON.stringify(rooms)}`);

  // Another device finishes the first room while this screen still offers "Start cleaning" for it.
  for (const to of ["in_progress", "done"]) {
    const moved = await jeanne.call("POST", `/api/v1/ops/housekeeping-tasks/${stale.id}/advance`, { to });
    if (!moved.ok) fail(`the other device could not move ${stale.room} to ${to}: HTTP ${moved.status}`);
  }
  console.log(`  room ${stale.room} was finished on another device while this screen still offered Start cleaning`);

  await page.press("Start cleaning");
  await page.waitForText("cannot go straight to", 60_000);
  if (!(await page.text()).includes("Done today")) fail("the board broke after the refusal");
  console.log("  Start cleaning on the stale card showed the API's refusal in a toast; the board stayed up");

  await page.reload();
  await page.waitForText("Done today", 90_000);
  await page.waitFor(hydrated("Start cleaning"), "the board to hydrate again", 120_000);
  const after = await page.eval(waiting);
  if (after.includes(stale.room)) fail(`after a reload room ${stale.room} still waits to start`);
  if (after[0] !== fresh.room) fail(`room ${fresh.room} is not first after the reload: ${JSON.stringify(after)}`);

  /** Wait for the API to hold the task in this state (the action's round trip), before any reload. */
  const until = async (to) => {
    for (let i = 0; i < 60; i++) {
      const { body } = await jeanne.call("GET", "/api/v1/ops/housekeeping-tasks");
      if (body.tasks.find((t) => t.id === fresh.id)?.status === to) return;
      await pause(500);
    }
    fail(`room ${fresh.room} never reached ${to} on the API`);
  };
  await page.press("Start cleaning");
  await until("in_progress");
  await page.reload();
  await page.waitFor(hydrated("Mark clean"), "Mark clean after a reload", 120_000);
  console.log(`  Start cleaning on room ${fresh.room} went through the API and still reads Mark clean after a reload`);

  await page.press("Mark clean");
  await until("done");
  await page.reload();
  await page.waitForText("Done today", 90_000);
  await page.waitFor(hydrated("Start cleaning"), "the board to hydrate once more", 120_000);
  if ((await page.eval(waiting)).includes(fresh.room)) fail(`after Mark clean room ${fresh.room} still waits`);
  console.log(`  Mark clean finished room ${fresh.room}; after a reload it has left the list`);

  console.log("BROWSER PLATFORM OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
