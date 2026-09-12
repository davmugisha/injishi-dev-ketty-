/**
 * ROOM ORDERS AND THE CHAT THEY TRACK IN — ONE STORE, DELIBERATELY.
 *
 * FABRICATED STATE. No order placed here reaches a kitchen, no message reaches
 * a member of staff, and every name below belongs to nobody. It is
 * `localStorage` in one browser. It must not be described to anyone as a real
 * order or a real conversation.
 *
 * WHY ONE STORE AND NOT TWO. The product decision is that order tracking
 * happens inside the chat: a guest watches an order move by reading the thread,
 * not by opening a separate tracker. Two stores would make that a synchronisation
 * problem — an order advancing to `"on_the_way"` while its thread still says
 * `"preparing"` is not a cosmetic defect, it is the feature failing. So an order
 * carries the id of its thread, every state change writes the message in the
 * same call that writes the state, and neither can be done without the other.
 *
 * SERVER SAFETY. Every read and write is guarded on `typeof window` and wrapped
 * in `try`: this module is imported by files that also render on the server, and
 * `localStorage` throws in a browser with site data blocked. The two read paths
 * answer differently on purpose. `readOrders` comes back empty, because an order
 * only ever exists because somebody placed it in this browser. `readThreads`
 * comes back SEEDED, because the five department conversations exist for every
 * guest at every property — so a server-rendered inbox lists all five desks and
 * the first client render agrees with it rather than replacing it.
 *
 * NO `Math.random`, NO `Date.now` DURING RENDER. Every seeded thread id, message
 * id and timestamp below is a literal derived from the property slug and the
 * department, so the server and the client produce identical markup. Fresh ids
 * and fresh timestamps are minted only inside `placeOrder`, `advanceOrder` and
 * the message senders — all of which run from an event handler or an effect,
 * never during a render.
 */

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
   * Copied onto the line rather than resolved from `data/dining.ts` at render
   * time, because a menu is edited and an order is history. A dish renamed or
   * withdrawn next week must not silently rewrite what a guest ordered last
   * week, and `priceRwf` is on the line for the same reason.
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
 * A closed set rather than free text: the chat list, the PMS inbox and the
 * order router all key off it, and a sixth spelling of "front desk" would give
 * a guest a thread nobody in the PMS can see.
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
   * change — and is styled apart from a person on purpose: a guest must never
   * read an automatic status line as something a member of staff typed.
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
  leadName: string;
  leadRole: string;
  propertySlug: string;
  messages: ChatMessage[];
}

/** Everything this store holds, as one persisted blob. */
export interface OrderStoreState {
  orders: RoomOrder[];
  threads: ChatThread[];
}

/* ------------------------------------------------------- state vocabularies */

/** The departments, in the order a guest should be offered them. */
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

/**
 * What each desk is for, in the guest's words.
 *
 * A picker that lists five department names and nothing else makes the guest
 * guess which one takes a broken kettle, and the guess lands on Front desk
 * every time.
 */
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
 * Rwandan names and real hotel job titles, written so a Kigali audience reads a
 * plausible front office rather than "Staff Member 1". Nobody named here works
 * at any of the properties this store attaches them to.
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
 * `"cancelled"` is absent by design — see the note on `OrderState`. An order at
 * `"delivered"` has nowhere left to go and `advanceOrder` returns it unchanged
 * rather than throwing, because a double-tap on a PMS button is a user
 * behaviour, not an exception.
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

/**
 * The system message written when an order reaches each state.
 *
 * Kept in one table rather than composed at each call site, because these lines
 * ARE the order tracker as far as the guest is concerned, and six sentences
 * scattered across three files is how a tracker comes to say "Delivered" in the
 * thread and "On the way" on the card.
 */
export const ORDER_STATE_MESSAGE: Record<OrderState, string> = {
  placed: "Order received. The kitchen has it and will confirm shortly.",
  accepted: "The kitchen has accepted your order.",
  preparing: "Your order is being prepared.",
  on_the_way: "Your order has left the kitchen and is on its way up.",
  delivered: "Your order has been delivered. Enjoy it.",
  cancelled: "This order has been cancelled. Nothing has been charged to your room.",
};

/** States an order cannot leave. */
export const TERMINAL_ORDER_STATES: OrderState[] = ["delivered", "cancelled"];

export function isTerminalOrderState(state: OrderState): boolean {
  return TERMINAL_ORDER_STATES.includes(state);
}

/**
 * The desk an order reports into.
 *
 * Every food and drink order goes to the kitchen thread, including one that is
 * nothing but beer: in this demo the kitchen desk owns room service end to end,
 * and splitting bar orders to a sixth thread would give the guest two places to
 * look for one delivery. It is a function rather than a constant so the routing
 * has a single place to change when the bar gets its own desk.
 */
export function departmentForOrder(): Department {
  return "kitchen";
}

/* ------------------------------------------------------------------- totals */

/** The one definition of what an order costs. Whole francs; no minor units. */
export function orderTotalRwf(lines: OrderLine[]): number {
  return lines.reduce((total, line) => total + line.priceRwf * line.qty, 0);
}

/** How many items are in a cart, counting quantities. */
export function orderItemCount(lines: OrderLine[]): number {
  return lines.reduce((count, line) => count + line.qty, 0);
}

/* ------------------------------------------------------------------ seeding */

const STORAGE_KEY = "injishi:room-orders";

/**
 * Fired on every write, because `storage` is not enough.
 *
 * The browser does not deliver `storage` to the tab that wrote the value, so
 * without this the order card and the chat thread — often on screen together —
 * would disagree until a reload.
 */
export const ORDER_STORE_CHANGE_EVENT = "injishi:room-orders-change";

/**
 * Fixed clock times for the seeded conversation.
 *
 * Literal ISO strings, not offsets from `Date.now()`. A seeded thread is
 * rendered on the very first paint, so its timestamps have to be identical on
 * the server and in the browser; anything computed from the current time
 * differs by milliseconds and React discards the tree. The date is deliberately
 * the same for every property, so a demo never shows two hotels whose front
 * desks apparently opened on different days.
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
      from: "staff",
      at: SEED_AT("06:41"),
      body: "Check-out is 11:00. If you would like it later, tell me the night before and I will hold the room where I can.",
    },
  ],
  housekeeping: [
    {
      from: "staff",
      at: SEED_AT("07:15"),
      body: "Good morning. Housekeeping reaches your floor between nine and midday. Message me if you would rather we came later, or not at all today.",
    },
    {
      from: "staff",
      at: SEED_AT("07:16"),
      body: "Laundry collected before ten comes back the same evening. There is a bag in the wardrobe.",
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
      from: "staff",
      at: SEED_AT("08:31"),
      body: "The generator carries the whole building, so a cut on the grid should not reach your room. If your lights do go, tell me at once.",
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
 * The id of a department thread, derived from the property and the desk.
 *
 * Derived rather than generated, so the same guest at the same hotel gets the
 * same thread id on every device and on every render, and a URL like
 * `/inbox/<threadId>` survives a reload and a redeploy.
 */
export function threadIdFor(propertySlug: string, department: Department): string {
  return `${propertySlug}--${department}`;
}

/**
 * The five department threads for a property, fully seeded.
 *
 * PURE. It touches no storage and no clock, so it may be called during a server
 * render and during the first client render and both produce the same markup.
 * `readThreads` layers anything the guest has actually said on top of it.
 */
export function demoThreadsFor(propertySlug: string): ChatThread[] {
  return DEPARTMENTS.map((department) => {
    const id = threadIdFor(propertySlug, department);
    const lead = DEPARTMENT_LEAD[department];
    return {
      id,
      department,
      leadName: lead.name,
      leadRole: lead.role,
      propertySlug,
      messages: SEED_SCRIPT[department].map((line, index) => ({
        id: `${id}--seed-${index + 1}`,
        threadId: id,
        from: line.from,
        body: line.body,
        at: line.at,
      })),
    };
  });
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
 * Written out field by field rather than cast, because this data was last
 * touched by a previous deploy of this same file. A shape change would
 * otherwise reach a render as an object missing half its properties, and the
 * crash would land in a component rather than here where it can be discarded.
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
 * Empty — not seeded — because seeding needs a property slug and this function
 * does not have one. `readThreads(propertySlug)` is the seeded read.
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

/** Every order, newest first. Optionally narrowed to one property. */
export function readOrders(propertySlug?: string): RoomOrder[] {
  const orders = readOrderStore().orders;
  const scoped =
    propertySlug === undefined
      ? orders
      : orders.filter((order) => order.propertySlug === propertySlug);
  return [...scoped].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

/** One order, or null. */
export function readOrder(orderId: string): RoomOrder | null {
  return readOrderStore().orders.find((order) => order.id === orderId) ?? null;
}

/** The orders that are still moving — what a PMS board and a guest card show. */
export function readOpenOrders(propertySlug?: string): RoomOrder[] {
  return readOrders(propertySlug).filter((order) => !isTerminalOrderState(order.state));
}

/**
 * The five threads for a property, seeded then overlaid with what was said.
 *
 * The seed is the floor rather than a one-time write, so a desk added to
 * `DEPARTMENTS` later appears for a guest whose storage predates it, instead of
 * the guest being stuck with whatever five threads were seeded on their first
 * visit. A persisted thread wins wherever one exists.
 */
export function readThreads(propertySlug: string): ChatThread[] {
  const persisted = readOrderStore().threads.filter(
    (thread) => thread.propertySlug === propertySlug,
  );
  const byId = new Map(persisted.map((thread) => [thread.id, thread]));
  return demoThreadsFor(propertySlug).map((seeded) => byId.get(seeded.id) ?? seeded);
}

/**
 * One thread by id, or null.
 *
 * The property is read back out of the id rather than asked for, so a route
 * holding nothing but `/inbox/<threadId>` can resolve the thread without also
 * having to know which hotel the guest is in.
 */
export function readThread(threadId: string): ChatThread | null {
  const propertySlug = propertySlugFromThreadId(threadId);
  if (propertySlug === null) return null;
  return readThreads(propertySlug).find((thread) => thread.id === threadId) ?? null;
}

/** The property half of a thread id, or null when the id is not one of ours. */
export function propertySlugFromThreadId(threadId: string): string | null {
  const at = threadId.lastIndexOf("--");
  if (at <= 0) return null;
  const department = threadId.slice(at + 2);
  return isDepartment(department) ? threadId.slice(0, at) : null;
}

/** Every message in a thread, oldest first — reading order. */
export function readMessages(threadId: string): ChatMessage[] {
  return readThread(threadId)?.messages ?? [];
}

/** The orders reported into one thread, newest first. */
export function ordersInThread(threadId: string): RoomOrder[] {
  return readOrders().filter((order) => order.threadId === threadId);
}

/* ------------------------------------------------------------------- writes */

/**
 * Mint an id.
 *
 * Uses the clock and a counter, never `Math.random`: a random id differs
 * between a server render and a client render of the same thing, and this is
 * the defect the header warns about. Every caller of this function is an event
 * handler or an effect, so the clock has already diverged from the server's by
 * design and nothing is rendered from it before it is stored.
 */
let sequence = 0;
function mintId(prefix: string): string {
  sequence += 1;
  // The suffix carries no separator on purpose: `shortOrderRef` shows the last
  // four characters as the handle a guest reads out, and a hyphen landing
  // inside that window turns "Order 7K2K" into "Order 2K-1".
  return `${prefix}-${Date.now().toString(36)}${sequence.toString(36).padStart(2, "0")}`;
}

/**
 * Write a message into a thread, seeding that thread if it is not persisted yet.
 *
 * Private, because every public path into it also has something else to do —
 * post a guest's text, post a staff reply, or report an order. A bare
 * "append a message" export would let a caller write a system line without the
 * state change it claims to describe, which is the exact drift one store exists
 * to prevent.
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
 * Place an order AND announce it in the thread, in one call.
 *
 * Returns the order it created so the caller can navigate straight to the
 * thread that now carries it. There is no way to create an order without its
 * system message, and that is the point of this function existing.
 */
export function placeOrder(input: {
  propertySlug: string;
  room: string;
  lines: OrderLine[];
}): RoomOrder {
  const department = departmentForOrder();
  const threadId = threadIdFor(input.propertySlug, department);
  const at = new Date().toISOString();

  const order: RoomOrder = {
    id: mintId("ORD"),
    threadId,
    room: input.room,
    propertySlug: input.propertySlug,
    lines: input.lines,
    totalRwf: orderTotalRwf(input.lines),
    state: "placed",
    placedAt: at,
  };

  const state = readOrderStore();
  const withOrder: OrderStoreState = { ...state, orders: [...state.orders, order] };
  writeOrderStore(
    appendMessage(withOrder, {
      id: mintId("MSG"),
      threadId,
      from: "system",
      // The reference goes in the FIRST line as well as every later one. Without
      // it the opening message is the only one in the thread a guest cannot tie
      // to an order, which is exactly the message they scroll back to find.
      body: `${shortOrderRef(order)} · ${orderSummary(order)} — ${ORDER_STATE_MESSAGE.placed}`,
      at,
      orderId: order.id,
    }),
  );

  return order;
}

/**
 * Move an order to a named state and post the line that says so.
 *
 * Takes the target state rather than only stepping forward, because cancelling
 * is a jump and an operator occasionally needs to correct a mis-tap. Returns
 * null when the order is gone, so a stale PMS button fails quietly rather than
 * throwing into a render.
 */
export function setOrderState(orderId: string, next: OrderState): RoomOrder | null {
  const state = readOrderStore();
  const current = state.orders.find((order) => order.id === orderId);
  if (current === undefined) return null;
  if (current.state === next) return current;

  const updated: RoomOrder = { ...current, state: next };
  const withOrder: OrderStoreState = {
    ...state,
    orders: state.orders.map((order) => (order.id === orderId ? updated : order)),
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

/**
 * Advance one step along `ORDER_FLOW`.
 *
 * The PMS button. An order already at `"delivered"`, or at `"cancelled"` and so
 * off the flow entirely, comes back unchanged and writes nothing — a repeated
 * tap must not append a second "Delivered" line to the guest's thread.
 */
export function advanceOrder(orderId: string): RoomOrder | null {
  const current = readOrder(orderId);
  if (current === null) return null;
  const at = ORDER_FLOW.indexOf(current.state);
  if (at === -1 || at === ORDER_FLOW.length - 1) return current;
  return setOrderState(orderId, ORDER_FLOW[at + 1]);
}

/** Cancel an order. Explicit, never reachable by advancing. */
export function cancelOrder(orderId: string): RoomOrder | null {
  return setOrderState(orderId, "cancelled");
}

/** Post what the guest typed. Returns null when the thread id is not ours. */
export function sendGuestMessage(threadId: string, body: string): ChatMessage | null {
  return sendMessage(threadId, "guest", body);
}

/**
 * Post a reply as the desk.
 *
 * The operator side of the same thread. It is here rather than in the PMS so
 * that both sides append through one function; two appenders is how a guest
 * message and a staff message came to carry differently shaped ids.
 */
export function sendStaffMessage(threadId: string, body: string): ChatMessage | null {
  return sendMessage(threadId, "staff", body);
}

function sendMessage(
  threadId: string,
  from: "guest" | "staff",
  body: string,
): ChatMessage | null {
  const text = body.trim();
  if (text.length === 0) return null;
  if (propertySlugFromThreadId(threadId) === null) return null;

  const message: ChatMessage = {
    id: mintId("MSG"),
    threadId,
    from,
    body: text,
    at: new Date().toISOString(),
  };
  writeOrderStore(appendMessage(readOrderStore(), message));
  return message;
}

/**
 * Persist the seeded threads for a property.
 *
 * `readThreads` already falls back to the seed, so this is not needed to READ a
 * conversation. It is here for the demo reset: writing the seed explicitly is
 * what returns a browser that has been demoed into all afternoon to the state
 * the presenter rehearsed.
 */
export function seedDemoThreads(propertySlug: string): ChatThread[] {
  const state = readOrderStore();
  const others = state.threads.filter((thread) => thread.propertySlug !== propertySlug);
  const seeded = demoThreadsFor(propertySlug);
  writeOrderStore({ ...state, threads: [...others, ...seeded] });
  return seeded;
}

/** Wipe every order and every conversation. The between-demos reset. */
export function resetOrderStore(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(ORDER_STORE_CHANGE_EVENT));
  } catch {
    /* Nothing to clear in a browser that never let anything be written. */
  }
}

/* ------------------------------------------------------------------ wording */

/** "2 × Beef brochettes, 1 × Primus lager" — an order read aloud. */
export function orderSummary(order: RoomOrder): string {
  return order.lines.map((line) => `${line.qty} × ${line.name}`).join(", ");
}

/**
 * "Order 4F2A" — the handle a guest and a member of staff say to each other.
 *
 * The last four characters of the id, upper-cased. A full minted id is
 * unreadable over a telephone, and the room number is already on the ticket, so
 * a short suffix is enough to tell two of a guest's orders apart.
 */
export function shortOrderRef(order: RoomOrder): string {
  return `Order ${order.id.slice(-4).toUpperCase()}`;
}
