/**
 * The one list contract, pinned (ADR-058, 058-list-framework AC-LF3, AC-LF4).
 *
 * Four things carry the framework's safety and each is tested here: a list
 * refuses any field, operator or value its spec does not allow; a sensitive
 * field does not exist for a `basic` caller in any role (filter, sort, group);
 * a work figure can never be sorted, grouped or threshold filtered, and only
 * its audience sees it (AC-LF12); and a query survives the trip through search
 * parameters unchanged, so a copied link opens the same view.
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
  searchFields: ["name"],
  statusField: "status",
  defaultSort: [{ field: "name", dir: "asc" }],
  fields: [
    { key: "name", label: "Name", type: "text", filterable: true, sortable: true },
    { key: "status", label: "Status", type: "enum", enumValues: ["active", "offboarded"], filterable: true, groupable: true },
    { key: "hiredOn", label: "Hired on", type: "date", filterable: true, sortable: true },
    { key: "wage", label: "Wage", type: "money", filterable: true, sortable: true, sensitive: true },
    { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
    { key: "lateMinutes", label: "Late minutes", type: "number", filterable: true, figure: true },
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
  test("a work figure that could be sorted or grouped (AC-LF12)", () => {
    for (const ability of ["sortable", "groupable"]) {
      assert.throws(
        () => c.defineListSpec({ key: "x", fields: [{ key: "a", label: "A", type: "number", figure: true, [ability]: true }] }),
        /work figure/,
      );
    }
  });
  test("a search field that is undeclared, not text, sensitive or a figure (AC-LF13)", () => {
    const fields = [
      { key: "t", label: "T", type: "text" },
      { key: "n", label: "N", type: "number" },
      { key: "s", label: "S", type: "text", sensitive: true },
    ];
    assert.doesNotThrow(() => c.defineListSpec({ key: "x", searchFields: ["t"], fields }));
    for (const name of ["missing", "n", "s"]) {
      assert.throws(() => c.defineListSpec({ key: "x", searchFields: [name], fields }), /search field/);
    }
  });
  test("a stage field may be an enum or a ref, nothing else (AC-LF14)", () => {
    assert.doesNotThrow(() => c.defineListSpec({ key: "x", stageField: "a", fields: [{ key: "a", label: "A", type: "ref" }] }));
    assert.throws(() => c.defineListSpec({ key: "x", stageField: "a", fields: [{ key: "a", label: "A", type: "text" }] }));
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

describe("a work figure never ranks anyone (AC-LF12, contract 7)", () => {
  const audience = { view: "full", figures: true };
  test("only an equality kind of filter applies to it", () => {
    assert.deepEqual([...c.opsFor({ type: "number", figure: true })], ["eq", "ne", "isNull", "isNotNull"]);
    const threshold = { filters: [{ field: "lateMinutes", op: "gte", value: 30 }] };
    assert.deepEqual(c.checkListQuery(SPEC, parse(threshold), audience).map((i) => i.path), ["filters.0"]);
    const exact = { filters: [{ field: "lateMinutes", op: "eq", value: 0 }] };
    assert.deepEqual(c.checkListQuery(SPEC, parse(exact), audience), []);
  });
  test("outside its audience the field does not exist, whatever the file view", () => {
    const exact = { filters: [{ field: "lateMinutes", op: "eq", value: 0 }] };
    assert.deepEqual(issues(exact, "full"), ["filters.0"]);
    assert.ok(!c.visibleFields(SPEC, "full").some((f) => f.key === "lateMinutes"));
    assert.ok(c.visibleFields(SPEC, audience).some((f) => f.key === "lateMinutes"));
  });
});

describe("the page and select all", () => {
  test("a page may carry the stages of a ref stage field", () => {
    const Page = c.listPage(c.ListStage);
    const page = { items: [], total: 0, page: 1, pageSize: 25, stages: [{ key: "s1", label: "Screening" }] };
    assert.deepEqual(Page.parse(page), page);
  });
  test("the ids answer is capped at the bulk limit", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    assert.ok(c.ListIds.safeParse({ ids: Array(c.MAX_BULK_IDS).fill(id), total: 900 }).success);
    assert.ok(!c.ListIds.safeParse({ ids: Array(c.MAX_BULK_IDS + 1).fill(id), total: 900 }).success);
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

describe("the HR lists keep their declarations sound", () => {
  test("each searches only plain text fields, and the pay run list has no search", () => {
    for (const spec of [c.EMPLOYEE_LIST, c.ROSTER_LIST, c.ATTENDANCE_LIST, c.LEAVE_REQUEST_LIST]) {
      assert.ok((spec.searchFields ?? []).length > 0, spec.key);
    }
    assert.equal(c.PAY_RUN_LIST.searchFields, undefined);
    assert.deepEqual(c.checkListQuery(c.PAY_RUN_LIST, parse({ q: "march" }), "full").map((i) => i.path), ["q"]);
  });
  test("a basic reader cannot touch the employee list's date of birth", () => {
    const query = parse({ sort: [{ field: "dateOfBirth", dir: "asc" }] });
    assert.deepEqual(c.checkListQuery(c.EMPLOYEE_LIST, query, "basic").map((i) => i.path), ["sort.0"]);
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
