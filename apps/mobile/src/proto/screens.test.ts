// The registry and `href()` (proto-ui, PLAN.md "Registry and navigation"), under `node --test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { href, SCREEN_IDS, SCREENS, surfaceOf } from "./screens.ts";

describe("href", () => {
  test("fills a segment from params, else the screen's default", () => {
    assert.equal(href("guest-property", { slug: "forest-lodge" }), "/guest/property/forest-lodge");
    assert.equal(href("guest-property"), "/guest/property/isangano-lakeside-hotel");
  });

  test("adds the defaults and params as the query", () => {
    assert.equal(href("hk-task"), "/housekeeper/rooms/task?room=204");
    assert.equal(href("hk-task", { room: 305 }), "/housekeeper/rooms/task?room=305");
    assert.equal(href("hk-today"), "/housekeeper");
    assert.equal(href("guest-home-before"), "/guest?phase=before");
    assert.equal(href("shared-error"), "/resident/pay?proto=error");
    assert.equal(href("guest-chat", { thread: "a b&c" }), "/guest/chat?thread=a%20b%26c");
  });

  test("a shared screen opens at the app's own path when it has one", () => {
    assert.equal(href("shared-account", undefined, { app: "desk" }), "/desk/me/account");
    assert.equal(href("shared-account", undefined, { app: "housekeeper" }), "/guest/me/account");
    assert.equal(href("shared-notifs", undefined, { app: "technician" }), "/technician/notifications");
    assert.equal(href("hk-leave", undefined, { app: "technician" }), "/technician/leave");
  });

  test("the app a path is inside", () => {
    assert.equal(surfaceOf("/desk/me/account"), "desk");
    assert.equal(surfaceOf("/manager"), "manager");
    assert.equal(surfaceOf("/switcher"), null);
    assert.equal(surfaceOf("/"), null);
  });

  test("the registry holds all 99 screens, each under its own id", () => {
    assert.equal(SCREEN_IDS.length, 99);
    for (const id of SCREEN_IDS) assert.equal(SCREENS[id].id, id);
  });
});
