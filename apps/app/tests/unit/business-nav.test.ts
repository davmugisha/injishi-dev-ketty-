import { describe, expect, test, vi } from "vitest";

// The builder is pure; its module also reads the request, which a unit test has none of.
vi.mock("@/server/data", () => ({ requestContext: vi.fn() }));
vi.mock("@/server/mutations/setup", () => ({ setupGlance: vi.fn() }));

const { businessNavGroups } = await import("@/server/business/nav");

const OWNER = [
  "listing.manage",
  "stay.checkin",
  "reservation.approve",
  "housekeeping.set",
  "message.send",
  "payout.manage",
  "money.view",
  "team.manage",
];
const ws = (registrationStatus: string, permissions: string[]) => ({
  workspaceId: "ws-1",
  registrationStatus,
  permissions,
});
const labels = (groups: ReturnType<typeof businessNavGroups>) =>
  groups.map((g) => [g.label, g.items.map((i) => i.label)]);

describe("the owner's sidebar is their own business", () => {
  test("in review: setting up the listing, and nothing else", () => {
    const groups = businessNavGroups(ws("tin_verified", ["listing.manage"]), {
      foodVenue: false,
      left: 3,
      published: false,
    });
    expect(labels(groups)).toEqual([[null, ["Set up your listing"]]]);
    expect(groups[0]?.items[0]).toMatchObject({ href: "/w/ws-1/setup", chip: "3" });
  });

  test("a live hotel: the desk and its guests, then the business", () => {
    const groups = businessNavGroups(ws("active", OWNER), { foodVenue: false, left: 0, published: true });
    expect(labels(groups)).toEqual([
      [null, ["Front desk", "Reservations", "Room rack", "Housekeeping", "Messages"]],
      ["Business", ["Your listing", "Getting paid", "Team"]],
    ]);
    expect(groups[1]?.items[1]?.href).toBe("/w/ws-1/getting-paid");
  });

  test("a venue is listed, not booked: no desk, reservations, housekeeping or payouts", () => {
    const groups = businessNavGroups(ws("active", OWNER), { foodVenue: true, left: 0, published: true });
    expect(labels(groups)).toEqual([
      [null, ["Messages"]],
      ["Business", ["Your listing", "Team"]],
    ]);
  });

  test("a manager without the team permission does not see Team", () => {
    const manager = OWNER.filter((p) => p !== "team.manage");
    const items = businessNavGroups(ws("active", manager), { foodVenue: false, left: 0, published: true }).flatMap(
      (g) => g.items.map((i) => i.id),
    );
    expect(items).not.toContain("team");
  });
});
