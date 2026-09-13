import {
  MAX_ITEM_SERIAL,
  itemCode,
  missingRra,
  priceLine,
  serialOf,
} from './sellable-item';

const CODED = {
  rraItemClsCd: '1110160600',
  rraItemTyCd: '2',
  rraItemCd: 'RW2NTU0000001',
  rraPkgUnitCd: 'NT',
  rraQtyUnitCd: 'U',
};

describe('missingRra (ADR-050 D-m, AC-20)', () => {
  it('lets an item with every RRA value sell', () => {
    expect(missingRra(CODED)).toEqual([]);
  });

  it('names each value an item still lacks', () => {
    expect(missingRra({ ...CODED, rraItemTyCd: null, rraQtyUnitCd: null })).toEqual([
      'productType',
      'quantityUnit',
    ]);
  });

  it('refuses an item missing only its minted code', () => {
    expect(missingRra({ ...CODED, rraItemCd: null })).toEqual(['itemCode']);
  });
});

describe('itemCode (VSDC v1.0.5 §4.17)', () => {
  it("reproduces the specification's own example", () => {
    expect(
      itemCode({ origin: 'RW', productType: '2', packagingUnit: 'NT', quantityUnit: 'BA', serial: 12 }),
    ).toBe('RW2NTBA0000012');
  });

  it('writes unit codes as they are, never padded', () => {
    expect(
      itemCode({ origin: 'RW', productType: '1', packagingUnit: 'NT', quantityUnit: 'U', serial: 6 }),
    ).toBe('RW1NTU0000006');
  });

  it('fits the longest unit codes in CHAR 20', () => {
    const code = itemCode({ origin: 'RW', productType: '3', packagingUnit: 'ABCDE', quantityUnit: 'VWXYZ', serial: MAX_ITEM_SERIAL });
    expect(code).toHaveLength(20);
  });

  it('refuses a serial the 7 digits cannot hold', () => {
    expect(() => itemCode({ origin: 'RW', productType: '2', packagingUnit: 'NT', quantityUnit: 'U', serial: MAX_ITEM_SERIAL + 1 })).toThrow(RangeError);
    expect(() => itemCode({ origin: 'RW', productType: '2', packagingUnit: 'NT', quantityUnit: 'U', serial: 0 })).toThrow(RangeError);
  });

  it('reads the serial back off a minted code', () => {
    expect(serialOf('RW2NTBA0000012')).toBe(12);
    expect(serialOf('not-a-code')).toBeNull();
  });
});

describe('priceLine (AC-23, modifiers)', () => {
  const coffee = {
    name: 'Coffee',
    priceRwf: 2000,
    options: [
      { name: 'Size', required: true, maxChoices: 1, choices: [{ label: 'Small', priceDeltaRwf: 0 }, { label: 'Large', priceDeltaRwf: 500 }] },
      { name: 'Extras', required: false, maxChoices: 2, choices: [{ label: 'Oat milk', priceDeltaRwf: 300 }, { label: 'Syrup', priceDeltaRwf: 200 }] },
    ],
  };

  it('adds every chosen delta to the price and snapshots the labels', () => {
    const line = priceLine(coffee, 2, [
      { name: 'Size', choices: ['Large'] },
      { name: 'Extras', choices: ['Oat milk', 'Syrup'] },
    ]);
    expect(line).toEqual({
      ok: true,
      unitPriceRwf: 3000,
      lineTotalRwf: 6000,
      selectedOptions: [
        { name: 'Size', choices: [{ label: 'Large', priceDeltaRwf: 500 }] },
        { name: 'Extras', choices: [{ label: 'Oat milk', priceDeltaRwf: 300 }, { label: 'Syrup', priceDeltaRwf: 200 }] },
      ],
    });
  });

  it('refuses a required option left out', () => {
    expect(priceLine(coffee, 1, [])).toEqual({ ok: false, problem: 'Choose "Size" for Coffee.' });
  });

  it('refuses a choice the item does not list', () => {
    expect(priceLine(coffee, 1, [{ name: 'Size', choices: ['Huge'] }]).ok).toBe(false);
  });

  it('refuses more choices than the option allows', () => {
    expect(priceLine(coffee, 1, [{ name: 'Size', choices: ['Small', 'Large'] }]).ok).toBe(false);
  });

  it('refuses an option the item does not offer', () => {
    expect(priceLine(coffee, 1, [{ name: 'Size', choices: ['Small'] }, { name: 'Ice', choices: ['Yes'] }]).ok).toBe(false);
  });

  it('prices an item with no modifiers at its own price', () => {
    expect(priceLine({ name: 'Water', priceRwf: 1000, options: null }, 3, undefined)).toEqual({
      ok: true,
      unitPriceRwf: 1000,
      lineTotalRwf: 3000,
      selectedOptions: [],
    });
  });

  it('reads unreadable stored options as none rather than throwing', () => {
    expect(priceLine({ name: 'Tea', priceRwf: 1500, options: { broken: true } }, 1, undefined).ok).toBe(true);
  });
});
