/**
 * The guest's money paths read through the contract, and ordering sends what the
 * contract accepts (platform audit, step 4).
 *
 * THIS TEST RUNS THE REAL MODULES, following `safe-redirect.test.mjs`: each
 * source is read, transpiled and evaluated. Its `@injishi/contracts` import is
 * bound to the BUILT contracts package (the same schemas the API validates
 * with), and its `@/lib/api` import either to the real `lib/api.ts` over a
 * stubbed `fetch`, or to a recorder. A test that re-stated the rules would pass
 * against a broken implementation, because it would be checking itself.
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
const contracts = require("@injishi/contracts");

globalThis.__contracts = contracts;

/**
 * Transpile a source file and rebind its two aliased imports. Every import of
 * `@injishi/contracts` becomes a read of the built package; `@/lib/api` becomes
 * a read of `globalThis.__api`. Anything else imported is a failure of this
 * harness, and says so.
 */
async function load(relative) {
  const src = readFileSync(resolve(here, "..", relative), "utf8");
  let { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  outputText = outputText
    .replace(/import\s*\{([^}]*)\}\s*from\s*"@injishi\/contracts";/g, "const {$1} = globalThis.__contracts;")
    .replace(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/api";/g, "const {$1} = globalThis.__api;");
  assert.doesNotMatch(outputText, /^\s*import\s/m, `${relative} imports something this harness does not bind`);
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const api = await load("src/lib/api.ts");

// Every module is loaded here, before any suite runs, because each binds
// `globalThis.__api` at evaluation and the suites must not race to set it.
globalThis.__api = api;
const rooms = await load("src/data/property-rooms.ts");
const cancellation = await load("src/data/cancellation.ts");
globalThis.__api = { apiFetchParsed: async () => ({ status: "failed" }) };
const ordering = await load("src/data/ordering.ts");

/** Replace `fetch` for one call; record what was sent. */
function stubFetch(status, body) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(body === undefined ? "" : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return calls;
}

const QUOTE = {
  reference: "BK-AB12-CD34",
  cancellable: true,
  refusal: null,
  percent: 50,
  refundRwf: 60_000,
  forfeitRwf: 60_000,
  rule: "Cancelled less than 5 days before check-in: 50% refunded.",
};

describe("apiFetchParsed treats a drifted body as a failure, never as data", () => {
  test("a body matching the schema is ok, and parsed", async () => {
    stubFetch(200, QUOTE);
    const result = await api.apiFetchParsed(contracts.CancellationQuote, "/x");
    assert.equal(result.status, "ok");
    assert.equal(result.data.refundRwf, 60_000);
  });

  test("a body missing a money field is failed", async () => {
    const { refundRwf: _dropped, ...drifted } = QUOTE;
    stubFetch(200, drifted);
    const result = await api.apiFetchParsed(contracts.CancellationQuote, "/x");
    assert.deepEqual(result, { status: "failed" });
  });

  test("a refusal passes through with the server's sentence", async () => {
    stubFetch(409, { message: "This booking is already cancelled." });
    const result = await api.apiFetchParsed(contracts.CancellationQuote, "/x");
    assert.equal(result.status, "refused");
    assert.equal(result.message, "This booking is already cancelled.");
  });

  test("an idempotency key is sent as the header the API reads", async () => {
    const calls = stubFetch(201, {});
    await api.apiFetch("/x", { method: "POST", body: { a: 1 }, idempotencyKey: "k-1" });
    assert.equal(calls[0].init.headers["idempotency-key"], "k-1");
    assert.equal(calls[0].init.headers["content-type"], "application/json");
  });
});

describe("the web money reads are parsed, not cast", () => {
  const PROPERTY = {
    id: "0f9a1b00-0000-4000-8000-000000000001",
    slug: "kivu-crest",
    name: "Kivu Crest",
    description: null,
    districtName: "Rubavu",
    latitude: null,
    longitude: null,
    locationPrivacy: false,
    checkInTime: null,
    checkOutTime: null,
    houseRules: null,
    photos: [],
    roomTypes: [],
    facilities: [],
  };

  for (const file of ["src/data/bookings.ts", "src/data/property-rooms.ts", "src/data/property-facilities.ts"]) {
    test(`${file} goes through apiFetchParsed`, () => {
      const src = readFileSync(resolve(here, "..", file), "utf8");
      assert.doesNotMatch(src, /apiFetch</, `${file} still casts with apiFetch<T>`);
      assert.match(src, /apiFetchParsed\(/);
    });
  }

  test("property rooms: a drifted property is failed, a valid one is ok", async () => {
    stubFetch(200, PROPERTY);
    assert.equal((await rooms.fetchPropertyRooms("kivu-crest")).status, "ok");
    stubFetch(200, { ...PROPERTY, roomTypes: [{ id: "not-a-uuid" }] });
    assert.deepEqual(await rooms.fetchPropertyRooms("kivu-crest"), { status: "failed" });
  });

  test("discovery parses the property cards against the contract", () => {
    const src = readFileSync(resolve(here, "../src/data/discovery.ts"), "utf8");
    assert.doesNotMatch(src, /as T;/, "discovery still casts the body");
    assert.match(src, /PropertyCard\.array\(\)/);
  });
});

describe("cancellation words every refusal the controller returns", () => {
  test("the quote and the cancel call the guest routes", async () => {
    const calls = stubFetch(200, QUOTE);
    await cancellation.fetchCancellationQuote("BK-AB12-CD34");
    assert.match(calls[0].url, /\/api\/v1\/bookings\/BK-AB12-CD34\/cancellation$/);
    const post = stubFetch(200, {
      id: "0f9a1b00-0000-4000-8000-000000000002",
      reference: "BK-AB12-CD34",
      status: "cancelled",
      cancelledBy: "guest",
      paymentStatus: "refunded_partial",
      escrowStatus: "refunded_partial",
      refundRwf: 60_000,
      forfeitRwf: 60_000,
      rule: QUOTE.rule,
    });
    const done = await cancellation.cancelBooking("BK-AB12-CD34");
    assert.equal(done.status, "ok");
    assert.equal(post[0].init.method, "POST");
    assert.match(post[0].url, /\/cancel$/);
  });

  test("404 names the booking, not the framework", () => {
    const text = cancellation.cancellationProblem(
      { status: "refused", httpStatus: 404, message: "Booking not found." },
      "cancel",
    );
    assert.match(text, /couldn't find this booking/);
  });

  test("409 and 503 are shown in the API's own words", () => {
    for (const [httpStatus, message] of [
      [409, "You have already checked in, so this booking can no longer be cancelled here."],
      [503, "We could not reach the payment service to refund you, so the booking is unchanged. Please try again."],
    ]) {
      assert.equal(
        cancellation.cancellationProblem({ status: "refused", httpStatus, message }, "cancel"),
        message,
      );
    }
  });

  test("a failed cancel never promises that nothing changed", () => {
    const text = cancellation.cancellationProblem({ status: "failed" }, "cancel");
    assert.match(text, /whether the booking was cancelled/);
  });
});

describe("ordering sends what PlaceOrderRequest accepts", () => {
  const uuid = (n) => `0f9a1b00-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const outlet = {
    id: uuid(1),
    name: "Terrace Bar",
    outletKind: "bar",
    propertyId: uuid(2),
    propertyName: "Kivu Crest",
    orderingAccess: "both",
    hours: null,
    chargeToRoom: true,
    payNow: true,
    distanceKm: null,
    operatorLabel: null,
    categories: [
      {
        id: uuid(3),
        name: "Coffee",
        items: [
          {
            id: uuid(4),
            name: "Latte",
            description: null,
            priceRwf: 2_500,
            prepTimeMinutes: 5,
            options: [
              {
                name: "Milk",
                required: true,
                maxChoices: 1,
                choices: [
                  { label: "Whole", priceDeltaRwf: 0 },
                  { label: "Oat", priceDeltaRwf: 500 },
                ],
              },
            ],
          },
          { id: uuid(5), name: "Water", description: null, priceRwf: 1_000, prepTimeMinutes: null, options: [] },
        ],
      },
    ],
  };
  const latte = outlet.categories[0].items[0];

  test("the fixture outlet is itself a valid OrderableOutlet", () => {
    assert.equal(contracts.OrderableOutlet.safeParse(outlet).success, true);
  });

  test("a required option is named before the press, and priced once picked", () => {
    let cart = ordering.setQuantity(ordering.EMPTY_CART, latte.id, 2);
    assert.equal(ordering.missingChoice(cart, outlet), "Pick milk for Latte.");
    cart = ordering.toggleChoice(cart, latte, "Milk", "Whole");
    cart = ordering.toggleChoice(cart, latte, "Milk", "Oat"); // radio: replaces Whole
    assert.equal(ordering.missingChoice(cart, outlet), null);
    assert.deepEqual(ordering.cartSummary(cart, outlet), { count: 2, subtotalRwf: 6_000 });
  });

  test("quantity is bounded to what the API accepts, and zero removes the line", () => {
    let cart = ordering.setQuantity(ordering.EMPTY_CART, uuid(5), 99);
    assert.equal(cart[uuid(5)].quantity, ordering.MAX_QUANTITY);
    cart = ordering.setQuantity(cart, uuid(5), 0);
    assert.equal(cart[uuid(5)], undefined);
  });

  test("room charge, mobile money and counter each parse as PlaceOrderRequest", () => {
    let cart = ordering.setQuantity(ordering.EMPTY_CART, latte.id, 1);
    cart = ordering.toggleChoice(cart, latte, "Milk", "Oat");
    cart = ordering.setQuantity(cart, uuid(5), 2);
    // A line for an item no longer on the menu is dropped, not sent.
    cart = ordering.setQuantity(cart, uuid(99), 1);

    const room = ordering.orderRequest(cart, outlet, { kind: "room" }, "  no sugar ");
    const parsedRoom = contracts.PlaceOrderRequest.safeParse(room);
    assert.equal(parsedRoom.success, true, JSON.stringify(parsedRoom.error?.issues));
    assert.equal(room.context, "in_house_folio");
    assert.equal(room.instrument, undefined);
    assert.equal(room.items.length, 2);
    assert.equal(room.guestNote, "no sugar");
    assert.deepEqual(room.items[0].selectedOptions, [{ name: "Milk", choices: ["Oat"] }]);

    const momo = ordering.orderRequest(cart, outlet, {
      kind: "mobile_money",
      network: "mtn_momo",
      msisdn: "781234567",
    });
    assert.equal(contracts.PlaceOrderRequest.safeParse(momo).success, true);
    assert.equal(momo.context, "pay_now");
    assert.equal(momo.instrument.kind, "mobile_money");

    const counter = ordering.orderRequest(cart, outlet, { kind: "counter" });
    assert.equal(contracts.PlaceOrderRequest.safeParse(counter).success, true);
    assert.equal(counter.context, "pay_now");
    assert.equal(counter.instrument, undefined);
  });

  test("every order status the contract defines has a guest label", () => {
    for (const status of contracts.ServiceOrderStatus.options) {
      assert.ok(ordering.ORDER_STATUS_LABEL[status], `no label for ${status}`);
    }
  });
});
