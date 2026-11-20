import type { TeamRolesMember, TeamRolesRole } from "@injishi/data/fixtures/owner";
import { describe, expect, test } from "vitest";
import {
  afterRoleChoices,
  notYetCandidates,
  OWNER_PRIVILEGES,
  timeLeft,
  transferCandidates,
} from "@/features/owner/ownership-model";

const member = (id: string, over: Partial<TeamRolesMember> = {}): TeamRolesMember => ({
  id,
  initials: id.slice(0, 2).toUpperCase(),
  name: `Person ${id}`,
  contact: `${id}@example.rw`,
  role: "waiter" as TeamRolesMember["role"],
  scope: "All properties",
  scopeIds: [],
  status: "active",
  lastActive: "Today",
  signIn: "—",
  avatarTone: "accent" as TeamRolesMember["avatarTone"],
  identityVerified: false,
  ...over,
});

describe("ownership transfer: who can receive it (display only, the API decides)", () => {
  const owner = member("own", { role: "owner" as TeamRolesMember["role"] });
  const manager = member("mgr", { role: "manager" as TeamRolesMember["role"], name: "Aline Uwase" });
  const waiter = member("wtr");
  const invited = member("inv", { status: "invited" });
  const revoked = member("rev", { status: "revoked" });
  const members = [owner, manager, waiter, invited, revoked];
  const roleName = (id: string) => ({ manager: "Manager", waiter: "Waiter", owner: "Owner" })[id] ?? id;

  test("the choices are exactly the API's eligible list, completed from the team list", () => {
    const eligible = [{ userId: "mgr", name: "Aline Uwase", roleLabel: "Manager" }];
    expect(transferCandidates(eligible, members, roleName)).toEqual([
      {
        userId: "mgr",
        name: "Aline Uwase",
        initials: "MG",
        contact: "mgr@example.rw",
        roleName: "Manager",
        scope: "All properties",
        avatarTone: "accent",
      },
    ]);
    // A list flag never adds anyone: the waiter is marked verified locally, but the API did not list them.
    const flagged = members.map((m) => (m.id === "wtr" ? { ...m, identityVerified: true } : m));
    expect(transferCandidates(eligible, flagged, roleName).map((c) => c.userId)).toEqual(["mgr"]);
    // Someone the API lists but the team list lacks still shows, with the API's own words.
    expect(
      transferCandidates([{ userId: "x", name: "Eric Habimana", roleLabel: "Cashier" }], [], roleName)[0],
    ).toMatchObject({ initials: "EH", roleName: "Cashier", contact: "" });
  });

  test("everyone else is explained; the owner and revoked people are not listed", () => {
    const eligible = [{ userId: "mgr", name: "Aline Uwase", roleLabel: "Manager" }];
    expect(notYetCandidates(eligible, members)).toEqual([
      {
        userId: "wtr",
        name: "Person wtr",
        reason:
          "Has not completed identity verification yet (an identity document is needed). They do this from their own account.",
      },
      { userId: "inv", name: "Person inv", reason: "Has not accepted the invitation yet." },
    ]);
  });

  test("the role kept afterwards is never Owner, a proposed role or staff", () => {
    const role = (id: string, over: Partial<TeamRolesRole> = {}) =>
      ({ id, name: id, proposed: false, invitable: true, cannot: `not ${id}`, ...over }) as TeamRolesRole;
    const choices = afterRoleChoices([
      role("owner"),
      role("manager"),
      role("staff"),
      role("storekeeper", { proposed: true }),
      role("frontdesk", { invitable: false }),
      role("cashier"),
    ]);
    expect(choices.map((c) => c.id)).toEqual(["manager", "cashier"]);
    expect(choices[0]).toEqual({ id: "manager", name: "manager", cannot: "not manager" });
  });

  test("time left on a request, in whole days", () => {
    const now = Date.parse("2026-11-20T12:00:00Z");
    expect(timeLeft("2026-11-27T12:00:00Z", now)).toBe("7 days left");
    expect(timeLeft("2026-11-21T13:00:00Z", now)).toBe("1 day left");
    expect(timeLeft("2026-11-20T20:00:00Z", now)).toBe("less than a day left");
    expect(timeLeft("2026-11-20T11:00:00Z", now)).toBe("expired");
  });

  test("the owner's privileges are described in plain words", () => {
    expect(OWNER_PRIVILEGES.map((p) => p.title)).toEqual([
      "Full access",
      "Plan and billing",
      "The team",
      "The final say",
    ]);
  });
});
