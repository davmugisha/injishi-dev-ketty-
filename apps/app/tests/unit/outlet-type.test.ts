import { describe, expect, test } from "vitest";
import {
  destinationOf,
  kindsOf,
  OUTLET_TYPE_LABEL,
  onlyKind,
  outletTypeOf,
  sendPlan,
  stationsCrew,
  stationsName,
  suggestStation,
} from "@/features/pos/outlet-type";

const KITCHEN = { id: "k", kind: "kitchen" as const };
const KITCHEN_2 = { id: "k2", kind: "kitchen" as const };
const BAR = { id: "b", kind: "bar" as const };
const kinds = (...s: { kind: "kitchen" | "bar" }[]) => kindsOf(s);
const line = (kind: "kitchen" | "bar" | null, quantity = 1) => ({ kind, quantity });

describe("the outlet type comes from the stations it has", () => {
  test("kitchen only is a restaurant, bar only a bar, both a restaurant and bar", () => {
    expect(outletTypeOf(kinds(KITCHEN))).toBe("restaurant");
    expect(outletTypeOf(kinds(BAR))).toBe("bar");
    expect(outletTypeOf(kinds(KITCHEN, BAR))).toBe("restaurant_bar");
    expect(outletTypeOf(kinds())).toBe("none");
    expect(OUTLET_TYPE_LABEL.restaurant_bar).toBe("Restaurant + Bar");
  });
  test("two kitchens and no bar are still a single-station restaurant", () => {
    expect(outletTypeOf(kinds(KITCHEN, KITCHEN_2))).toBe("restaurant");
    expect(onlyKind(kinds(KITCHEN, KITCHEN_2))).toBe("kitchen");
    expect(onlyKind(kinds(KITCHEN, BAR))).toBeNull();
  });
  test("the screens and the crew are named after the stations that exist", () => {
    expect(stationsName(kinds(KITCHEN))).toBe("Kitchen");
    expect(stationsName(kinds(BAR))).toBe("Bar");
    expect(stationsName(kinds(KITCHEN, BAR))).toBe("Kitchen and bar");
    expect(stationsName(null)).toBe("Kitchen and bar");
    expect(stationsCrew(kinds(BAR))).toBe("Bartender");
    expect(stationsCrew(kinds(KITCHEN))).toBe("Chef");
  });
});

describe("where a line goes", () => {
  test("its own station first; with none, the only station of a single-station outlet", () => {
    expect(destinationOf("bar", kinds(KITCHEN, BAR))).toBe("bar");
    expect(destinationOf(null, kinds(BAR))).toBe("bar");
    expect(destinationOf(null, kinds(KITCHEN))).toBe("kitchen");
    expect(destinationOf(null, kinds(KITCHEN, BAR))).toBeNull();
  });
});

describe("the till's Send button", () => {
  test("bar only: everything, food included, goes to the bar", () => {
    // brochettes routed to the bar, whisky routed to the bar, a new dish with no station yet
    const p = sendPlan(kinds(BAR), [line("bar", 2), line("bar", 1), line(null, 1)]);
    expect(p.label).toBe("Send to Bar");
    expect(p.lines).toEqual(["4 items → Bar"]);
    expect(p.done).toBe("Order sent to Bar");
  });
  test("restaurant only: everything, drinks included, goes to the kitchen", () => {
    const p = sendPlan(kinds(KITCHEN), [line("kitchen", 1), line(null, 2)]);
    expect(p.label).toBe("Send to Kitchen");
    expect(p.lines).toEqual(["3 items → Kitchen"]);
    expect(p.done).toBe("Order sent to Kitchen");
  });
  test("restaurant and bar: one Send Order button, a summary per station, quantities counted", () => {
    // burger to the kitchen, beer and juice to the bar
    const p = sendPlan(kinds(KITCHEN, BAR), [line("kitchen"), line("bar"), line("bar")]);
    expect(p.label).toBe("Send Order");
    expect(p.lines).toEqual(["1 item → Kitchen", "2 items → Bar"]);
    expect(p.done).toBe("Order sent successfully: 1 item to Kitchen · 2 items to Bar");
    expect(sendPlan(kinds(KITCHEN, BAR), [line("bar", 2)]).lines).toEqual(["2 items → Bar"]);
  });
  test("restaurant and bar: an item with no station is never guessed", () => {
    const p = sendPlan(kinds(KITCHEN, BAR), [line("kitchen"), line(null)]);
    expect(p.label).toBe("Send Order");
    expect(p.lines).toEqual(["1 item → Kitchen", "1 item → No station set"]);
    expect(p.done).toBe("Order sent successfully: 1 item to Kitchen · 1 item with no station set");
  });
  test("nothing waiting, or no station at all", () => {
    expect(sendPlan(kinds(KITCHEN, BAR), [])).toEqual({
      label: "Send Order",
      lines: [],
      done: "Order sent successfully",
    });
    expect(sendPlan(kinds(BAR), []).label).toBe("Send to Bar");
    expect(sendPlan(kinds(), [line(null)]).lines).toEqual(["1 item → No station set"]);
  });
});

describe("automatic routing in Setup", () => {
  test("only a single-station outlet routes, to its first station", () => {
    expect(suggestStation([BAR])).toBe(BAR);
    expect(suggestStation([KITCHEN, KITCHEN_2])).toBe(KITCHEN);
  });
  test("an outlet with both, or none, gets no suggestion: nothing is guessed from a name", () => {
    expect(suggestStation([KITCHEN, BAR])).toBeNull();
    expect(suggestStation([])).toBeNull();
  });
});
