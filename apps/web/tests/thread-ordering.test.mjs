/**
 * Whether a conversation may be ordered into, and from which outlets.
 *
 * THE BUG THIS PINS was one line in `conversation-screen.tsx`:
 *
 *     thread.status === "active" && (thread.scope === "stay" || thread.kind === "department_request")
 *
 * a guess made in the browser out of two fields that describe what a thread IS,
 * not what its reader may do. Samuel was in house at Amahoro with his own
 * booking's `reservation` thread open and was offered nothing, while
 * `GET /me/orderable` answered for him with an outlet. The reservation case
 * below is that person, and it is the reason this file exists.
 *
 * THIS TEST RUNS THE REAL FUNCTION, the way `safe-redirect.test.mjs` does: the
 * source is read, transpiled and evaluated. The module imports nothing at
 * runtime — every import in it is `import type`, which TypeScript erases — so
 * there is nothing to stub, and what runs here is exactly what the screen runs.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadThreadOrdering() {
  const path = resolve(here, "../src/lib/thread-ordering.ts");
  const src = readFileSync(path, "utf8");

  const valueImports = [...src.matchAll(/^import\s+(?!type\b)/gm)];
  assert.equal(
    valueImports.length,
    0,
    "thread-ordering.ts gained a runtime import; this loader evaluates it standalone and must be taught to stub that import.",
  );

  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { threadOrdering, mayAskOrderable } = await loadThreadOrdering();

const AMAHORO = "aaaaaaaa-0000-4000-8000-000000000001";
const SERENA = "bbbbbbbb-0000-4000-8000-000000000002";

/** A thread, as the screen holds it. Only two fields decide anything. */
const thread = (over = {}) => ({
  id: "77777777-0000-4000-8000-000000000007",
  scope: "booking",
  subjectId: "88888888-0000-4000-8000-000000000008",
  kind: "reservation",
  status: "active",
  propertyId: AMAHORO,
  propertyName: "Amahoro Boutique Hotel",
  departmentName: null,
  lastMessageAt: null,
  lastMessagePreview: null,
  messageCount: 0,
  unreadCount: 0,
  ...over,
});

const outlet = (propertyId, name) => ({
  id: `outlet-${name}`,
  name,
  propertyId,
  propertyName: "somewhere",
  outletKind: "restaurant",
  chargeToRoom: true,
  payNow: true,
  hours: null,
  operatorLabel: null,
  categories: [],
});

/** What `fetchOrderable` came back with. */
const answered = (outlets) => ({ status: "ok", data: { outlets } });

describe("a reservation thread is offered ordering when the server says so", () => {
  // The case that used to be refused out of hand. `kind` is `reservation` and
  // `scope` is `booking` — the exact shape the old line rejected — and the
  // guest is in house, so the server answers with an outlet.
  const ordering = threadOrdering(thread(), answered([outlet(AMAHORO, "Ikigugu Café")]));

  test("it is offered", () => {
    assert.equal(ordering.state, "offered");
  });

  test("with the outlet the server named", () => {
    assert.deepEqual(ordering.outlets.map((o) => o.name), ["Ikigugu Café"]);
  });

  test("the thread's own shape decides nothing", () => {
    // Every kind and scope reaches the same verdict, because the verdict is
    // the server's. If this ever stops being true, the old bug is back.
    for (const kind of ["reservation", "department_request", "dispute"]) {
      for (const scope of ["booking", "stay", "lease"]) {
        const out = threadOrdering(thread({ kind, scope }), answered([outlet(AMAHORO, "Ikigugu Café")]));
        assert.equal(out.state, "offered", `${kind}/${scope} was refused on its shape`);
      }
    }
  });
});

describe("an archived thread never offers ordering", () => {
  test("even when the server would take the order", () => {
    const ordering = threadOrdering(
      thread({ status: "archived" }),
      answered([outlet(AMAHORO, "Ikigugu Café")]),
    );
    assert.deepEqual(ordering, { state: "unavailable", reason: "archived" });
  });

  test("and it is not even worth asking", () => {
    assert.equal(mayAskOrderable(thread({ status: "archived" })), false);
  });
});

describe("a thread with no property never offers ordering", () => {
  test("because there is no property to ask about", () => {
    // `GET /me/orderable` with no property answers about the caller's stays
    // generally, which would offer a Kigali café inside a conversation with a
    // Musanze lodge.
    const ordering = threadOrdering(
      thread({ propertyId: null }),
      answered([outlet(AMAHORO, "Ikigugu Café")]),
    );
    assert.deepEqual(ordering, { state: "unavailable", reason: "no-property" });
  });

  test("and it is not even worth asking", () => {
    assert.equal(mayAskOrderable(thread({ propertyId: null })), false);
  });
});

describe("a thread whose property returns no outlet does not offer ordering", () => {
  test("an empty answer is a no", () => {
    assert.deepEqual(threadOrdering(thread(), answered([])), { state: "none" });
  });

  test("another property's outlet is not this conversation's", () => {
    // `?propertyId=` ADDS a property to the ones resolved from the caller's
    // stays; it does not restrict to it. A guest in house at the Serena asking
    // about Amahoro gets the Serena's outlets back, and offering one here
    // would produce an order `assertOrderableThread` then refuses.
    const ordering = threadOrdering(thread(), answered([outlet(SERENA, "Lakeside Grill")]));
    assert.deepEqual(ordering, { state: "none" });
  });

  test("a mixed answer keeps only this property's outlets", () => {
    const ordering = threadOrdering(
      thread(),
      answered([outlet(SERENA, "Lakeside Grill"), outlet(AMAHORO, "Ikigugu Café")]),
    );
    assert.equal(ordering.state, "offered");
    assert.deepEqual(ordering.outlets.map((o) => o.name), ["Ikigugu Café"]);
  });
});

describe("answers that are not an answer", () => {
  test("nothing back yet is `asking`, never a false no", () => {
    // A composer that rendered "you cannot order" for the half second before
    // the call returns would be wrong on every conversation that can order.
    assert.deepEqual(threadOrdering(thread(), null), { state: "asking" });
  });

  for (const [name, result] of Object.entries({
    "an unreachable API": { status: "failed" },
    "a refusal": { status: "refused", message: "No.", httpStatus: 403 },
    "a dead session": { status: "unauthenticated" },
  })) {
    test(`${name} is quietly no ordering, not an error in the chat`, () => {
      // Ordering is an addition to a conversation that loaded fine. An error
      // banner over a chat because an optional side call failed is noise about
      // something the reader did not ask for.
      assert.deepEqual(threadOrdering(thread(), result), { state: "none" });
    });
  }
});

describe("mayAskOrderable", () => {
  test("an active thread with a property is worth asking about", () => {
    assert.equal(mayAskOrderable(thread()), true);
  });
});
