/**
 * The registration's device copy (ADR-075 S9, AC-9): the answers kept in this
 * browser as well as on the server, for the signed in person only, gone at
 * sign out and on submit, never holding an ID number or a photo.
 *
 * THIS RUNS THE REAL MODULE (`lib/register-device-copy.ts`) against a stand in
 * for `localStorage`, and the real `RegistrationDraft` contract it writes
 * through. The save status it feeds is `register-draft.test.mjs`.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./ts-source-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));

/** `localStorage`, standing in: a map, and a switch that makes it refuse writes the way a full one does. */
class Store {
  constructor() {
    this.map = new Map();
    this.full = false;
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    if (this.full) throw new Error("QuotaExceededError");
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
const store = new Store();
globalThis.window = { localStorage: store };

const { readDeviceCopy, writeDeviceCopy, clearDeviceCopy, clearDeviceCopies, chooseDraft } = await import(
  "@/lib/register-device-copy"
);

const draft = (over = {}) => ({
  v: 1,
  openStep: "you",
  reached: "you",
  done: ["tin"],
  kind: "coffee_shop",
  capacity: "owner",
  typedPersonal: true,
  personal: {
    firstName: "Aline",
    middleName: "",
    lastName: "Uwase",
    documentType: "national_id",
    issuingCountry: "RW",
    gender: "",
    dateOfBirth: "1990-04-02",
    phoneE164: "+250788300412",
    address: { country: "RW" },
  },
  intendedOwner: { name: "", email: "" },
  business: { legalName: "Kivu Coffee Ltd", tin: "999031002", address: { country: "RW" } },
  branches: [],
  ...over,
});

beforeEach(() => {
  store.map.clear();
  store.full = false;
});

describe("the copy is this person's alone", () => {
  test("kept under the signed in person's id, and read back only for them", () => {
    assert.equal(writeDeviceCopy("user-a", { draft: draft(), pending: true, basedOn: "2026-10-26T09:00:00.000Z" }), true);
    assert.deepEqual(readDeviceCopy("user-a"), { draft: draft(), pending: true, basedOn: "2026-10-26T09:00:00.000Z" });
    assert.equal(readDeviceCopy("user-b"), null);
  });

  test("sign out deletes every copy; a person opening the wizard deletes anyone else's", () => {
    writeDeviceCopy("user-a", { draft: draft(), pending: false, basedOn: null });
    writeDeviceCopy("user-b", { draft: draft(), pending: false, basedOn: null });
    store.setItem("injishi-theme", "dark");
    clearDeviceCopies("user-b");
    assert.equal(readDeviceCopy("user-a"), null);
    assert.notEqual(readDeviceCopy("user-b"), null);
    clearDeviceCopies();
    assert.equal(readDeviceCopy("user-b"), null);
    // Nothing else this browser keeps is touched.
    assert.equal(store.getItem("injishi-theme"), "dark");
  });

  test("one copy goes on its own, on submit", () => {
    writeDeviceCopy("user-a", { draft: draft(), pending: false, basedOn: null });
    clearDeviceCopy("user-a");
    assert.equal(readDeviceCopy("user-a"), null);
  });

  test("lib/session.ts deletes every copy at sign out, and when the API answers that nobody is signed in", () => {
    const session = readFileSync(resolve(here, "../src/lib/session.ts"), "utf8");
    assert.equal(session.match(/clearDeviceCopies\(\)/g)?.length, 2, "the two places the copies go");
    // An error page read as "no session" deletes nothing: only a real answer does.
    assert.match(session, /if \(!\(res as \{ error\?: unknown \} \| null\)\?\.error\) clearDeviceCopies\(\);/);
  });
});

describe("never an ID number or a photo", () => {
  test("a draft the contract refuses is not kept, and the writer says so", () => {
    const smuggled = draft({ business: { legalName: "Kivu Coffee Ltd", note: "1199080012345678" } });
    assert.equal(writeDeviceCopy("user-a", { draft: smuggled, pending: true, basedOn: null }), false);
    assert.equal(store.length, 0);
  });

  test("a stored copy that no longer reads is no copy at all", () => {
    store.setItem("injishi:register-draft:user-a", JSON.stringify({ draft: { v: 2 }, pending: true }));
    assert.equal(readDeviceCopy("user-a"), null);
    store.setItem("injishi:register-draft:user-a", "{not json");
    assert.equal(readDeviceCopy("user-a"), null);
  });

  test("a browser that will not store it says so, so the header never claims it was saved on this phone", () => {
    store.full = true;
    assert.equal(writeDeviceCopy("user-a", { draft: draft(), pending: true, basedOn: null }), false);
  });
});

describe("which answers reopen the wizard", () => {
  const server = (savedAt, d = draft({ openStep: "business" })) => ({ draft: d, savedAt });

  test("a copy the server has not had wins while the server is where the copy left it, and is sent on", () => {
    const device = { draft: draft(), pending: true, basedOn: "2026-10-26T09:00:00.000Z" };
    assert.deepEqual(chooseDraft(server("2026-10-26T09:00:00.000Z"), device), {
      draft: device.draft,
      from: "device",
      push: true,
      dropDevice: false,
    });
  });

  test("but not once the server has moved on from another device", () => {
    const device = { draft: draft(), pending: true, basedOn: "2026-10-26T09:00:00.000Z" };
    const later = server("2026-10-27T08:00:00.000Z");
    assert.deepEqual(chooseDraft(later, device), { draft: later.draft, from: "server", push: false, dropDevice: false });
  });

  test("typing done offline before the server held anything is kept and sent", () => {
    const device = { draft: draft(), pending: true, basedOn: null };
    assert.equal(chooseDraft({ draft: null, savedAt: null }, device).from, "device");
  });

  test("an acknowledged copy has nothing the server lacks: the server's answers win", () => {
    const device = { draft: draft(), pending: false, basedOn: "2026-10-26T09:00:00.000Z" };
    assert.equal(chooseDraft(server("2026-10-27T08:00:00.000Z"), device).from, "server");
  });

  test("an acknowledged copy of a draft the server no longer holds is dropped", () => {
    const device = { draft: draft(), pending: false, basedOn: "2026-10-26T09:00:00.000Z" };
    assert.deepEqual(chooseDraft({ draft: null, savedAt: null }, device), {
      draft: null,
      from: "none",
      push: false,
      dropDevice: true,
    });
    assert.deepEqual(chooseDraft({ draft: null, savedAt: null }, null), {
      draft: null,
      from: "none",
      push: false,
      dropDevice: false,
    });
  });
});
