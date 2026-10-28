/**
 * The one-time code rules (feat/rentals a5a879d9): a pasted code fills from the first box and is checked
 * once; editing a digit in the middle of a full code is not checked until it is pressed.
 *
 *   pnpm --filter @injishi/ui test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { codeArrived, completion, digitsOf, formatCountdown, pasteIntoCode } from "../src/code-row.ts";

test("digits are read out of whatever was copied", () => {
  assert.equal(digitsOf("Your code is 047 600."), "047600");
  assert.equal(digitsOf("1234567890"), "123456");
  assert.equal(digitsOf("no digits"), "");
});

test("a whole code fills from the first box, wherever it was pasted", () => {
  assert.deepEqual(pasteIntoCode("12", "Code: 047600", 2), { next: "047600", whole: true });
  assert.deepEqual(pasteIntoCode("", "047600", 0), { next: "047600", whole: true });
  assert.deepEqual(pasteIntoCode("999999", "047600", 3), { next: "047600", whole: true });
});

test("a few digits go in at the caret", () => {
  assert.deepEqual(pasteIntoCode("12", "34", 2), { next: "1234", whole: false });
  assert.deepEqual(pasteIntoCode("1299", "34", 2), { next: "1234", whole: false });
  assert.equal(pasteIntoCode("12", "abc", 2), null);
});

test("arrivals: completing, a paste, retyping the last digit", () => {
  assert.equal(codeArrived("12345", "123456", "type"), true, "the last empty box filled");
  assert.equal(codeArrived("123456", "723456", "type"), false, "a digit in the middle changed");
  assert.equal(codeArrived("123456", "123457", "type"), true, "the last digit retyped");
  assert.equal(codeArrived("123456", "654321", "paste"), true, "a whole code pasted over a full one");
  assert.equal(codeArrived("123", "1234", "type"), false, "not complete");
});

test("a pasted code fires onComplete once, even when written twice", () => {
  let last: string | null = null;
  const fired: string[] = [];
  const step = (prev: string, next: string, how: "type" | "paste") => {
    const r = completion(last, prev, next, how);
    last = r.lastFired;
    if (r.fire) fired.push(next);
  };
  step("", "047600", "paste");
  step("047600", "047600", "paste"); // an autofill writing the same code again
  step("047600", "047600", "type");
  assert.deepEqual(fired, ["047600"]);
  // Clearing and pasting the same code again is a new arrival.
  step("047600", "04760", "type");
  step("04760", "047600", "type");
  assert.deepEqual(fired, ["047600", "047600"]);
  // Fixing a middle digit of a full code does not fire.
  step("047600", "947600", "type");
  assert.deepEqual(fired, ["047600", "047600"]);
});

test("countdowns read as minutes and seconds", () => {
  assert.equal(formatCountdown(42), "0:42");
  assert.equal(formatCountdown(65), "1:05");
  assert.equal(formatCountdown(0), "0:00");
  assert.equal(formatCountdown(-3), "0:00");
  assert.equal(formatCountdown(29.2), "0:30");
});
