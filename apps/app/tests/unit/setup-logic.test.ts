import { describe, expect, test } from "vitest";
import {
  bulkLabels,
  businessDayNote,
  businessDayText,
  clock,
  DAY_START_CHOICES,
  isDirty,
  labelClashes,
  moved,
  NO_SECTION,
  nextNumber,
  routesTo,
  routingSections,
  SETUP_STEPS,
  stepFrom,
  stepState,
  tinValid,
} from "@/features/pos/setup-logic";
import type { PosOutlet, PosSetup, PosVenue, PosVenueRoute } from "@/server/pos";

const route = (id: string, section: string | null, stationId: string | null): PosVenueRoute => ({
  serviceItemId: id,
  name: id,
  categoryName: section,
  stationId,
});

const emptyVenue: PosVenue = { outletId: "o", areas: [], tables: [], stations: [], registers: [], routing: [] };
const setup = (receipts: boolean): PosSetup => ({
  outletId: "o",
  steps: [{ key: "receipts", done: receipts, count: receipts ? 1 : 0 }],
  doneCount: receipts ? 1 : 0,
  total: 9,
});
const outlet = (tin: string, address: string): PosOutlet => ({
  id: "o",
  name: "Test",
  outletKind: "restaurant",
  propertyId: null,
  branchName: null,
  settings: {
    outletId: "o",
    taxMode: "exclusive",
    discountLimitBps: 1000,
    enabledMethods: ["cash"],
    receiptHeader: "",
    receiptFooter: "",
    venueTin: tin,
    venuePhone: "",
    venueAddress: address,
    businessDayStartMinutes: 0,
  },
});

describe("setup steps", () => {
  test("the rail lists every step once, starting with the overview", () => {
    const keys = SETUP_STEPS.map((s) => s.key);
    expect(keys[0]).toBe("overview");
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("archived");
  });

  test("an unknown or missing ?step= opens the overview", () => {
    expect(stepFrom("routing")).toBe("routing");
    expect(stepFrom("nonsense")).toBe("overview");
    expect(stepFrom(undefined)).toBe("overview");
  });

  test("a step is done only when what it sets up exists", () => {
    const o = outlet("", "");
    expect(stepState("floor", emptyVenue, setup(false), o)).toBe("todo");
    const floor = {
      ...emptyVenue,
      areas: [{ id: "a", name: "Hall", sortOrder: 10, tableCount: 1 }],
      tables: [
        {
          id: "t",
          areaId: "a",
          label: "T1",
          seats: 4,
          status: "available" as const,
          sortOrder: 10,
          hasOpenSession: false,
        },
      ],
    };
    expect(stepState("floor", floor, setup(false), o)).toBe("done");
    expect(stepState("routing", { ...emptyVenue, routing: [route("a", "Beer", null)] }, setup(false), o)).toBe("todo");
    expect(stepState("routing", { ...emptyVenue, routing: [route("a", "Beer", "s")] }, setup(false), o)).toBe("done");
    expect(stepState("venue", emptyVenue, setup(false), outlet("123456789", ""))).toBe("todo");
    expect(stepState("venue", emptyVenue, setup(false), outlet("123456789", "KN 5 Rd, Kigali"))).toBe("done");
    expect(stepState("receipts", emptyVenue, setup(true), o)).toBe("done");
    expect(stepState("overview", emptyVenue, setup(false), o)).toBe("info");
  });
});

describe("bulk tables", () => {
  test("makes prefix + number labels, as the API does", () => {
    expect(bulkLabels("T", 1, 3)).toEqual(["T1", "T2", "T3"]);
    expect(bulkLabels(" Table ", 9, 2)).toEqual(["Table9", "Table10"]);
    expect(bulkLabels("T", 1, 0)).toEqual([]);
    expect(bulkLabels("T", 1, 80)).toHaveLength(50);
  });

  test("finds clashes and the next free number", () => {
    expect(labelClashes(["T1", "T2", "T3"], ["T2", "B1"])).toEqual(["T2"]);
    expect(nextNumber("T", ["T1", "T2", "T8", "TR3", "B9"])).toBe(9);
    expect(nextNumber("TR", ["T1", "TR3"])).toBe(4);
    expect(nextNumber("X", [])).toBe(1);
  });
});

describe("routing by section", () => {
  const routing = [route("beer1", "Beer", null), route("beer2", "Beer", "bar"), route("soup", null, "kitchen")];

  test("groups items by section and says when a whole section shares a station", () => {
    const s = routingSections(routing);
    expect(s.map((x) => x.name)).toEqual(["Beer", NO_SECTION]);
    expect(s[0]?.unrouted).toBe(1);
    expect(s[0]?.commonStationId).toBeNull();
    expect(s[1]?.commonStationId).toBe("kitchen");
  });

  test("sends only the items that are not there yet", () => {
    expect(routesTo(routing.slice(0, 2), "bar")).toEqual([{ serviceItemId: "beer1", stationId: "bar" }]);
    expect(routesTo(routing.slice(0, 2), null)).toEqual([{ serviceItemId: "beer2", stationId: null }]);
  });
});

describe("reorder", () => {
  test("moves one place and stays put at the ends", () => {
    expect(moved(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moved(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moved(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});

describe("venue details and business day", () => {
  test("a TIN is empty or 9 digits", () => {
    expect(tinValid("")).toBe(true);
    expect(tinValid("123456789")).toBe(true);
    expect(tinValid("12345678")).toBe(false);
    expect(tinValid("12345678A")).toBe(false);
  });

  test("times read as a clock, and the choices run from midnight to 06:00", () => {
    expect(clock(0)).toBe("00:00");
    expect(clock(270)).toBe("04:30");
    expect(DAY_START_CHOICES[0]).toBe(0);
    expect(DAY_START_CHOICES.at(-1)).toBe(360);
    expect(businessDayText(0)).toMatch(/Calendar day/);
    expect(businessDayText(240)).toBe("04:00 to 04:00 the next day");
  });

  test("a report notes its business day only when it is not the calendar day", () => {
    expect(businessDayNote(undefined)).toBeNull();
    expect(businessDayNote({ startMinutes: 0, mixed: false })).toBeNull();
    expect(businessDayNote({ startMinutes: 240, mixed: false })).toMatch(/04:00/);
    expect(businessDayNote({ startMinutes: 0, mixed: true })).toMatch(/different times/);
  });
});

describe("unsaved changes", () => {
  test("compares fields, arrays as sets and strings without outer spaces", () => {
    const saved = { a: "x", methods: ["cash", "card"], n: 1 };
    expect(isDirty(saved, { a: " x ", methods: ["card", "cash"], n: 1 })).toBe(false);
    expect(isDirty(saved, { a: "y", methods: ["cash", "card"], n: 1 })).toBe(true);
    expect(isDirty(saved, { a: "x", methods: ["cash"], n: 1 })).toBe(true);
    expect(isDirty(saved, { a: "x", methods: ["cash", "card"], n: 2 })).toBe(true);
  });
});
