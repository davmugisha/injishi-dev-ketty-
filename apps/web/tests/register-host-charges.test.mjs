/**
 * The host funnel says what registering costs, and says it once.
 *
 * WHY THIS FILE EXISTS. `/host` answered "What does Injishi charge the host?"
 * with "Nothing ... no commission and no listing fee", while the registration
 * flow it leads into bills a one time fee. Its first step promised "Ten
 * minutes, no documents yet", while the flow checks an ID and a TIN on its
 * first two screens. The business model is three facts: a one time
 * registration fee, a monthly plan once live, and no commission. This keeps
 * both promises from coming back and keeps all three facts on the page.
 *
 * NO FIGURES. The fee is read from the API's `registration_fees` table and the
 * owner ruled that no screen before the pay step names it (2026-09-21), so
 * this also fails on a hand typed amount in the host content.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./ts-source-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../src");

const { HOST_FAQ, HOST_STEPS, HOST_CHARGES, HOST_BENEFITS } = await import("@/data/host");

/** Every word the host content puts on screen, as one lowercased string. */
const hostCopy = [
  ...HOST_FAQ.flatMap((g) => g.entries.flatMap((e) => [e.question, e.answer])),
  ...HOST_STEPS.flatMap((s) => [s.title, s.body]),
  ...HOST_BENEFITS.flatMap((b) => [b.title, b.body]),
  HOST_CHARGES.lede,
  ...HOST_CHARGES.items.flatMap((c) => [c.title, c.body]),
  HOST_CHARGES.stat.label,
]
  .join("\n")
  .toLowerCase();

/** Every source file that renders `/host` or the registration form. */
function funnelSources() {
  const roots = [
    "components/host",
    "app/(marketplace)/(site)/host",
    "app/(app)/(entry)/register",
  ];
  const files = ["data/host.ts"];
  const walk = (dir) => {
    for (const entry of readdirSync(join(SRC, dir), { withFileTypes: true })) {
      const rel = join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (/\.(tsx?|mjs)$/.test(entry.name)) files.push(rel);
    }
  };
  roots.forEach(walk);
  return files.map((f) => ({ file: f, text: readFileSync(join(SRC, f), "utf8") }));
}

describe("the promises that contradicted the flow", () => {
  test("no 'no listing fee' and no 'charges nothing' while registering bills a fee", () => {
    assert.doesNotMatch(hostCopy, /no listing fee/);
    assert.doesNotMatch(hostCopy, /\bcharge the host\?\s*\n\s*nothing\b/);
    const charge = HOST_FAQ.flatMap((g) => g.entries).find((e) => /charge/i.test(e.question));
    assert.ok(charge, "the FAQ lost its question about charges");
    assert.doesNotMatch(charge.answer, /^nothing\b/i);
  });

  test("no 'no documents yet' while the form checks an ID and a TIN", () => {
    for (const { file, text } of funnelSources()) {
      // Comments may quote the old line to explain why it went; rendered strings may not.
      const code = text
        .split(/\r?\n/)
        .filter((line) => !/^\s*(\*|\/\/|\{\/\*|\/\*)/.test(line))
        .join("\n")
        .toLowerCase();
      assert.doesNotMatch(code, /no documents yet/, `${file} still promises no documents`);
    }
  });

  test("step one says what to have to hand, and that only the certificates may wait", () => {
    const first = HOST_STEPS[0];
    assert.match(first.body, /\bID\b/);
    assert.match(first.body, /TIN/);
    assert.match(first.body, /certificates can wait/i);
    assert.match(first.body, /ten minutes/i);
  });
});

describe("/host states the charges plainly", () => {
  test("a one time registration fee, a monthly plan, and no commission", () => {
    const titles = HOST_CHARGES.items.map((c) => c.title.toLowerCase());
    assert.ok(titles.some((t) => /one time registration fee/.test(t)), titles.join(" | "));
    assert.ok(titles.some((t) => /monthly plan/.test(t)), titles.join(" | "));
    assert.ok(titles.some((t) => /no commission/.test(t)), titles.join(" | "));
  });

  test("the plan starts once live, and the fee is paid at the end of registering", () => {
    const plan = HOST_CHARGES.items.find((c) => c.icon === "plan");
    const fee = HOST_CHARGES.items.find((c) => c.icon === "fee");
    assert.match(plan.body, /once your listing is live/i);
    assert.match(fee.body, /last step/i);
  });

  test("the hero says both charges before the kind is chosen", () => {
    const hero = readFileSync(join(SRC, "components/host/host-hero.tsx"), "utf8").replace(/\s+/g, " ");
    assert.match(hero, /A one time registration fee, then a monthly plan once you are live\./);
    assert.match(hero, /href="#host-charges"/);
    const charges = readFileSync(join(SRC, "components/host/host-charges.tsx"), "utf8");
    assert.match(charges, /id="host-charges"/);
  });

  test("and names no amount: the fee is the API's, shown on the pay step only", () => {
    assert.doesNotMatch(hostCopy, /\brwf\b|\bfrw\b|\d{1,3}(,\d{3})+/);
  });
});
