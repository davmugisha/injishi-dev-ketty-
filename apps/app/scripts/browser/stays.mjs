#!/usr/bin/env node
/**
 * The Messages screen sends a reply through its server action and the API. The reply must remain
 * on the conversation after a reload, rather than only in the browser's state.
 *
 *   APP_URL=http://localhost:3042 node scripts/browser/stays.mjs
 *
 * Needs the app's dev server and a freshly seeded demo API. Prints "BROWSER STAYS OK" only after
 * the reply has been read back after a reload.
 */
import { launch } from "../lib/cdp.mjs";

const APP = (process.env.APP_URL ?? "http://localhost:3042").replace(/\/$/, "");
const { page, close } = await launch();

try {
  await page.goto(`${APP}/api/demo/sign-in?persona=frontdesk&next=${encodeURIComponent("/messages")}`);
  await page.waitFor("location.pathname === '/messages'", "Messages after signing in", 120_000);
  await page.waitForText("Guest Messages", 120_000);
  await page.waitFor(
    "document.querySelector('#draft') && !document.querySelector('#draft').disabled",
    "an open conversation",
  );
  // The initial development render can precede hydration. Typing must survive it before sending.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
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
  console.log("BROWSER STAYS OK");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  console.error(`  at ${await page.url().catch(() => "?")}`);
  process.exitCode = 1;
} finally {
  await close();
}
