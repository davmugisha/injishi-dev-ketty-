import { describe, expect, test } from "vitest";
import { SETUP_STEPS, stepFrom, stepState, TEAM_STEPS, visibleSteps } from "@/features/pos/setup-logic";
import type { PosOutlet, PosSetup, PosVenue } from "@/server/pos";

const venue: PosVenue = { outletId: "o", areas: [], tables: [], stations: [], registers: [], routing: [] };
const setup = (team: boolean): PosSetup => ({
  outletId: "o",
  steps: [{ key: "team", done: team, count: team ? 3 : 0 }],
  doneCount: team ? 1 : 0,
  total: 9,
});
const outlet = {} as PosOutlet;

describe("setup is one place, grouped", () => {
  test("the rail groups its steps as Business, Operations, Floor and Team, in that order", () => {
    const groups = [...new Set(SETUP_STEPS.map((s) => s.group).filter(Boolean))];
    expect(groups).toEqual(["Business", "Operations", "Floor", "Team"]);
    expect(SETUP_STEPS.filter((s) => s.group === "Team").map((s) => s.key)).toEqual(["team", "roles"]);
    expect(SETUP_STEPS[0]?.key).toBe("overview");
    expect(SETUP_STEPS.at(-1)?.key).toBe("archived");
  });

  test("team management is a step of setup, reachable by its address", () => {
    expect(stepFrom("team")).toBe("team");
    expect(stepFrom("roles")).toBe("roles");
  });

  test("only someone who may manage the team sees the team steps", () => {
    const owner = visibleSteps(["outlet.manage", "team.manage"]).map((s) => s.key);
    const manager = visibleSteps(["outlet.manage"]).map((s) => s.key);
    expect(owner).toContain("team");
    expect(owner).toContain("roles");
    expect(manager.some((k) => TEAM_STEPS.has(k))).toBe(false);
    expect(manager).toContain("floor");
  });

  test("the team step is done once someone besides the owner is a member; roles are information", () => {
    expect(stepState("team", venue, setup(false), outlet)).toBe("todo");
    expect(stepState("team", venue, setup(true), outlet)).toBe("done");
    expect(stepState("roles", venue, setup(true), outlet)).toBe("info");
  });
});
