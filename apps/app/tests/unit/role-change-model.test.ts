import type { TeamRolesPermissionArea, TeamRolesRole } from "@injishi/data/fixtures/owner";
import { describe, expect, test } from "vitest";
import {
  permissionChange,
  ROLE_ACTION_HELP,
  roleAction,
  roleChoices,
  roleKeys,
  sensitiveGains,
} from "@/features/owner/role-change-model";
import type { TeamRolesPresets } from "@/features/owner/TeamRolesModel";

// The business's role settings as GET /ops/roles answers them (real permission keys, the API's own wording).
const areas: TeamRolesPermissionArea[] = [
  {
    id: "pos",
    label: "Point of sale",
    permissions: [
      { key: "pos.sell", description: "Take orders at the point of sale" },
      { key: "table.manage", description: "Open, transfer and close tables" },
      { key: "pos.checkout", description: "Take payment and settle bills" },
      { key: "register.operate", description: "Run a cashier shift" },
      { key: "pos.refund", description: "Refund point of sale payments" },
    ],
    proposedSplit: [],
    defaultOpen: false,
  },
  {
    id: "people",
    label: "People",
    permissions: [
      { key: "team.invite", description: "Give staff their logins" },
      { key: "customer.view", description: "Find and read customers" },
    ],
    proposedSplit: [],
    defaultOpen: true,
  },
];
const presets = {
  waiter: ["pos.sell", "table.manage", "customer.view"],
  cashier: ["pos.sell", "pos.checkout", "register.operate", "customer.view"],
  manager: [
    "pos.sell",
    "table.manage",
    "pos.checkout",
    "register.operate",
    "pos.refund",
    "team.invite",
    "customer.view",
  ],
} as unknown as TeamRolesPresets;

describe("changing a team member's role (display only, the API decides)", () => {
  test("Waiter → Cashier: gains and losses, by the business's own areas", () => {
    const c = permissionChange(areas, roleKeys(presets, "waiter"), roleKeys(presets, "cashier"));
    expect(c.gained).toEqual([
      {
        areaId: "pos",
        areaLabel: "Point of sale",
        items: [
          { key: "pos.checkout", description: "Take payment and settle bills" },
          { key: "register.operate", description: "Run a cashier shift" },
        ],
      },
    ]);
    expect(c.lost).toEqual([
      {
        areaId: "pos",
        areaLabel: "Point of sale",
        items: [{ key: "table.manage", description: "Open, transfer and close tables" }],
      },
    ]);
    expect(c.kept).toBe(2);
    // Running a till is money: flagged, in the API's words.
    expect(sensitiveGains(c)).toEqual([{ key: "register.operate", description: "Run a cashier shift", kind: "Money" }]);
  });

  test("Manager → Waiter: only losses, nothing sensitive gained", () => {
    const c = permissionChange(areas, roleKeys(presets, "manager"), roleKeys(presets, "waiter"));
    expect(c.gained).toEqual([]);
    expect(c.lost.flatMap((a) => a.items.map((i) => i.key))).toEqual([
      "pos.checkout",
      "register.operate",
      "pos.refund",
      "team.invite",
    ]);
    expect(sensitiveGains(c)).toEqual([]);
  });

  test("Cashier → Manager flags refunds and staff logins", () => {
    const c = permissionChange(areas, roleKeys(presets, "cashier"), roleKeys(presets, "manager"));
    expect(sensitiveGains(c).map((s) => `${s.kind}:${s.key}`)).toEqual([
      "Money:pos.refund",
      "Staff access:team.invite",
    ]);
  });

  test("a key the areas do not list is still shown, by its key, never invented", () => {
    const c = permissionChange(areas, [], ["pos.sell", "x.unknown"]);
    expect(c.gained.at(-1)).toEqual({
      areaId: "other",
      areaLabel: "Other",
      items: [{ key: "x.unknown", description: "x.unknown" }],
    });
  });

  test("the roles offered: real, grantable roles only; never the owner; the current one marked", () => {
    const role = (id: string, over: Partial<TeamRolesRole> = {}) =>
      ({ id, name: id, proposed: false, invitable: true, beingDefined: false, ...over }) as TeamRolesRole;
    const choices = roleChoices(
      [
        role("owner", { invitable: false }),
        role("manager"),
        role("cashier"),
        role("waiter"),
        role("store", { beingDefined: true }),
      ],
      presets,
      "waiter",
    );
    expect(choices.map((c) => `${c.id}${c.current ? "*" : ""}:${c.count}`)).toEqual([
      "manager:7",
      "cashier:4",
      "waiter*:3",
    ]);
  });

  test("what Manage offers for each kind of member", () => {
    expect(roleAction({ role: "waiter", status: "active" })).toBe("change");
    expect(roleAction({ role: "owner", status: "active" })).toBe("owner");
    expect(roleAction({ role: "cashier", status: "invited" })).toBe("invited");
    expect(roleAction({ role: "cashier", status: "pending" })).toBe("pending");
    expect(roleAction({ role: "waiter", status: "revoked" })).toBe("revoked");
    expect(ROLE_ACTION_HELP.invited).toMatch(/cancel this invitation and send a new one/);
    expect(ROLE_ACTION_HELP.owner).toMatch(/Transfer ownership/);
  });
});
