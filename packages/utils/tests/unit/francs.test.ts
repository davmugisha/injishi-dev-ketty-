import { describe, expect, test } from "vitest";

import { parseAmount, readFrancs } from "../../src/francs";

const amount = (text: string) => readFrancs(text);

describe("readFrancs reads whole francs", () => {
  test.each([
    ["20000", 20000],
    ["20,000", 20000],
    ["20 000", 20000],
    ["20'000", 20000],
    ["1.250.000", 1_250_000],
    ["1,250,000", 1_250_000],
  ])("%s is %i", (text, francs) => {
    expect(amount(text)).toEqual({ amount: francs, error: null });
  });

  test("the currency may be written before or after the amount", () => {
    expect(amount("RWF 12,000").amount).toBe(12000);
    expect(amount("rwf. 12,000").amount).toBe(12000);
    expect(amount("12,000 FRW").amount).toBe(12000);
  });

  test("the spaces a phone keyboard or a pasted amount carries group thousands like a plain space", () => {
    expect(amount("20 000").amount).toBe(20000);
    expect(amount("20 000").amount).toBe(20000);
    expect(amount("20 000").amount).toBe(20000);
  });

  test("leading zeros are dropped", () => {
    expect(amount("0005").amount).toBe(5);
  });

  test("an empty field is zero with nothing to say", () => {
    expect(amount("")).toEqual({ amount: 0, error: null });
    expect(amount("   ")).toEqual({ amount: 0, error: null });
  });
});

describe("readFrancs refuses rather than guesses", () => {
  test("a decimal part is refused, never folded into the digits (20,000.50 once read as 2,000,050)", () => {
    expect(amount("20,000.50")).toEqual({
      amount: 0,
      error: "Francs have no decimal part. Type whole francs, without “.50”.",
    });
    expect(amount("20000,5").error).toMatch(/no decimal part/);
  });

  test("one dot before three digits could be twenty thousand or twenty, so it is asked", () => {
    expect(amount("20.000")).toEqual({
      amount: 0,
      error: "“20.000” could be read two ways. Type it as 20000 or with commas.",
    });
  });

  test("two kinds of mark cannot say which one is the decimal point", () => {
    expect(amount("1,234.567").error).toBe(
      "Use one kind of separator for thousands (20,000 or 20 000), and no decimal part.",
    );
  });

  test("thousands not grouped in threes are refused", () => {
    expect(amount("1,2345").error).toBe("Group thousands in threes (20,000), or type digits only.");
    expect(amount("1234,567").error).toBe("Group thousands in threes (20,000), or type digits only.");
  });

  test("anything but digits and separators is refused, a minus sign included", () => {
    const digitsOnly = "Type the amount in digits, in whole francs (for example 20,000).";
    expect(amount("twenty").error).toBe(digitsOnly);
    expect(amount("-500").error).toBe(digitsOnly);
    expect(amount(",500").error).toBe(digitsOnly);
    expect(amount("500,").error).toBe(digitsOnly);
  });

  test("more than twelve digits is too large for one entry", () => {
    expect(amount("999999999999").error).toBeNull();
    expect(amount("1000000000000")).toEqual({ amount: 0, error: "That amount is too large for one entry." });
  });
});

describe("parseAmount", () => {
  test("is the amount alone, and zero when the text is not one", () => {
    expect(parseAmount("12,000")).toBe(12000);
    expect(parseAmount("12,000.50")).toBe(0);
  });
});
