import { describe, expect, test } from "vitest";
import {
  addToCart,
  cartTotals,
  countOf,
  lineAmounts,
  MAX_QUANTITY,
  optionProblem,
  orderBody,
  setQuantity,
  unitPrice,
  uploadedPhotoSrc,
} from "@/features/table-order/cart";

const beer = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Primus",
  priceRwf: 1500,
  taxRateBps: 1800,
  options: [],
};
const brochette = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Goat brochette",
  priceRwf: 4000,
  taxRateBps: 1800,
  options: [
    {
      name: "Side",
      required: true,
      maxChoices: 1,
      choices: [
        { label: "Chips", priceDeltaRwf: 500 },
        { label: "Plantain", priceDeltaRwf: 0 },
      ],
    },
    {
      name: "Extras",
      required: false,
      maxChoices: 2,
      choices: [
        { label: "Pili pili", priceDeltaRwf: 0 },
        { label: "Egg", priceDeltaRwf: 300 },
      ],
    },
  ],
};

describe("a guest's cart at a table", () => {
  test("the same item again adds to its line; other options make a new line", () => {
    let cart = addToCart([], beer, []);
    cart = addToCart(cart, beer, []);
    expect(cart).toHaveLength(1);
    expect(cart[0]?.quantity).toBe(2);
    cart = addToCart(cart, brochette, [{ name: "Side", choices: ["Chips"] }]);
    cart = addToCart(cart, brochette, [{ name: "Side", choices: ["Plantain"] }]);
    cart = addToCart(cart, brochette, [{ name: "Side", choices: ["Chips"] }]);
    expect(cart).toHaveLength(3);
    expect(countOf(cart, brochette.id)).toBe(3);
  });

  test("options add their price, and a required option must be chosen", () => {
    expect(
      unitPrice(brochette, [
        { name: "Side", choices: ["Chips"] },
        { name: "Extras", choices: ["Egg"] },
      ]),
    ).toBe(4800);
    expect(optionProblem(brochette, [])).toBe("Choose side.");
    expect(optionProblem(brochette, [{ name: "Side", choices: ["Chips"] }])).toBeNull();
    expect(optionProblem(brochette, [{ name: "Side", choices: ["Chips", "Plantain"] }])).toBe(
      "Choose up to 1 for side.",
    );
  });

  test("quantities stay between 1 and the cap, and 0 takes the line out", () => {
    let cart = addToCart([], beer, [], 50);
    expect(cart[0]?.quantity).toBe(MAX_QUANTITY);
    cart = setQuantity(cart, cart[0]?.key ?? "", 0);
    expect(cart).toHaveLength(0);
  });

  test("totals follow the till: VAT added per line half up when exclusive, included when inclusive", () => {
    // 3 × 1,500 = 4,500; 18% = 810.
    expect(lineAmounts({ unitPriceRwf: 1500, quantity: 3, taxRateBps: 1800 }, "exclusive")).toEqual({
      netRwf: 4500,
      taxRwf: 810,
      totalRwf: 5310,
    });
    // 1,000 incl. 18%: 1,000 × 1800 / 11800 = 152.54 → 153.
    expect(lineAmounts({ unitPriceRwf: 1000, quantity: 1, taxRateBps: 1800 }, "inclusive")).toEqual({
      netRwf: 1000,
      taxRwf: 153,
      totalRwf: 1000,
    });
    const cart = addToCart(addToCart([], beer, [], 2), brochette, [{ name: "Side", choices: ["Chips"] }]);
    expect(cartTotals(cart, "inclusive")).toMatchObject({ totalRwf: 7500, count: 3 });
    expect(cartTotals(cart, "exclusive")).toMatchObject({ netRwf: 7500, taxRwf: 540 + 810, totalRwf: 8850 });
  });

  test("the order body carries ids, quantities, options and notes only: never a price or a table", () => {
    const cart = addToCart(addToCart([], beer, [], 2), brochette, [{ name: "Side", choices: ["Chips"] }]);
    const body = orderBody(cart, "abcdef0123456789-key", "  no onions  ", 3);
    expect(body).toEqual({
      clientKey: "abcdef0123456789-key",
      lines: [
        { serviceItemId: beer.id, quantity: 2 },
        { serviceItemId: brochette.id, quantity: 1, selectedOptions: [{ name: "Side", choices: ["Chips"] }] },
      ],
      guestNote: "no onions",
      guestCount: 3,
    });
    expect(JSON.stringify(body)).not.toMatch(/price|table|outlet/i);
  });

  test("an uploaded photo is read through this table's own address, and only for its own item", () => {
    expect(uploadedPhotoSrc("CODE_abcdefghijklmnopqrstuv", beer.id, `upload:${beer.id}.0a1b2c3d4e5f`)).toBe(
      `/api/table-order/CODE_abcdefghijklmnopqrstuv/photos/${beer.id}?v=0a1b2c3d4e5f`,
    );
    expect(uploadedPhotoSrc("CODE_abcdefghijklmnopqrstuv", beer.id, `upload:${brochette.id}.0a1b`)).toBeNull();
    expect(uploadedPhotoSrc("CODE_abcdefghijklmnopqrstuv", beer.id, "beer")).toBeNull();
  });
});
