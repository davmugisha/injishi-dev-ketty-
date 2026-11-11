import { describe, expect, test } from "vitest";
import {
  byPriority,
  DEFAULT_LIMITS,
  filterCounts,
  formatWait,
  inStation,
  isConnected,
  itemsToMake,
  limitsError,
  loadLimits,
  loadSound,
  loadTheme,
  matchesFilter,
  mentionsAllergy,
  newQueuedIds,
  parseStation,
  readLimits,
  recentlyDone,
  saveLimits,
  saveSound,
  saveTheme,
  shortOrderNumber,
  splitOption,
  stationCounts,
  urgencyOf,
  waitSeconds,
} from "@/features/pos/kds";
import type { PosTicket } from "@/server/pos";

const NOW = Date.parse("2026-11-07T12:00:00.000Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function ticket(over: Partial<PosTicket> & { id: string }): PosTicket {
  return {
    ticketNumber: `K-${over.id}`,
    orderId: `o-${over.id}`,
    orderNumber: "POS-261107-0004",
    stationId: "s1",
    stationName: "Kitchen",
    stationKind: "kitchen",
    status: "queued",
    tableLabel: "T1",
    waiterName: "Jean",
    orderType: "dine_in",
    guestNote: null,
    guestCount: null,
    items: [],
    createdAt: ago(1),
    startedAt: null,
    readyAt: null,
    servedAt: null,
    elapsedMinutes: 1,
    late: false,
    printCount: 0,
    ...over,
  };
}

describe("waiting time and urgency", () => {
  test("a ticket being made is timed from when it was sent", () => {
    expect(waitSeconds(ticket({ id: "a", status: "preparing", createdAt: ago(7) }), NOW)).toBe(7 * 60);
  });
  test("a ticket at the pass is timed from when it became ready", () => {
    const t = ticket({ id: "a", status: "ready", createdAt: ago(20), readyAt: ago(2) });
    expect(waitSeconds(t, NOW)).toBe(2 * 60);
  });
  test("a finished ticket stops counting", () => {
    const t = ticket({ id: "a", status: "served", createdAt: ago(30), readyAt: ago(12), servedAt: ago(10) });
    expect(waitSeconds(t, NOW)).toBe(20 * 60);
    expect(urgencyOf("served", 20 * 60, DEFAULT_LIMITS)).toBe("normal");
  });
  test("green below the first limit, orange from it, red from the second", () => {
    const l = { warnMinutes: 8, lateMinutes: 15 };
    expect(urgencyOf("queued", 8 * 60 - 1, l)).toBe("normal");
    expect(urgencyOf("queued", 8 * 60, l)).toBe("warning");
    expect(urgencyOf("preparing", 15 * 60 - 1, l)).toBe("warning");
    expect(urgencyOf("preparing", 15 * 60, l)).toBe("late");
  });
  test("a clock in the future never goes negative", () => {
    expect(waitSeconds(ticket({ id: "a", createdAt: ago(-5) }), NOW)).toBe(0);
  });
});

describe("automatic prioritisation", () => {
  const l = { warnMinutes: 8, lateMinutes: 15 };
  test("overdue first, then orange, then the rest, oldest first inside each", () => {
    const fresh = ticket({ id: "fresh", createdAt: ago(1) });
    const freshOlder = ticket({ id: "freshOlder", createdAt: ago(3) });
    const orange = ticket({ id: "orange", createdAt: ago(9) });
    const late = ticket({ id: "late", createdAt: ago(20) });
    const lateOlder = ticket({ id: "lateOlder", createdAt: ago(25) });
    const sorted = [fresh, orange, freshOlder, late, lateOlder].sort(byPriority(l, NOW)).map((t) => t.id);
    expect(sorted).toEqual(["lateOlder", "late", "orange", "freshOlder", "fresh"]);
  });
  test("equal age falls back to the ticket number, so the order never flickers", () => {
    const a = ticket({ id: "a", ticketNumber: "K-2", createdAt: ago(2) });
    const b = ticket({ id: "b", ticketNumber: "K-1", createdAt: ago(2) });
    expect([a, b].sort(byPriority(l, NOW)).map((t) => t.ticketNumber)).toEqual(["K-1", "K-2"]);
  });
  test("is independent of the order the tickets arrive in", () => {
    const set = [
      ticket({ id: "1", createdAt: ago(5) }),
      ticket({ id: "2", createdAt: ago(16) }),
      ticket({ id: "3", createdAt: ago(9) }),
    ];
    const a = [...set].sort(byPriority(l, NOW)).map((t) => t.id);
    const b = [...set]
      .reverse()
      .sort(byPriority(l, NOW))
      .map((t) => t.id);
    expect(a).toEqual(b);
  });
});

describe("the two displays and their filter", () => {
  const food = ticket({ id: "f", stationKind: "kitchen", orderType: "dine_in" });
  const drink = ticket({ id: "d", stationKind: "bar", orderType: "dine_in" });
  const takeawayFood = ticket({ id: "tf", stationKind: "kitchen", orderType: "takeaway" });
  const takeawayDrink = ticket({ id: "td", stationKind: "bar", orderType: "takeaway" });
  const delivery = ticket({ id: "dl", stationKind: "kitchen", orderType: "delivery" });
  const all = [food, drink, takeawayFood, takeawayDrink, delivery];
  test("the kitchen display holds the food stations and the bar display the drinks stations", () => {
    expect(all.filter((t) => inStation(t, "kitchen")).map((t) => t.id)).toEqual(["f", "tf", "dl"]);
    expect(all.filter((t) => inStation(t, "bar")).map((t) => t.id)).toEqual(["d", "td"]);
    expect(stationCounts(all)).toEqual({ kitchen: 3, bar: 2 });
  });
  test("inside a display, dine in and takeaway are separate and All keeps everything", () => {
    const kitchen = all.filter((t) => inStation(t, "kitchen"));
    expect(kitchen.filter((t) => matchesFilter(t, "dine_in")).map((t) => t.id)).toEqual(["f"]);
    expect(kitchen.filter((t) => matchesFilter(t, "takeaway")).map((t) => t.id)).toEqual(["tf"]);
    expect(kitchen.filter((t) => matchesFilter(t, "all"))).toHaveLength(3);
    expect(filterCounts(kitchen)).toEqual({ all: 3, dine_in: 1, takeaway: 1 });
  });
  test("an older ?kind= link still opens the right display, and anything else is the kitchen", () => {
    expect(parseStation("bar")).toBe("bar");
    expect(parseStation("drinks")).toBe("bar");
    expect(parseStation("kitchen")).toBe("kitchen");
    expect(parseStation("food")).toBe("kitchen");
    expect(parseStation(undefined)).toBe("kitchen");
    expect(parseStation("nonsense")).toBe("kitchen");
  });
});

describe("what a ticket shows", () => {
  test("a modifier reads as a label and a value", () => {
    expect(splitOption("Crust: Thin")).toEqual({ label: "Crust", value: "Thin" });
    expect(splitOption("Side: Chips, Salad")).toEqual({ label: "Side", value: "Chips, Salad" });
    expect(splitOption("Extra cheese")).toEqual({ label: null, value: "Extra cheese" });
    expect(splitOption(": odd")).toEqual({ label: null, value: ": odd" });
  });
  test("items still to make count what is queued or being prepared, not what is at the pass or voided", () => {
    const item = (quantity: number, status: "queued" | "cancelled" = "queued") => ({
      id: "i",
      orderItemId: "o",
      name: "x",
      quantity,
      options: [],
      note: null,
      status,
    });
    const list = [
      ticket({ id: "a", status: "queued", items: [item(2), item(1, "cancelled")] }),
      ticket({ id: "b", status: "preparing", items: [item(3)] }),
      ticket({ id: "c", status: "ready", items: [item(5)] }),
      ticket({ id: "d", status: "served", items: [item(7)] }),
    ];
    expect(itemsToMake(list)).toBe(5);
    expect(itemsToMake([])).toBe(0);
  });
});

describe("the connection indicator", () => {
  test("live while the board has been read recently, and reconnecting when it has not or the browser is offline", () => {
    expect(isConnected(true, null, 1_000_000)).toBe(true);
    expect(isConnected(true, 990_000, 1_000_000)).toBe(true);
    expect(isConnected(true, 979_999, 1_000_000)).toBe(false);
    expect(isConnected(false, 999_999, 1_000_000)).toBe(false);
  });
});

describe("limits", () => {
  test("whole minutes only, orange before red", () => {
    expect(limitsError(10, 15)).toBeNull();
    expect(limitsError(15, 15)).toMatch(/before/);
    expect(limitsError(20, 15)).toMatch(/before/);
    expect(limitsError(0, 15)).toMatch(/whole minutes/);
    expect(limitsError(1.5, 15)).toMatch(/whole minutes/);
    expect(limitsError(10, 241)).toMatch(/whole minutes/);
    expect(limitsError(Number.NaN, 15)).toMatch(/whole minutes/);
  });
  test("garbage read back from storage falls back to the defaults", () => {
    expect(readLimits(null)).toEqual(DEFAULT_LIMITS);
    expect(readLimits("x")).toEqual(DEFAULT_LIMITS);
    expect(readLimits({ warnMinutes: "5", lateMinutes: 9 })).toEqual(DEFAULT_LIMITS);
    expect(readLimits({ warnMinutes: 30, lateMinutes: 10 })).toEqual(DEFAULT_LIMITS);
    expect(readLimits({ warnMinutes: 5, lateMinutes: 9 })).toEqual({ warnMinutes: 5, lateMinutes: 9 });
  });
  test("limits and sound are remembered per outlet, and a broken store never throws", () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    saveLimits(store, "A", { warnMinutes: 4, lateMinutes: 6 });
    expect(loadLimits(store, "A")).toEqual({ warnMinutes: 4, lateMinutes: 6 });
    expect(loadLimits(store, "B")).toEqual(DEFAULT_LIMITS);
    expect(loadSound(store, "A")).toBe(true);
    saveSound(store, "A", false);
    expect(loadSound(store, "A")).toBe(false);
    expect(loadSound(store, "B")).toBe(true);
    mem.set("injishi.kds.limits.C", "{not json");
    expect(loadLimits(store, "C")).toEqual(DEFAULT_LIMITS);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadLimits(broken, "A")).toEqual(DEFAULT_LIMITS);
    expect(loadSound(broken, "A")).toBe(true);
    expect(() => saveLimits(broken, "A", DEFAULT_LIMITS)).not.toThrow();
    expect(() => saveSound(broken, "A", false)).not.toThrow();
    expect(loadLimits(null, "A")).toEqual(DEFAULT_LIMITS);
  });
});

describe("text", () => {
  test("clock text", () => {
    expect(formatWait(0)).toBe("0:00");
    expect(formatWait(65)).toBe("1:05");
    expect(formatWait(599)).toBe("9:59");
    expect(formatWait(3600 + 2 * 60 + 9)).toBe("1:02:09");
    expect(formatWait(-4)).toBe("0:00");
  });
  test("the short order number is the figure a cook calls out", () => {
    expect(shortOrderNumber("POS-261107-0004")).toBe("4");
    expect(shortOrderNumber("POS-261107-0123")).toBe("123");
    expect(shortOrderNumber("POS-261107-0000")).toBe("0");
    expect(shortOrderNumber("ORDER7")).toBe("ORDER7");
  });
});

describe("the new-order chime", () => {
  test("the first look announces nothing", () => {
    expect(newQueuedIds(null, [ticket({ id: "a" }), ticket({ id: "b" })])).toEqual([]);
  });
  test("only queued tickets not seen before count", () => {
    const seen = new Set(["a"]);
    const list = [ticket({ id: "a" }), ticket({ id: "b" }), ticket({ id: "c", status: "preparing" })];
    expect(newQueuedIds(seen, list)).toEqual(["b"]);
  });
  test("nothing new, nothing announced", () => {
    expect(newQueuedIds(new Set(["a", "b"]), [ticket({ id: "a" }), ticket({ id: "b" })])).toEqual([]);
  });
});

describe("recently done", () => {
  test("the ticket finished last leads, whatever time it was sent, and only this display's tickets count", () => {
    const collectedJustNow = ticket({
      id: "now",
      status: "served",
      createdAt: ago(40),
      readyAt: ago(5),
      servedAt: ago(0),
    });
    const collectedEarlier = ticket({
      id: "earlier",
      status: "served",
      createdAt: ago(30),
      readyAt: ago(20),
      servedAt: ago(15),
    });
    const cancelledLater = ticket({ id: "cancelled", status: "cancelled", createdAt: ago(2) });
    const otherDisplay = ticket({
      id: "bar",
      status: "served",
      stationKind: "bar",
      createdAt: ago(1),
      servedAt: ago(0),
    });
    const stillOpen = ticket({ id: "open", status: "preparing", createdAt: ago(1) });
    const ids = recentlyDone(
      [collectedEarlier, cancelledLater, otherDisplay, stillOpen, collectedJustNow],
      "kitchen",
    ).map((x) => x.id);
    expect(ids).toEqual(["now", "cancelled", "earlier"]);
    expect(recentlyDone([collectedEarlier, cancelledLater, otherDisplay], "bar").map((x) => x.id)).toEqual(["bar"]);
  });
  test("only the newest few are kept", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      ticket({ id: String(i), status: "served", createdAt: ago(60), servedAt: ago(i) }),
    );
    expect(recentlyDone(many, "kitchen")).toHaveLength(8);
    expect(recentlyDone(many, "kitchen", 3).map((x) => x.id)).toEqual(["0", "1", "2"]);
  });
});

describe("mentionsAllergy", () => {
  test("flags the words staff type for an allergy or intolerance", () => {
    for (const note of [
      "Nut allergy",
      "allergic to peanuts",
      "NO GLUTEN please",
      "celiac",
      "lactose intolerant",
      "nut-free",
      "shellfish",
    ]) {
      expect(mentionsAllergy(note)).toBe(true);
    }
  });
  test("leaves ordinary instructions alone, and an empty note", () => {
    for (const note of ["no ice", "well done", "extra spicy", "Doughnut on the side", "", null, undefined]) {
      expect(mentionsAllergy(note)).toBe(false);
    }
  });
});

describe("the board's look", () => {
  test("is dark (the venue kitchen display) until someone chooses light, and then it is remembered", () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(loadTheme(store)).toBe("dark");
    saveTheme(store, "light");
    expect(loadTheme(store)).toBe("light");
    saveTheme(store, "dark");
    expect(loadTheme(store)).toBe("dark");
  });
  test("falls back to dark when storage is missing or refuses", () => {
    expect(loadTheme(null)).toBe("dark");
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadTheme(broken)).toBe("dark");
    expect(() => saveTheme(broken, "dark")).not.toThrow();
  });
});
