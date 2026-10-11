/**
 * Ordering from a conversation must happen IN the conversation.
 *
 * It used to be a link. `conversation-screen.tsx` rendered
 * `<Link href="/stay/order?thread=…">`, which took the guest to a 650 line menu
 * screen on another route and pushed them back afterwards. Two things were
 * wrong with that and only one of them is cosmetic: the conversation was lost
 * from under them mid-sentence, and whether to offer the button at all was
 * decided in the browser from the thread's `scope` and `kind` rather than asked
 * of the server — so a guest sitting in room 204 with a reservation thread open
 * was told nothing could be ordered while `GET /me/orderable` would have
 * answered with an outlet.
 *
 * WHY THIS IS A `.check.mjs` AND NOT A `.test.mjs`: the app's own run is
 * `node --test "tests/*.test.mjs"`, and this is a gate on the shape of the
 * source rather than a unit of behaviour. `node --test` must not pick it up.
 *
 * WHY IT ASSERTS BOTH DIRECTIONS. An absence check alone ("nothing links to
 * /stay/order") passes on an app that has no ordering at all, which is the
 * failure mode it exists to catch. So it also proves the replacement is there
 * and wired end to end: the composer exists, it asks the server whether to
 * offer anything, it reaches the order client, and the conversation screen
 * mounts it.
 *
 * WHY IT READS CODE AND NOT PROSE. These files carry long comments that name
 * `/stay/order` in order to explain what changed and why — this one included.
 * A grep over raw text would fail on its own explanation, so comments are
 * stripped before the scan and only code is searched.
 *
 * THE POSITIVE CONTROL. An absence check that has never failed is not
 * evidence. Pass a directory to scan instead of the real one and this runs
 * against that tree:
 *
 *     git --work-tree=<tmp> checkout HEAD -- apps/web/src/components/app
 *     node apps/web/tests/no-order-navigation.check.mjs <tmp>/apps/web/src/components/app
 *
 * against the commit before this change, it must exit non-zero.
 *
 * Run: node apps/web/tests/no-order-navigation.check.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(here, "..");

/** The tree to judge. Overridable so the check can be run against a control. */
const APP_COMPONENTS = process.argv[2]
  ? resolve(process.argv[2])
  : join(WEB, "src", "components", "app");

const CONVERSATION = join(APP_COMPONENTS, "conversation-screen.tsx");
const COMPOSER = join(APP_COMPONENTS, "order-composer.tsx");
const DRAFT = join(APP_COMPONENTS, "order-draft.ts");

/** The route the guest used to be sent to. Nothing in a conversation may. */
const ORDER_ROUTE = "/stay/order";

/** Problems found, each already a sentence a reader can act on. */
const problems = [];
const show = (file) => relative(WEB, file).replace(/\\/g, "/") || file;

function read(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/**
 * The source with its comments blanked out, line numbers preserved.
 *
 * Strings are tracked only so that `//` inside one (`"http://…"`) is not read
 * as the start of a comment. Everything else is copied through, so a real
 * `href="/stay/order"` survives and the sentence explaining it does not.
 */
function codeOnly(src) {
  let out = "";
  let state = "code";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];

    if (state === "code") {
      if (c === "/" && d === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "/" && d === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "`") state = "template";
      out += c;
      i += 1;
      continue;
    }

    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
      }
      i += 1;
      continue;
    }

    if (state === "block") {
      if (c === "*" && d === "/") {
        state = "code";
        i += 2;
        continue;
      }
      // Newlines are kept so a reported line number still points at the file.
      if (c === "\n") out += c;
      i += 1;
      continue;
    }

    // Inside a string of some kind.
    if (c === "\\") {
      out += c + (d ?? "");
      i += 2;
      continue;
    }
    if (
      (state === "single" && c === "'") ||
      (state === "double" && c === '"') ||
      (state === "template" && c === "`")
    ) {
      state = "code";
    }
    out += c;
    i += 1;
  }
  return out;
}

/** 1-based line numbers where `needle` occurs in the CODE of `src`. */
function codeLinesWith(src, needle) {
  const hits = [];
  codeOnly(src)
    .split("\n")
    .forEach((line, i) => {
      if (line.includes(needle)) hits.push(i + 1);
    });
  return hits;
}

/** Every `.ts`/`.tsx` under a directory, recursively. */
function sources(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The floor: a scan that reaches nothing passes everything.
// ---------------------------------------------------------------------------

const files = sources(APP_COMPONENTS);
if (files.length < 10) {
  problems.push(
    `The scan found only ${files.length} source files under ${show(APP_COMPONENTS)}. ` +
      `The walker or the folder moved, so neither assertion below means anything.`,
  );
}

// ---------------------------------------------------------------------------
// 1. Nothing in the signed-in app components routes a guest to /stay/order.
// ---------------------------------------------------------------------------

for (const file of files) {
  const src = read(file);
  if (src === null) continue;
  for (const line of codeLinesWith(src, ORDER_ROUTE)) {
    problems.push(
      `${show(file)}:${line} still sends the guest to ${ORDER_ROUTE}. Ordering from ` +
        `a conversation happens in the conversation; the menu-first path from ` +
        `/stay keeps that screen, but nothing under components/app may navigate ` +
        `to it to place an order.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. The replacement exists, reaches the order client, and is mounted.
// ---------------------------------------------------------------------------

const conversation = read(CONVERSATION);
if (conversation === null) {
  problems.push(`${show(CONVERSATION)} is missing; there is no conversation screen to check.`);
} else if (!/<OrderComposer\b/.test(codeOnly(conversation))) {
  problems.push(
    `${show(CONVERSATION)} does not mount <OrderComposer>. Without it the ` +
      `conversation has no way to order, and the absence check above is ` +
      `satisfied by having DELETED ordering rather than by having moved it.`,
  );
}

const composer = read(COMPOSER);
if (composer === null) {
  problems.push(
    `${show(COMPOSER)} does not exist. The in-chat composer is the whole point of this gate.`,
  );
} else {
  const code = codeOnly(composer);

  // Whether to offer ordering is the server's answer, not the thread's shape.
  if (!/\bfetchOrderable\b/.test(code)) {
    problems.push(
      `${show(COMPOSER)} never calls fetchOrderable. Whether a thread may be ` +
        `ordered into is GET /me/orderable?propertyId=…'s verdict — guessing it ` +
        `from the thread's scope and kind is the bug this gate replaced.`,
    );
  }

  // It must place the order itself: directly, or through the shared draft hook
  // that owns the request shape and the idempotency key. The chain to
  // `placeOrder` is then checked at the other end, below.
  const direct = /\bplaceOrder\b/.test(code);
  const viaDraft = /\buseOrderDraft\b/.test(code);
  if (!direct && !viaDraft) {
    problems.push(
      `${show(COMPOSER)} reaches neither placeOrder nor useOrderDraft, so it ` +
        `cannot be placing an order in place. Ordering must go through ` +
        `@/data/ordering, which owns the request shape and the idempotency key.`,
    );
  }
  if (viaDraft && !direct) {
    const draft = read(DRAFT);
    if (draft === null) {
      problems.push(
        `${show(COMPOSER)} delegates to useOrderDraft but ${show(DRAFT)} does not ` +
          `exist, so the chain to the order client is broken.`,
      );
    } else if (!/\bplaceOrder\b/.test(codeOnly(draft))) {
      problems.push(
        `${show(DRAFT)} never calls placeOrder, so nothing the composer delegates ` +
          `to actually places an order.`,
      );
    }
  }

  // Placing must not navigate: no router push, no redirect, no location write.
  for (const [file, label] of [
    [COMPOSER, "composer"],
    [DRAFT, "shared order draft"],
  ]) {
    const src = read(file);
    if (src === null) continue;
    const navigation = ["useRouter", "router.push", "router.replace", "window.location"].flatMap(
      (needle) => codeLinesWith(src, needle).map((line) => `${needle} (line ${line})`),
    );
    if (navigation.length > 0) {
      problems.push(
        `${show(file)} navigates — ${navigation.join(", ")}. The ${label} places the ` +
          `order and stays where it is; the conversation gains the system line and ` +
          `the order card without a page change.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------

if (problems.length > 0) {
  console.error("IN CHAT ORDERING: NOT PROVEN\n");
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

console.log(`Scanned ${files.length} files under ${show(APP_COMPONENTS)}.`);
console.log("IN CHAT ORDERING: NO NAVIGATION AWAY");
