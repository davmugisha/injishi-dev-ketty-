/**
 * Rwanda's tourism tax on accommodation (2026-10-30, the owner's decision): 3% of what a guest pays for
 * a room, INCLUDED in the room's price, never added on top. A guest pays exactly the price shown; the
 * bill, the checkout and the owner's money screens say how much of it is the tax, which the business
 * passes on rather than earns.
 *
 * Included means the tax is 3/103 of the amount: a RWF 60,000 night holds RWF 1,748 of tax and
 * RWF 58,252 of room. Rounded to the franc, per amount it is worked out on.
 */
export const TOURISM_TAX_RATE = 0.03;

/** What the bill calls it. */
export const TOURISM_TAX_LABEL = "Tourism tax (3%)";

/** The tourism tax inside an accommodation amount that already includes it. */
export function tourismTaxIncludedRwf(accommodationRwf: number): number {
    if (!Number.isFinite(accommodationRwf) || accommodationRwf <= 0) return 0;
    return Math.round((accommodationRwf * TOURISM_TAX_RATE) / (1 + TOURISM_TAX_RATE));
}

/** An accommodation amount split into the room's own part and the tax inside it. */
export function splitTourismTax(accommodationRwf: number): { roomRwf: number; taxRwf: number } {
    const taxRwf = tourismTaxIncludedRwf(accommodationRwf);
    return { roomRwf: Math.max(0, Math.round(accommodationRwf) - taxRwf), taxRwf };
}
