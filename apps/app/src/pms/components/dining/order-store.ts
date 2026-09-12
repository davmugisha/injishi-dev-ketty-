/**
 * THE OPERATOR-SIDE MIRROR OF `apps/web/src/lib/order-store.ts`.
 *
 * IT IS A HAND-KEPT COPY AND THE TWO MUST BE CHANGED TOGETHER, for the same
 * reason `pms/data/dining.ts` is a hand-kept copy of the guest catalogue:
 * `apps/app` is a separate Next application with its own `tsconfig` and its own
 * `@/*` root, so it cannot resolve a path into `apps/web`, and promoting a
 * presentation-prototype store into `@injishi/*` would force `packages:build`
 * into every consumer of it.
 *
 * WHAT MUST NOT DRIFT is the vocabulary, and it is the vocabulary a guest
 * reads: `"placed"`, `"accepted"`, `"preparing"`, `"on_the_way"`, `"delivered"`
 * and `"cancelled"`. A seventh spelling on this side would give an operator a
 * button that moves an order into a state the guest's tracker cannot name, and
 * the guest would watch their dinner disappear from the thread. The storage key
 * and the change event are the guest side's verbatim, so the two halves are
 * literally one store wherever both are served from one origin.
 *
 * FABRICATED DATA. No order below was placed by anyone, no room number belongs
 * to a guest, and every name is invented. The seeded orders exist so an
 * operator board has something on it during a demo; they are a READ-TIME FLOOR
 * rather than a write, exactly as `demoThreadsFor` is on the guest side, so
 * merely opening the screen never puts a phantom order into storage. The first
 * time an operator moves one along, that order — and only that one — is
 * persisted.
 *
 * NO `Math.random`, NO `Date.now` DURING RENDER. Every seeded id, message id
 * and timestamp is a literal, so a server render and the first client render
 * produce identical markup. Fresh timestamps are minted only inside the write
 * functions, all of which run from an event handler.
 */

import { diningProduct } from "../../data/dining";

/* -------------------------------------------------------------------- types */

/**
 * The life of an order, in order.
 *
 * Six values, and the two ends are not symmetrical: `"delivered"` and
 * `"cancelled"` are both terminal, but only `"delivered"` is reachable by
 * advancing. Cancelling is always an explicit act, which is why
 * `advanceOrder` cannot produce it.
 */
export type OrderState =
  | "placed"
  | "accepted"
  | "preparing"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export interface OrderLine {
  productSlug: string;
  /**
   * The product name AS ORDERED.
   *
   * A snapshot, not a lookup. This is the whole reason the Menu lens can
   * reprice a dish mid-service without rewriting yesterday's tickets: an order
   * is history and a menu is not.
   */
  name: string;
  priceRwf: number;
  qty: number;
}

export interface RoomOrder {
  id: string;
  /** The chat thread this order reports into. Never empty. */
  threadId: string;
  room: string;
  propertySlug: string;
  lines: OrderLine[];
  totalRwf: number;
  state: OrderState;
  /** ISO timestamp, minted when the order was placed. */
  placedAt: string;
}

/**
 * The five desks a guest can reach.
 *
 * A closed set rather than free text: the guest's chat list, this app's
 * Departments lens and the order router all key off it, and a sixth spelling of
 * "front desk" would give a guest a thread nobody here can see.
 */
export type Department =
  | "front_desk"
  | "housekeeping"
  | "kitchen"
  | "maintenance"
  | "security";

export interface ChatMessage {
  id: string;
  threadId: string;
  /**
   * Who is speaking. `"system"` is the platform itself — an order state
   * change — and must be styled apart from a person: a guest reading an
   * automatic status line as something a member of staff typed will reply to
   * it and wait.
   */
  from: "guest" | "staff" | "system";
  body: string;
  /** ISO timestamp. */
  at: string;
  /** Set on a system message that reports on an order. */
  orderId?: string;
}

export interface ChatThread {
  id: string;
  department: Department;
  /** The person a guest is actually talking to. The Departments lens sets it. */
  leadName: string;
  leadRole: string;
  propertySlug: string;
  messages: ChatMessage[];
}

export interface OrderStoreState {
  orders: RoomOrder[];
  threads: ChatThread[];
}

/* ------------------------------------------------------- state vocabularies */

export const DEPARTMENTS: Department[] = [
  "front_desk",
  "housekeeping",
  "kitchen",
  "maintenance",
  "security",
];

export const DEPARTMENT_LABEL: Record<Department, string> = {
  front_desk: "Front desk",
  housekeeping: "Housekeeping",
  kitchen: "Kitchen & room service",
  maintenance: "Maintenance",
  security: "Security",
};

/** What each desk is for, in the guest's words — the same sentence they read. */
export const DEPARTMENT_BLURB: Record<Department, string> = {
  front_desk: "Check-out, bills, taxis, late departures and anything you cannot place elsewhere.",
  housekeeping: "Towels, linen, laundry, an extra pillow, or a room made up again.",
  kitchen: "Room service, the menu, allergies, and where your order has got to.",
  maintenance: "Water, power, air conditioning, the safe, the television, a door that sticks.",
  security: "Lost property, a key that will not read, and anything that does not feel right.",
};

/**
 * The department leads, and they are invented people.
 *
 * The DEFAULT lead only: the Departments lens writes a chosen lead onto the
 * thread, and a thread that carries one wins over this table. Two of these
 * names — Denise Iribagiza and Beatha Mukeshimana — are also on the demo
 * property's staff roster in `data/demo.ts`, which is deliberate: the person a
 * guest is messaging should be somebody the operator can find on their own
 * team screen.
 */
export const DEPARTMENT_LEAD: Record<Department, { name: string; role: string }> = {
  front_desk: { name: "Denise Iribagiza", role: "Front office supervisor" },
  housekeeping: { name: "Beatha Mukeshimana", role: "Head of housekeeping" },
  kitchen: { name: "Jean-Claude Habimana", role: "Sous chef, room service" },
  maintenance: { name: "Emmanuel Nsengiyumva", role: "Maintenance lead" },
  security: { name: "Aline Uwase", role: "Duty security officer" },
};

/**
 * The only path an order may be advanced along.
 *
 * `"cancelled"` is absent by design. An order at `"delivered"` has nowhere left
 * to go and `advanceOrder` returns it unchanged rather than throwing, because a
 * double-tap on a board button is a user behaviour and not an exception.
 */
export const ORDER_FLOW: OrderState[] = [
  "placed",
  "accepted",
  "preparing",
  "on_the_way",
  "delivered",
];

export const ORDER_STATE_LABEL: Record<OrderState, string> = {
  placed: "Placed",
  accepted: "Accepted",
  preparing: "Being prepared",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** What the operator's button says to move an order into each state. */
export const ORDER_ADVANCE_LABEL: Record<OrderState, string> = {
  placed: "Reopen",
  accepted: "Accept",
  preparing: "Start preparing",
  on_the_way: "Send it up",
  delivered: "Mark delivered",
  cancelled: "Cancel",
};

/**
 * The system message written when an order reaches each state.
 *
 * One table rather than six sentences at six call sites, because these lines
 * ARE the order tracker as far as the guest is concerned — and scattering them
 * is how a tracker comes to say "Delivered" in the thread and "On the way" on
 * the card.
 */
export const ORDER_STATE_MESSAGE: Record<OrderState, string> = {
  placed: "Order received. The kitchen has it and will confirm shortly.",
  accepted: "The kitchen has accepted your order.",
  preparing: "Your order is being prepared.",
  on_the_way: "Your order has left the kitchen and is on its way up.",
  delivered: "Your order has been delivered. Enjoy it.",
  cancelled: "This order has been cancelled. Nothing has been charged to your room.",
};

export const TERMINAL_ORDER_STATES: OrderState[] = ["delivered", "cancelled"];

export function isTerminalOrderState(state: OrderState): boolean {
  return TERMINAL_ORDER_STATES.includes(state);
}

/** Where an order sits on the board. */
export function orderIntent(state: OrderState): "ok" | "warn" | "bad" | "info" | "neutral" {
  if (state === "delivered") return "ok";
  if (state === "cancelled") return "bad";
  if (state === "placed") return "warn";
  return "info";
}

/**
 * The desk an order reports into.
 *
 * Every food and drink order goes to the kitchen thread, a bar order included:
 * in this demo the kitchen desk owns room service end to end, and splitting bar
 * orders to a sixth thread would give the guest two places to look for one
 * delivery.
 */
export function departmentForOrder(): Department {
  return "kitchen";
}

/** The one definition of what an order costs. Whole francs; no minor units. */
export function orderTotalRwf(lines: OrderLine[]): number {
  return lines.reduce((total, line) => total + line.priceRwf * line.qty, 0);
}

export function orderItemCount(lines: OrderLine[]): number {
  return lines.reduce((count, line) => count + line.qty, 0);
}

/** "2 × Beef brochettes, 1 × Primus lager" — an order read aloud. */
export function orderSummary(order: RoomOrder): string {
  return order.lines.map((line) => `${line.qty} × ${line.name}`).join(", ");
}

/**
 * "Order K312" — the handle a guest and a member of staff say to each other.
 *
 * The last four characters of the id, upper-cased. A full id is unreadable over
 * a telephone and the room number is already on the ticket, so a short suffix
 * is enough to tell two of a guest's orders apart.
 */
export function shortOrderRef(order: RoomOrder): string {
  return `Order ${order.id.slice(-4).toUpperCase()}`;
}

/**
 * The id of a department thread, derived from the property and the desk.
 *
 * Derived rather than generated, so the same guest at the same property gets
 * the same thread id on every render and on every device.
 */
export function threadIdFor(propertySlug: string, department: Department): string {
  return `${propertySlug}--${department}`;
}

/** The property half of a thread id, or null when the id is not one of ours. */
export function propertySlugFromThreadId(threadId: string): string | null {
  const at = threadId.lastIndexOf("--");
  if (at <= 0) return null;
  const department = threadId.slice(at + 2);
  return isDepartment(department) ? threadId.slice(0, at) : null;
}

/* ------------------------------------------------------------------ seeding */

const STORAGE_KEY = "injishi:room-orders";

/**
 * Fired on every write, because `storage` is not enough: the browser does not
 * deliver `storage` to the tab that wrote the value, so the orders board and
 * the thread beside it would disagree until a reload.
 */
export const ORDER_STORE_CHANGE_EVENT = "injishi:room-orders-change";

/**
 * Fixed clock times for everything seeded.
 *
 * Literal ISO strings, not offsets from `Date.now()`. A seeded board is
 * rendered on the very first paint, so its timestamps must be identical on the
 * server and in the browser; anything computed from the current time differs by
 * milliseconds and React discards the tree.
 */
const SEED_DAY = "2026-09-08";
const SEED_AT = (hhmm: string): string => `${SEED_DAY}T${hhmm}:00.000Z`;

/** One seeded exchange per desk: what staff said, and when. */
const SEED_SCRIPT: Record<Department, { from: "staff" | "guest"; at: string; body: string }[]> = {
  front_desk: [
    {
      from: "staff",
      at: SEED_AT("06:40"),
      body: "Murakaza neza. This is the front desk — I am on until three. Anything you need for your stay, write here and it comes straight to the desk.",
    },
    {
      from: "guest",
      at: SEED_AT("06:52"),
      body: "Murakoze. Could we keep the room until two on the day we leave? Our flight is late.",
    },
  ],
  housekeeping: [
    {
      from: "staff",
      at: SEED_AT("07:15"),
      body: "Good morning. Housekeeping reaches your floor between nine and midday. Message me if you would rather we came later, or not at all today.",
    },
    {
      from: "guest",
      at: SEED_AT("07:24"),
      body: "After midday please — and two more towels when you come.",
    },
  ],
  kitchen: [
    {
      from: "staff",
      at: SEED_AT("08:05"),
      body: "Room service kitchen. Anything you order from the menu appears in this conversation and I will tell you as it moves.",
    },
    {
      from: "staff",
      at: SEED_AT("08:06"),
      body: "Brochettes are turned to order, so allow about twenty minutes at dinner. Tell me here about any allergy and I will put it on the ticket myself.",
    },
  ],
  maintenance: [
    {
      from: "staff",
      at: SEED_AT("08:30"),
      body: "Maintenance. Water, power, air conditioning, the safe, the television — write here and I will come up.",
    },
    {
      from: "guest",
      at: SEED_AT("08:44"),
      body: "The kettle in the room trips the socket. Nothing urgent.",
    },
  ],
  security: [
    {
      from: "staff",
      at: SEED_AT("09:00"),
      body: "Duty security. Someone is on this desk day and night, and this thread reaches whoever is on.",
    },
    {
      from: "staff",
      at: SEED_AT("09:01"),
      body: "If your key stops opening the door it has usually been demagnetised — bring it down and we will rewrite it in a moment.",
    },
  ],
};

/**
 * A seeded order, before it becomes a `RoomOrder`.
 *
 * The lines carry their own `name` and `priceRwf` rather than resolving through
 * `data/dining.ts`, because that is what an order line IS — a snapshot taken at
 * order time. `diningOrderSeedProblems()` below is the drift check that keeps
 * the snapshot honest against the catalogue it was taken from.
 */
interface SeedOrder {
  /** Ends in the four characters `shortOrderRef` shows. */
  id: string;
  room: string;
  guest: string;
  lines: OrderLine[];
  state: OrderState;
  placedAt: string;
  /** When the order reached `state`. Equal to `placedAt` for a fresh order. */
  stateAt: string;
}

/**
 * The room-service traffic each demo property opens with.
 *
 * Rooms and guest names are the ones `data/demo.ts` already has in-house, so an
 * operator who opens Reservations after Live orders sees the same people. Every
 * dish belongs to an outlet that property operates, which is the rule the whole
 * catalogue exists to demonstrate.
 */
const SEED_ORDERS: Record<string, SeedOrder[]> = {
  "kigali-serena-hotel": [
    {
      id: "ORD-DEMO-K312",
      room: "312",
      guest: "Amara Okafor",
      lines: [
        { productSlug: "beef-brochettes", name: "Beef brochettes", priceRwf: 9500, qty: 2 },
        {
          productSlug: "inyange-passion-juice",
          name: "Inyange passion fruit juice",
          priceRwf: 1800,
          qty: 2,
        },
      ],
      state: "placed",
      placedAt: SEED_AT("19:42"),
      stateAt: SEED_AT("19:42"),
    },
    {
      id: "ORD-DEMO-K111",
      room: "111",
      guest: "Kevin Mugisha",
      lines: [
        { productSlug: "goat-brochettes", name: "Goat brochettes", priceRwf: 10500, qty: 1 },
        { productSlug: "primus-lager-500", name: "Primus lager, 500 ml", priceRwf: 2000, qty: 1 },
      ],
      state: "accepted",
      placedAt: SEED_AT("19:31"),
      stateAt: SEED_AT("19:34"),
    },
    {
      id: "ORD-DEMO-K208",
      room: "208",
      guest: "Priya Sharma",
      lines: [
        { productSlug: "isombe-na-ubugali", name: "Isombe na ubugali", priceRwf: 7500, qty: 1 },
        { productSlug: "mutzig-lager-500", name: "Mützig lager, 500 ml", priceRwf: 2200, qty: 1 },
      ],
      state: "preparing",
      placedAt: SEED_AT("19:18"),
      stateAt: SEED_AT("19:26"),
    },
    {
      id: "ORD-DEMO-K210",
      room: "210",
      guest: "Sofia Andersson",
      lines: [
        { productSlug: "ibihaza-pumpkin-soup", name: "Ibihaza soup", priceRwf: 4500, qty: 1 },
        {
          productSlug: "grilled-vegetable-plate",
          name: "Grilled vegetable plate",
          priceRwf: 8500,
          qty: 1,
        },
      ],
      state: "on_the_way",
      placedAt: SEED_AT("19:05"),
      stateAt: SEED_AT("19:29"),
    },
    {
      id: "ORD-DEMO-K202",
      room: "202",
      guest: "Omar Haddad",
      lines: [
        {
          productSlug: "virunga-gin-and-tonic",
          name: "Virunga gin & tonic",
          priceRwf: 7500,
          qty: 2,
        },
      ],
      state: "delivered",
      placedAt: SEED_AT("18:20"),
      stateAt: SEED_AT("18:38"),
    },
    {
      id: "ORD-DEMO-K209",
      room: "209",
      guest: "Tom Whelan",
      lines: [
        { productSlug: "agatogo-plantain-stew", name: "Agatogo", priceRwf: 8000, qty: 1 },
        { productSlug: "skol-lager-330", name: "Skol lager, 330 ml", priceRwf: 1800, qty: 1 },
      ],
      state: "cancelled",
      placedAt: SEED_AT("18:02"),
      stateAt: SEED_AT("18:11"),
    },
  ],
  "lake-kivu-serena-hotel": [
    {
      id: "ORD-DEMO-L003",
      room: "3",
      guest: "Marie Ingabire",
      lines: [
        {
          productSlug: "whole-grilled-tilapia",
          name: "Whole grilled tilapia",
          priceRwf: 14000,
          qty: 1,
        },
        { productSlug: "ikivuguto-fresh", name: "Ikivuguto", priceRwf: 1500, qty: 2 },
      ],
      state: "placed",
      placedAt: SEED_AT("13:12"),
      stateAt: SEED_AT("13:12"),
    },
    {
      id: "ORD-DEMO-L006",
      room: "6",
      guest: "Paul Rukundo",
      lines: [
        {
          productSlug: "tilapia-fillet-in-tomato",
          name: "Tilapia fillet in tomato",
          priceRwf: 12500,
          qty: 1,
        },
      ],
      state: "preparing",
      placedAt: SEED_AT("12:48"),
      stateAt: SEED_AT("12:55"),
    },
    {
      id: "ORD-DEMO-L005",
      room: "5",
      guest: "Jean Mugenzi",
      lines: [{ productSlug: "ikivuguto-fresh", name: "Ikivuguto", priceRwf: 1500, qty: 2 }],
      state: "delivered",
      placedAt: SEED_AT("12:05"),
      stateAt: SEED_AT("12:19"),
    },
  ],
};

/**
 * Who ordered, by order id.
 *
 * Kept beside the seed rather than on `RoomOrder`, because the guest's own
 * store has no `guest` field and adding one here would be the first divergence
 * between the two halves. The board shows the room, which is what a runner
 * needs; the name is a nicety this side can look up.
 */
const SEED_GUEST: Record<string, string> = Object.fromEntries(
  Object.values(SEED_ORDERS).flatMap((orders) => orders.map((o) => [o.id, o.guest])),
);

/** The guest a seeded order belongs to, or null for one placed in this browser. */
export function seededGuestFor(orderId: string): string | null {
  return SEED_GUEST[orderId] ?? null;
}

/** Every property this store seeds. The demo bridge decides which is in view. */
export function seededPropertySlugs(): string[] {
  return Object.keys(SEED_ORDERS);
}

/**
 * The seeded orders for a property, as `RoomOrder`s.
 *
 * PURE. It touches no storage and no clock, so a server render and the first
 * client render agree.
 */
export function demoOrdersFor(propertySlug: string): RoomOrder[] {
  const threadId = threadIdFor(propertySlug, departmentForOrder());
  return (SEED_ORDERS[propertySlug] ?? []).map((seed) => ({
    id: seed.id,
    threadId,
    room: seed.room,
    propertySlug,
    lines: seed.lines,
    totalRwf: orderTotalRwf(seed.lines),
    state: seed.state,
    placedAt: seed.placedAt,
  }));
}

/**
 * The five department threads for a property, fully seeded.
 *
 * The kitchen desk also carries the system lines for every seeded order, built
 * from the same table the board reads, so the thread and the board cannot open
 * the demo disagreeing about where an order has got to.
 */
export function demoThreadsFor(propertySlug: string): ChatThread[] {
  const orderThreadId = threadIdFor(propertySlug, departmentForOrder());
  const orders = demoOrdersFor(propertySlug);
  const seedById = new Map((SEED_ORDERS[propertySlug] ?? []).map((s) => [s.id, s]));

  return DEPARTMENTS.map((department) => {
    const id = threadIdFor(propertySlug, department);
    const lead = DEPARTMENT_LEAD[department];
    const script: ChatMessage[] = SEED_SCRIPT[department].map((entry, index) => ({
      id: `${id}--seed-${index + 1}`,
      threadId: id,
      from: entry.from,
      body: entry.body,
      at: entry.at,
    }));

    const reports: ChatMessage[] =
      id === orderThreadId
        ? orders.flatMap((order) => {
            const seed = seedById.get(order.id);
            if (seed === undefined) return [];
            const opening: ChatMessage = {
              id: `${order.id}--placed`,
              threadId: id,
              from: "system",
              body: `${shortOrderRef(order)} · ${orderSummary(order)} — ${ORDER_STATE_MESSAGE.placed}`,
              at: seed.placedAt,
              orderId: order.id,
            };
            if (order.state === "placed") return [opening];
            return [
              opening,
              {
                id: `${order.id}--${order.state}`,
                threadId: id,
                from: "system",
                body: `${shortOrderRef(order)} — ${ORDER_STATE_MESSAGE[order.state]}`,
                at: seed.stateAt,
                orderId: order.id,
              },
            ];
          })
        : [];

    return {
      id,
      department,
      leadName: lead.name,
      leadRole: lead.role,
      propertySlug,
      messages: [...script, ...reports].sort((a, b) => a.at.localeCompare(b.at)),
    };
  });
}

/**
 * The drift check between a seeded order line and the catalogue it was taken
 * from.
 *
 * A snapshot is allowed to disagree with today's menu — that is what a snapshot
 * is for — but a seed shipped disagreeing was never a snapshot of anything, it
 * was a typo. This is the same shape as `diningCatalogueProblems()` in
 * `data/dining.ts`, and for the same reason: the real control is the header,
 * and this catches the half-applied edit.
 */
export function diningOrderSeedProblems(): string[] {
  const problems: string[] = [];
  for (const [propertySlug, orders] of Object.entries(SEED_ORDERS)) {
    for (const order of orders) {
      for (const line of order.lines) {
        const product = diningProduct(line.productSlug);
        if (product === undefined) {
          problems.push(`${order.id}: names ${line.productSlug}, which is not in the catalogue`);
          continue;
        }
        if (product.propertySlug !== propertySlug) {
          problems.push(
            `${order.id}: is a ${propertySlug} order but ${line.productSlug} belongs to ` +
              `${product.propertySlug ?? "no property"}`,
          );
        }
        if (product.name !== line.name || product.priceRwf !== line.priceRwf) {
          problems.push(
            `${order.id}: snapshots ${line.name} at ${line.priceRwf}, catalogue says ` +
              `${product.name} at ${product.priceRwf}`,
          );
        }
      }
    }
  }
  return problems;
}

/* -------------------------------------------------------- persistence layer */

const EMPTY: OrderStoreState = { orders: [], threads: [] };

function isOrderState(value: unknown): value is OrderState {
  return (
    value === "placed" ||
    value === "accepted" ||
    value === "preparing" ||
    value === "on_the_way" ||
    value === "delivered" ||
    value === "cancelled"
  );
}

function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && (DEPARTMENTS as string[]).includes(value);
}

/**
 * Narrow a parsed blob back into store state.
 *
 * Field by field rather than cast, because this data was last written by a
 * previous deploy of this file — or by the guest app, which is the whole point
 * of sharing a key. A shape change would otherwise reach a render as an object
 * missing half its properties, and the crash would land in a component rather
 * than here where it can be discarded.
 */
function parseState(value: unknown): OrderStoreState {
  if (typeof value !== "object" || value === null) return EMPTY;
  const raw = value as Record<string, unknown>;
  const orders = Array.isArray(raw.orders) ? raw.orders.flatMap(parseOrder) : [];
  const threads = Array.isArray(raw.threads) ? raw.threads.flatMap(parseThread) : [];
  return { orders, threads };
}

function parseOrder(value: unknown): RoomOrder[] {
  if (typeof value !== "object" || value === null) return [];
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.threadId !== "string" ||
    typeof raw.room !== "string" ||
    typeof raw.propertySlug !== "string" ||
    typeof raw.placedAt !== "string" ||
    !isOrderState(raw.state) ||
    !Array.isArray(raw.lines)
  ) {
    return [];
  }
  const lines = raw.lines.flatMap(parseLine);
  return [
    {
      id: raw.id,
      threadId: raw.threadId,
      room: raw.room,
      propertySlug: raw.propertySlug,
      lines,
      totalRwf: typeof raw.totalRwf === "number" ? raw.totalRwf : orderTotalRwf(lines),
      state: raw.state,
      placedAt: raw.placedAt,
    },
  ];
}

function parseLine(value: unknown): OrderLine[] {
  if (typeof value !== "object" || value === null) return [];
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.productSlug !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.priceRwf !== "number" ||
    typeof raw.qty !== "number"
  ) {
    return [];
  }
  return [{ productSlug: raw.productSlug, name: raw.name, priceRwf: raw.priceRwf, qty: raw.qty }];
}

function parseThread(value: unknown): ChatThread[] {
  if (typeof value !== "object" || value === null) return [];
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.leadName !== "string" ||
    typeof raw.leadRole !== "string" ||
    typeof raw.propertySlug !== "string" ||
    !isDepartment(raw.department) ||
    !Array.isArray(raw.messages)
  ) {
    return [];
  }
  return [
    {
      id: raw.id,
      department: raw.department,
      leadName: raw.leadName,
      leadRole: raw.leadRole,
      propertySlug: raw.propertySlug,
      messages: raw.messages.flatMap(parseMessage),
    },
  ];
}

function parseMessage(value: unknown): ChatMessage[] {
  if (typeof value !== "object" || value === null) return [];
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.threadId !== "string" ||
    typeof raw.body !== "string" ||
    typeof raw.at !== "string" ||
    (raw.from !== "guest" && raw.from !== "staff" && raw.from !== "system")
  ) {
    return [];
  }
  return [
    {
      id: raw.id,
      threadId: raw.threadId,
      from: raw.from,
      body: raw.body,
      at: raw.at,
      ...(typeof raw.orderId === "string" ? { orderId: raw.orderId } : {}),
    },
  ];
}

/**
 * Everything persisted, or empty.
 *
 * Empty rather than seeded, because seeding needs a property slug and this
 * function does not have one. `readOrders` and `readThreads` are the seeded
 * reads, and both take one.
 */
export function readOrderStore(): OrderStoreState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return parseState(JSON.parse(raw));
  } catch {
    return EMPTY;
  }
}

function writeOrderStore(next: OrderStoreState): OrderStoreState {
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(ORDER_STORE_CHANGE_EVENT));
  } catch {
    /* A browser refusing site data still gets the value back for this render. */
  }
  return next;
}

/**
 * Listen for anything this store writes — an order, a message, a state change.
 *
 * One event covers all three because they are one store; a consumer that only
 * cared about orders would still have to re-read after a message, since a
 * message is how an order reports itself.
 */
export function subscribeOrderStore(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ORDER_STORE_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(ORDER_STORE_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/* -------------------------------------------------------------------- reads */

/**
 * Every order for a property, newest first, seed floored by anything persisted.
 *
 * The seed is a FLOOR and not a one-time write, which is what lets a board open
 * populated without putting a phantom order into a guest's storage. A persisted
 * order — one the operator has moved, or one a guest placed in this browser —
 * wins wherever one exists.
 */
export function readOrders(propertySlug: string): RoomOrder[] {
  const persisted = readOrderStore().orders.filter((o) => o.propertySlug === propertySlug);
  const byId = new Map(persisted.map((order) => [order.id, order]));
  const seeded = demoOrdersFor(propertySlug).map((order) => byId.get(order.id) ?? order);
  const seededIds = new Set(seeded.map((order) => order.id));
  const placedHere = persisted.filter((order) => !seededIds.has(order.id));
  return [...seeded, ...placedHere].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/** One order, or null. Reads through the same floor as the board. */
export function readOrder(propertySlug: string, orderId: string): RoomOrder | null {
  return readOrders(propertySlug).find((order) => order.id === orderId) ?? null;
}

/** The orders that are still moving — what a board and a guest card show. */
export function readOpenOrders(propertySlug: string): RoomOrder[] {
  return readOrders(propertySlug).filter((order) => !isTerminalOrderState(order.state));
}

/** The five threads for a property, seeded then overlaid with what was said. */
export function readThreads(propertySlug: string): ChatThread[] {
  const persisted = readOrderStore().threads.filter((t) => t.propertySlug === propertySlug);
  const byId = new Map(persisted.map((thread) => [thread.id, thread]));
  return demoThreadsFor(propertySlug).map((seeded) => byId.get(seeded.id) ?? seeded);
}

/** One thread by id, or null. */
export function readThread(threadId: string): ChatThread | null {
  const propertySlug = propertySlugFromThreadId(threadId);
  if (propertySlug === null) return null;
  return readThreads(propertySlug).find((thread) => thread.id === threadId) ?? null;
}

/** The orders reported into one thread, newest first. */
export function ordersInThread(propertySlug: string, threadId: string): RoomOrder[] {
  return readOrders(propertySlug).filter((order) => order.threadId === threadId);
}

/* ------------------------------------------------------------------- writes */

/**
 * Mint an id.
 *
 * Uses the clock and a counter, never `Math.random`. Every caller is an event
 * handler, so the clock has already diverged from the server's by design and
 * nothing is rendered from it before it is stored.
 */
let sequence = 0;
function mintId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}${sequence.toString(36).padStart(2, "0")}`;
}

/**
 * Write a message into a thread, seeding that thread if it is not persisted yet.
 *
 * Private, because every public path into it also has something else to do —
 * post a staff reply, report an order, or hand the desk to a new lead. A bare
 * "append a message" export would let a caller write a system line without the
 * change it claims to describe, which is the exact drift one store prevents.
 */
function appendMessage(state: OrderStoreState, message: ChatMessage): OrderStoreState {
  const propertySlug = propertySlugFromThreadId(message.threadId);
  if (propertySlug === null) return state;

  const existing = state.threads.find((thread) => thread.id === message.threadId);
  const base =
    existing ??
    demoThreadsFor(propertySlug).find((thread) => thread.id === message.threadId) ??
    null;
  if (base === null) return state;

  const updated: ChatThread = { ...base, messages: [...base.messages, message] };
  const threads = existing
    ? state.threads.map((thread) => (thread.id === updated.id ? updated : thread))
    : [...state.threads, updated];
  return { ...state, threads };
}

/**
 * Move an order to a named state and post the line that says so, in one call.
 *
 * Takes the target state rather than only stepping forward, because cancelling
 * is a jump and an operator occasionally needs to correct a mis-tap. There is
 * no way to change a state without the guest being told, and that is the point
 * of this function existing.
 */
export function setOrderState(
  propertySlug: string,
  orderId: string,
  next: OrderState,
): RoomOrder | null {
  const current = readOrder(propertySlug, orderId);
  if (current === null) return null;
  if (current.state === next) return current;

  const updated: RoomOrder = { ...current, state: next };
  const state = readOrderStore();
  const known = state.orders.some((order) => order.id === orderId);
  const withOrder: OrderStoreState = {
    ...state,
    // A seeded order is not in storage yet, so the first move PERSISTS it
    // rather than patching a row that is not there.
    orders: known
      ? state.orders.map((order) => (order.id === orderId ? updated : order))
      : [...state.orders, updated],
  };

  writeOrderStore(
    appendMessage(withOrder, {
      id: mintId("MSG"),
      threadId: updated.threadId,
      from: "system",
      body: `${shortOrderRef(updated)} — ${ORDER_STATE_MESSAGE[next]}`,
      at: new Date().toISOString(),
      orderId: updated.id,
    }),
  );

  return updated;
}

/** The state after this one, or null when the order has nowhere left to go. */
export function nextOrderState(state: OrderState): OrderState | null {
  const at = ORDER_FLOW.indexOf(state);
  if (at === -1 || at === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[at + 1];
}

/**
 * Advance one step along `ORDER_FLOW`.
 *
 * An order already at `"delivered"`, or at `"cancelled"` and so off the flow
 * entirely, comes back unchanged and writes nothing — a repeated tap must not
 * append a second "Delivered" line to the guest's thread.
 */
export function advanceOrder(propertySlug: string, orderId: string): RoomOrder | null {
  const current = readOrder(propertySlug, orderId);
  if (current === null) return null;
  const next = nextOrderState(current.state);
  if (next === null) return current;
  return setOrderState(propertySlug, orderId, next);
}

/** Cancel an order. Explicit, never reachable by advancing. */
export function cancelOrder(propertySlug: string, orderId: string): RoomOrder | null {
  return setOrderState(propertySlug, orderId, "cancelled");
}

/**
 * Post a reply as the desk.
 *
 * The operator side of the thread the guest is reading. Returns null for an
 * empty body or a thread id that is not ours, so a stale control fails quietly
 * rather than writing a blank bubble into someone's conversation.
 */
export function sendStaffMessage(threadId: string, body: string): ChatMessage | null {
  const text = body.trim();
  if (text.length === 0) return null;
  if (propertySlugFromThreadId(threadId) === null) return null;

  const message: ChatMessage = {
    id: mintId("MSG"),
    threadId,
    from: "staff",
    body: text,
    at: new Date().toISOString(),
  };
  writeOrderStore(appendMessage(readOrderStore(), message));
  return message;
}

/**
 * Put a named person on a desk, and tell the guest who they are now talking to.
 *
 * The lead is stored ON THE THREAD rather than in a second table, because the
 * thread is the only thing the guest reads. A lead held anywhere else would be
 * an operator-side fact about a conversation the guest sees a different name
 * on, which is the one thing this screen exists to prevent.
 */
export function setDepartmentLead(
  propertySlug: string,
  department: Department,
  lead: { name: string; role: string },
): ChatThread | null {
  const threadId = threadIdFor(propertySlug, department);
  const current = readThread(threadId);
  if (current === null) return null;
  if (current.leadName === lead.name && current.leadRole === lead.role) return current;

  const state = readOrderStore();
  const known = state.threads.some((thread) => thread.id === threadId);
  const updated: ChatThread = { ...current, leadName: lead.name, leadRole: lead.role };
  const withThread: OrderStoreState = {
    ...state,
    threads: known
      ? state.threads.map((thread) => (thread.id === threadId ? updated : thread))
      : [...state.threads, updated],
  };

  writeOrderStore(
    appendMessage(withThread, {
      id: mintId("MSG"),
      threadId,
      from: "system",
      body: `${lead.name} (${lead.role}) is on this desk now. Messages here reach them.`,
      at: new Date().toISOString(),
    }),
  );

  return updated;
}

/**
 * Put a property's conversations and orders back the way they were rehearsed.
 *
 * The between-demos reset. It drops only this property's rows, so resetting the
 * hotel does not wipe the guesthouse a colleague is mid-demo on.
 */
export function resetDemoProperty(propertySlug: string): void {
  const state = readOrderStore();
  writeOrderStore({
    orders: state.orders.filter((order) => order.propertySlug !== propertySlug),
    threads: state.threads.filter((thread) => thread.propertySlug !== propertySlug),
  });
}
