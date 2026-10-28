/**
 * The status maps cover every status the contracts define, with the contracts' own words.
 *
 *   pnpm --filter @injishi/ui test
 *
 * Contracts is read from its committed `dist` (CommonJS, zod 3) by path: the kit keeps plain string
 * literals so the app's zod 4 never meets contracts' zod 3, and this test is what keeps them in step.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { STATUS_LABEL, STATUS_TONE, STATUS_VALUES, type StatusKind, statusLabel, statusTone } from "../src/status.ts";

interface ZodEnumLike {
  options: readonly string[];
}
const contracts = createRequire(import.meta.url)("../../contracts/dist/index.js") as Record<string, unknown>;
const zodEnum = (name: string): readonly string[] => {
  const value = contracts[name] as ZodEnumLike | undefined;
  assert.ok(value && Array.isArray(value.options), `contracts exports ${name}`);
  return value.options;
};
const labels = (name: string): Record<string, string> => {
  const value = contracts[name] as Record<string, string> | undefined;
  assert.ok(value && typeof value === "object", `contracts exports ${name}`);
  return value;
};

/** Each kit kind backed by a contracts enum, and the contracts label map when there is one. */
const FROM_CONTRACTS: { kind: StatusKind; values: string; labels?: string }[] = [
  { kind: "lease", values: "LeaseStatus", labels: "LEASE_STATUS_LABEL" },
  { kind: "charge", values: "LeaseChargeStatus", labels: "LEASE_CHARGE_STATUS_LABEL" },
  { kind: "payment", values: "LeasePaymentStatus", labels: "LEASE_PAYMENT_STATUS_LABEL" },
  { kind: "deposit", values: "LeaseDepositStatus", labels: "LEASE_DEPOSIT_STATUS_LABEL" },
  { kind: "notice", values: "MoveOutNoticeStatus", labels: "MOVE_OUT_NOTICE_STATUS_LABEL" },
];

/** Values the kit adds on top of a contracts enum: states worked out on read, never stored. */
const DERIVED: Partial<Record<StatusKind, readonly string[]>> = {
  charge: ["overdue"],
  deposit: ["disputed"],
};

for (const { kind, values, labels: labelMap } of FROM_CONTRACTS) {
  test(`${kind}: every contracts ${values} value has a tone and a label`, () => {
    const vocab = zodEnum(values);
    const kit = STATUS_VALUES[kind] as readonly string[];
    for (const value of vocab) {
      assert.ok(kit.includes(value), `${kind} is missing "${value}"`);
      assert.ok((STATUS_TONE[kind] as Record<string, string>)[value], `${kind}.${value} has no tone`);
      assert.ok((STATUS_LABEL[kind] as Record<string, string>)[value], `${kind}.${value} has no label`);
    }
    const extra = kit.filter((v) => !vocab.includes(v));
    assert.deepEqual(extra, [...(DERIVED[kind] ?? [])], `${kind} has values contracts does not know`);
  });

  if (labelMap) {
    test(`${kind}: labels match contracts ${labelMap}`, () => {
      for (const [value, words] of Object.entries(labels(labelMap))) {
        assert.equal((STATUS_LABEL[kind] as Record<string, string>)[value], words, `${kind}.${value}`);
      }
    });
  }
}

test("the lease tabs cover every lease status", () => {
  const tabs = zodEnum("LeaseTab");
  // One tab per status, in the order a lease lives them (contracts lease.ts).
  assert.equal(tabs.length, STATUS_VALUES.lease.length);
});

test("units cover the contracts unit states that are not worked out from leases", () => {
  for (const state of zodEnum("RentalUnitState")) {
    if (state === "active") continue; // an active unit shows as occupied or vacant
    assert.ok((STATUS_VALUES.unit as readonly string[]).includes(state), `unit is missing "${state}"`);
  }
});

test("every kind maps every value to exactly one tone and label, and nothing else", () => {
  const tones = new Set(["default", "info", "success", "warning", "danger"]);
  for (const kind of Object.keys(STATUS_VALUES) as StatusKind[]) {
    const values = [...STATUS_VALUES[kind]].sort();
    assert.deepEqual(Object.keys(STATUS_TONE[kind]).sort(), values, `${kind} tones`);
    assert.deepEqual(Object.keys(STATUS_LABEL[kind]).sort(), values, `${kind} labels`);
    for (const tone of Object.values(STATUS_TONE[kind])) assert.ok(tones.has(tone), `${kind}: tone ${tone}`);
    for (const label of Object.values(STATUS_LABEL[kind]) as string[]) {
      assert.match(label, /^[A-Z][^—]*$/, `${kind}: "${label}" is sentence case with no em dash`);
    }
  }
});

test("an unknown status is neutral and reads as itself", () => {
  assert.equal(statusTone("lease", "on_hold"), "default");
  assert.equal(statusLabel("lease", "on_hold"), "On hold");
  assert.equal(statusTone("fault", "resolved"), "success");
  assert.equal(statusLabel("fault", "resolved"), "Fixed");
});
