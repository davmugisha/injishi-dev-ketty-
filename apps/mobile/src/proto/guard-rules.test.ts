// Who may open which app (proto-ui, PLAN.md "Mock session"), under `node --test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { type GuardInput, guardFor, personaApp } from "./guard-rules.ts";

const api = (over: Partial<GuardInput>): GuardInput => ({
  mode: "api",
  status: "signed-in",
  personaId: null,
  stepUpOwed: false,
  ...over,
});

describe("guards", () => {
  test("mock mode opens every app to anyone", () => {
    for (const app of ["guest", "housekeeper", "resident", "manager", "desk"] as const) {
      assert.deepEqual(guardFor(app, { mode: "mock", status: "loading", personaId: null, stepUpOwed: true }), {
        kind: "open",
      });
    }
  });

  test("api mode waits for the stored session", () => {
    assert.equal(guardFor("guest", api({ status: "loading" })).kind, "wait");
  });

  test("the guest app is open, but sends another app's person home", () => {
    assert.equal(guardFor("guest", api({ status: "signed-out" })).kind, "open");
    assert.equal(guardFor("guest", api({ personaId: "guest" })).kind, "open");
    assert.deepEqual(guardFor("guest", api({ personaId: "housekeeper" })), { kind: "redirect", to: "/" });
  });

  test("staff apps need a staff person who passed the step up", () => {
    assert.deepEqual(guardFor("housekeeper", api({ status: "signed-out" })), { kind: "redirect", to: "/" });
    assert.deepEqual(guardFor("housekeeper", api({ personaId: "housekeeper", stepUpOwed: true })), {
      kind: "redirect",
      to: "/two-factor",
    });
    assert.equal(guardFor("housekeeper", api({ personaId: "housekeeper" })).kind, "open");
    assert.equal(guardFor("supervisor", api({ personaId: "technician" })).kind, "open");
    assert.deepEqual(guardFor("technician", api({ personaId: "guest" })), { kind: "redirect", to: "/" });
  });

  test("resident, manager and desk need a signed in person", () => {
    assert.deepEqual(guardFor("resident", api({ status: "signed-out" })), { kind: "redirect", to: "/" });
    assert.equal(guardFor("resident", api({ personaId: "tenant" })).kind, "open");
    assert.equal(guardFor("desk", api({ status: "unreachable", personaId: "frontdesk" })).kind, "open");
  });

  test("each persona's own app", () => {
    assert.equal(personaApp("housekeeper"), "housekeeper");
    assert.equal(personaApp("supervisor"), "supervisor");
    assert.equal(personaApp("technician"), "technician");
    assert.equal(personaApp("guest"), "guest");
    assert.equal(personaApp("tenant"), "resident");
    assert.equal(personaApp("manager"), "manager");
    assert.equal(personaApp("frontdesk"), "desk");
    assert.equal(personaApp("finance"), "guest");
  });
});
