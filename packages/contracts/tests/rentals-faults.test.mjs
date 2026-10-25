/**
 * Rentals P4 (WP 4.1): the ticket lifecycle a rented home shares with a
 * hotel, the reopen window, the tabs and the fault requests.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

describe("the ticket chain", () => {
  test("every status has its moves, and every move lands on a real status", () => {
    assert.deepEqual(Object.keys(c.TICKET_MOVES).sort(), [...c.MaintenanceStatus.options].sort());
    for (const [from, tos] of Object.entries(c.TICKET_MOVES)) {
      for (const to of tos) {
        assert.ok(c.MaintenanceStatus.options.includes(to), `${from} -> ${to}`);
        assert.notEqual(from, to);
      }
    }
  });

  test("Reported > Seen > Assigned > In progress > Fixed > Closed is one legal path", () => {
    const path = ["open", "acknowledged", "assigned", "in_progress", "resolved", "closed"];
    for (let i = 1; i < path.length; i++) assert.ok(c.ticketMayMove(path[i - 1], path[i]), `${path[i - 1]} -> ${path[i]}`);
  });

  test("won't fix and cancelled from every open state; reopen from fixed, closed and won't fix", () => {
    for (const s of c.OPEN_TICKET_STATUSES) {
      assert.ok(c.ticketMayMove(s, "wont_fix"), s);
      assert.ok(c.ticketMayMove(s, "cancelled"), s);
    }
    for (const s of ["resolved", "closed", "wont_fix"]) assert.ok(c.ticketMayMove(s, "open"), s);
    assert.deepEqual(c.TICKET_MOVES.cancelled, []);
  });

  test("the moves people get wrong are refused", () => {
    assert.equal(c.ticketMayMove("open", "closed"), false);
    assert.equal(c.ticketMayMove("resolved", "in_progress"), false);
    assert.equal(c.ticketMayMove("in_progress", "acknowledged"), false);
    assert.equal(c.ticketMayMove("wont_fix", "closed"), false);
    assert.equal(c.ticketMayMove("closed", "resolved"), false);
  });

  test("every status has a landlord label and a tenant label, without dashes", () => {
    for (const s of c.MaintenanceStatus.options) {
      assert.ok(c.FAULT_STATUS_LABEL[s] && !/[—–]/.test(c.FAULT_STATUS_LABEL[s]), s);
      assert.ok(c.FAULT_STATUS_TENANT[s] && !/[—–]/.test(c.FAULT_STATUS_TENANT[s]), s);
    }
    assert.deepEqual(
      ["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix"].map((s) => c.FAULT_STATUS_LABEL[s]),
      ["Reported", "Seen", "Assigned", "In progress", "Fixed", "Closed", "Won't fix"],
    );
  });

  test("each status sits under exactly one tab", () => {
    for (const s of c.MaintenanceStatus.options) {
      const tabs = c.FaultTab.options.filter((t) => c.FAULT_TAB_STATUSES[t].includes(s));
      assert.equal(tabs.length, 1, s);
      assert.equal(c.faultTabOf(s), tabs[0]);
    }
  });
});

describe("the tenant's reopen window", () => {
  test("14 Kigali days from when it was settled, for fixed, closed and won't fix only", () => {
    const at = "2026-10-01T10:00:00+02:00";
    assert.equal(c.faultReopenUntil("resolved", at, "2026-10-15"), "2026-10-15");
    assert.equal(c.faultReopenUntil("closed", at, "2026-10-10"), "2026-10-15");
    assert.equal(c.faultReopenUntil("wont_fix", at, "2026-10-02"), "2026-10-15");
    assert.equal(c.faultReopenUntil("resolved", at, "2026-10-16"), null);
    assert.equal(c.faultReopenUntil("in_progress", at, "2026-10-02"), null);
    assert.equal(c.faultReopenUntil("cancelled", at, "2026-10-02"), null);
    assert.equal(c.faultReopenUntil("resolved", null, "2026-10-02"), null);
  });

  test("late at night in Kigali counts as that Kigali day", () => {
    // 23:30 Kigali on 1 October is 21:30 UTC the same day.
    assert.equal(c.faultReopenUntil("resolved", "2026-10-01T21:30:00Z", "2026-10-15"), "2026-10-15");
  });
});

describe("fault requests", () => {
  test("won't fix needs the reason", () => {
    assert.equal(c.MoveFaultRequest.safeParse({ to: "wont_fix" }).success, false);
    assert.equal(c.MoveFaultRequest.safeParse({ to: "wont_fix", note: "ok" }).success, false);
    assert.equal(c.MoveFaultRequest.safeParse({ to: "wont_fix", note: "The tenant caused it." }).success, true);
    assert.equal(c.MoveFaultRequest.safeParse({ to: "acknowledged" }).success, true);
  });

  test("assign names one team member or a fixer with a Rwandan phone", () => {
    const fixer = c.AssignFaultRequest.parse({ contractorName: "Eric", contractorPhone: "0788 000 111" });
    assert.equal(fixer.contractorPhone, "+250788000111");
    assert.equal(c.AssignFaultRequest.safeParse({ contractorName: "Eric" }).success, false);
    assert.equal(c.AssignFaultRequest.safeParse({ contractorName: "Eric", contractorPhone: "12345" }).success, false);
    assert.equal(c.AssignFaultRequest.safeParse({}).success, false);
    assert.equal(
      c.AssignFaultRequest.safeParse({ memberUserId: "11111111-1111-4111-8111-111111111111", contractorName: "Eric", contractorPhone: "0788000111" }).success,
      false,
    );
    assert.equal(c.AssignFaultRequest.safeParse({ memberUserId: "11111111-1111-4111-8111-111111111111" }).success, true);
  });

  test("a report from a form reads its checkbox and its defaults", () => {
    const r = c.ReportFaultRequest.parse({ title: "Tap leaking", staffMayEnter: "true" });
    assert.deepEqual(r, { title: "Tap leaking", category: "other", urgency: "normal", staffMayEnter: true });
    assert.equal(c.ReportFaultRequest.safeParse({ title: "x" }).success, false);
  });

  test("a move says what happened in plain words", () => {
    assert.equal(c.faultMoveWords("assigned", { who: "Eric" }), "Eric is assigned to fix it.");
    assert.equal(c.faultMoveWords("acknowledged"), "Your landlord has seen the report.");
    assert.equal(c.faultMoveWords("open", { from: "resolved", byTenant: true }), "Reopened: the tenant says it is not fixed.");
  });
});
