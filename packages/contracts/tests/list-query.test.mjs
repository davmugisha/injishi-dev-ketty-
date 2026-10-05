/**
 * The one list contract, pinned (ADR-058, 058-list-framework AC-LF3, AC-LF4).
 *
 * Three things carry the framework's safety and each is tested here: a list
 * refuses any field, operator or value its spec does not allow; a sensitive
 * field does not exist for a `basic` caller in any role (filter, sort, group);
 * and a query survives the trip through search parameters unchanged, so a
 * copied link opens the same view.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

const SPEC = c.defineListSpec({
  key: "test.people",
  searchable: true,
  statusField: "status",
  defaultSort: [{ field: "name", dir: "asc" }],
  fields: [
    { key: "name", label: "Name", type: "text", filterable: true, sortable: true },
    { key: "status", label: "Status", type: "enum", enumValues: ["active", "offboarded"], filterable: true, groupable: true },
    { key: "hiredOn", label: "Hired on", type: "date", filterable: true, sortable: true },
    { key: "wage", label: "Wage", type: "money", filterable: true, sortable: true, sensitive: true },
    { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
  ],
});

const parse = (input) => c.ListQuery.parse(input);
const issues = (input, view = "full") => c.checkListQuery(SPEC, parse(input), view).map((i) => i.path);

describe("defineListSpec refuses a broken declaration at load", () => {
  test("a duplicate field key", () => {
    assert.throws(() =>
      c.defineListSpec({ key: "x", fields: [{ key: "a", label: "A", type: "text" }, { key: "a", label: "A", type: "text" }] }),
    );
  });
  test("an enum without values", () => {
    assert.throws(() => c.defineListSpec({ key: "x", fields: [{ key: "a", label: "A", type: "enum" }] }));
  });
  test("a status field that is not an enum", () => {
    assert.throws(() =>
      c.defineListSpec({ key: "x", statusField: "a", fields: [{ key: "a", label: "A", type: "text" }] }),
    );
  });
  test("a default sort on a field that cannot be sorted", () => {
    assert.throws(() =>
      c.defineListSpec({ key: "x", defaultSort: [{ field: "a", dir: "asc" }], fields: [{ key: "a", label: "A", type: "text" }] }),
    );
  });
});

describe("checkListQuery allows only what the spec declares (AC-LF3)", () => {
  test("a fitting query has no issues", () => {
    assert.deepEqual(
      issues({
        q: "ada",
        filters: [
          { field: "status", op: "eq", value: "active" },
          { field: "hiredOn", op: "between", value: ["2026-01-01", "2026-06-30"] },
          { field: "branch", op: "in", value: ["b1", "b2"] },
        ],
        sort: [{ field: "hiredOn", dir: "desc" }],
        groupBy: "branch",
      }),
      [],
    );
  });
  test("an undeclared field is refused in every role", () => {
    assert.deepEqual(
      issues({
        filters: [{ field: "date_of_birth", op: "eq", value: "1990-01-01" }],
        sort: [{ field: "date_of_birth", dir: "asc" }],
        groupBy: "date_of_birth",
      }),
      ["filters.0", "sort.0", "groupBy"],
    );
  });
  test("a declared field outside its abilities is refused", () => {
    assert.deepEqual(issues({ sort: [{ field: "status", dir: "asc" }], groupBy: "name" }), ["sort.0", "groupBy"]);
  });
  test("an operator that does not apply to the type is refused", () => {
    assert.deepEqual(issues({ filters: [{ field: "status", op: "gt", value: "active" }] }), ["filters.0"]);
    assert.deepEqual(issues({ filters: [{ field: "name", op: "between", value: ["a", "b"] }] }), ["filters.0"]);
  });
  test("a value that does not fit is refused", () => {
    assert.deepEqual(issues({ filters: [{ field: "status", op: "eq", value: "retired" }] }), ["filters.0"]);
    assert.deepEqual(issues({ filters: [{ field: "hiredOn", op: "eq", value: "yesterday" }] }), ["filters.0"]);
    assert.deepEqual(issues({ filters: [{ field: "hiredOn", op: "between", value: ["2026-01-01"] }] }), ["filters.0"]);
    assert.deepEqual(issues({ filters: [{ field: "branch", op: "in", value: [] }] }), ["filters.0"]);
    assert.deepEqual(issues({ filters: [{ field: "branch", op: "isNull", value: "b1" }] }), ["filters.0"]);
  });
  test("search on a list without it is refused", () => {
    const plain = c.defineListSpec({ key: "y", fields: [{ key: "a", label: "A", type: "text" }] });
    assert.deepEqual(c.checkListQuery(plain, parse({ q: "x" }), "full").map((i) => i.path), ["q"]);
  });
});

describe("a sensitive field does not exist for a basic caller (AC-LF4)", () => {
  test("filtering, sorting or grouping on it is refused for basic, allowed for full", () => {
    const query = { filters: [{ field: "wage", op: "gt", value: 100000 }], sort: [{ field: "wage", dir: "desc" }] };
    assert.deepEqual(issues(query, "basic"), ["filters.0", "sort.0"]);
    assert.deepEqual(issues(query, "full"), []);
  });
  test("visibleFields drops it for basic only", () => {
    assert.ok(!c.visibleFields(SPEC, "basic").some((f) => f.key === "wage"));
    assert.ok(c.visibleFields(SPEC, "full").some((f) => f.key === "wage"));
  });
  test("fitListQuery strips what does not fit and keeps the rest", () => {
    const fitted = c.fitListQuery(
      SPEC,
      parse({ filters: [{ field: "wage", op: "gt", value: 1 }, { field: "status", op: "eq", value: "active" }] }),
      "basic",
    );
    assert.deepEqual(fitted.filters, [{ field: "status", op: "eq", value: "active" }]);
  });
});

describe("the query survives search parameters (AC-LF2)", () => {
  test("encode then decode returns the same query", () => {
    const query = parse({
      q: "kigali",
      filters: [
        { field: "status", op: "in", value: ["active"] },
        { field: "branch", op: "isNull" },
      ],
      sort: [{ field: "hiredOn", dir: "desc" }, { field: "name", dir: "asc" }],
      groupBy: "branch",
      page: 3,
      pageSize: 50,
    });
    const params = new URLSearchParams(c.encodeListQuery(query));
    const decoded = c.decodeListQuery(params);
    assert.ok(decoded.ok);
    assert.deepEqual(decoded.query, query);
  });
  test("defaults leave no trace", () => {
    assert.deepEqual(c.encodeListQuery(parse({})), {});
  });
  test("a malformed filter parameter is a shape error, not a crash", () => {
    const decoded = c.decodeListQuery(new URLSearchParams({ f: "{not json" }));
    assert.equal(decoded.ok, false);
  });
  test("a page size outside the list is refused", () => {
    assert.equal(c.decodeListQuery(new URLSearchParams({ size: "1000" })).ok, false);
  });
});

describe("every list key names the permissions its route declares", () => {
  test("each value is a real permission", () => {
    for (const [key, perms] of Object.entries(c.LIST_READ)) {
      assert.ok(perms.length > 0, `${key} has permissions`);
      for (const p of perms) assert.ok(c.Permission.options.includes(p), `${key}: ${p}`);
    }
  });
});
