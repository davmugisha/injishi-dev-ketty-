/**
 * A dependency-free browser for verify scripts: headless Chromium driven over the DevTools protocol with
 * Node 22's global WebSocket. No playwright module is installed here; its cached Chromium is enough.
 *
 * Presses use real pointer events (Input.dispatchMouseEvent): HeroUI is React Aria, whose usePress
 * ignores a synthetic element.click(), so a click() "passing" proves nothing.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = path.join(os.homedir(), "AppData/Local/ms-playwright");
  const candidates = existsSync(root)
    ? readdirSync(root)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort()
        .reverse()
    : [];
  for (const dir of candidates) {
    for (const exe of ["chrome-win64/chrome.exe", "chrome-win/chrome.exe", "chrome-linux/chrome"]) {
      const p = path.join(root, dir, exe);
      if (existsSync(p)) return p;
    }
  }
  throw new Error("No Chromium found: set CHROMIUM_PATH");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** `args`: extra Chromium switches, e.g. the host mapping `prod-stack.mjs` needs. */
export async function launch({ width = 1280, height = 900, args = [] } = {}) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(path.join(os.tmpdir(), "ij-cdp-"));
  const proc = spawn(
    findChromium(),
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--disable-gpu",
      "--force-prefers-reduced-motion",
      "--force-device-scale-factor=1",
      ...args,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    await sleep(100);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch {}
  }
  if (!target) throw new Error("Chromium did not open a page target");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let next = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = next++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

  const page = {
    send,
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails)
        throw new Error(`page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    },
    async goto(url) {
      const loaded = new Promise((resolve) => {
        const l = (m) => {
          if (m.method === "Page.loadEventFired") {
            listeners.delete(l);
            resolve();
          }
        };
        listeners.add(l);
      });
      await send("Page.navigate", { url });
      await Promise.race([loaded, sleep(60_000)]);
    },
    async reload() {
      await page.goto(await page.eval("location.href"));
    },
    url: () => page.eval("location.href"),
    text: () => page.eval("document.body ? document.body.innerText : ''"),
    /** Wait until a page expression is truthy. */
    async waitFor(expression, what, timeout = 60_000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        try {
          if (await page.eval(expression)) return;
        } catch {}
        await sleep(250);
      }
      throw new Error(`timed out waiting for ${what}`);
    },
    waitForText: (text, timeout) =>
      page.waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`, `"${text}"`, timeout),
    /** Press the nth visible, enabled button labelled exactly `label` (else containing it), with real pointer events. */
    async press(label, { within = "document", nth = 0 } = {}) {
      const find = `(() => {
        const candidates = (root, label) => {
          const visible = [...root.querySelectorAll('button, [role=button], a')].filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && !e.disabled && e.getAttribute('aria-disabled') !== 'true';
          });
          const exact = visible.filter((e) => e.innerText.trim() === label);
          return exact.length ? exact : visible.filter((e) => e.innerText.trim().includes(label));
        };
        const el = candidates(${within}, ${JSON.stringify(label)})[${nth}];
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        return true;
      })()`;
      // A control that is mid-transition is disabled; give it time to come back before calling it missing.
      const until = Date.now() + 30_000;
      while (!(await page.eval(find))) {
        if (Date.now() > until) throw new Error(`no visible, enabled button "${label}"`);
        await sleep(250);
      }
      await sleep(150);
      const box = await page.eval(`(() => {
        const candidates = (root, label) => {
          const visible = [...root.querySelectorAll('button, [role=button], a')].filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && !e.disabled && e.getAttribute('aria-disabled') !== 'true';
          });
          const exact = visible.filter((e) => e.innerText.trim() === label);
          return exact.length ? exact : visible.filter((e) => e.innerText.trim().includes(label));
        };
        const el = candidates(${within}, ${JSON.stringify(label)})[${nth}];
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, hits: !!hit && (el === hit || el.contains(hit)), hit: hit ? hit.tagName + '.' + hit.className : null };
      })()`);
      if (!box.hits) throw new Error(`"${label}" is covered by ${box.hit}`);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
      }
    },
    /** Focus the element and type into it as a person would. */
    async type(selector, text) {
      const ok = await page.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); return true; })()`,
      );
      if (!ok) throw new Error(`no element ${selector}`);
      await send("Input.insertText", { text });
    },
    async cookies() {
      return (await send("Network.getAllCookies")).cookies;
    },
  };

  return {
    page,
    async close() {
      try {
        await send("Browser.close");
      } catch {}
      proc.kill();
      await sleep(300);
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
}
