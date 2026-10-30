"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOURISM_TAX_LABEL = exports.TOURISM_TAX_RATE = void 0;
exports.tourismTaxIncludedRwf = tourismTaxIncludedRwf;
exports.splitTourismTax = splitTourismTax;
/**
 * Rwanda's tourism tax on accommodation (2026-10-30, the owner's decision): 3% of what a guest pays for
 * a room, INCLUDED in the room's price, never added on top. A guest pays exactly the price shown; the
 * bill, the checkout and the owner's money screens say how much of it is the tax, which the business
 * passes on rather than earns.
 *
 * Included means the tax is 3/103 of the amount: a RWF 60,000 night holds RWF 1,748 of tax and
 * RWF 58,252 of room. Rounded to the franc, per amount it is worked out on.
 */
exports.TOURISM_TAX_RATE = 0.03;
/** What the bill calls it. */
exports.TOURISM_TAX_LABEL = "Tourism tax (3%)";
/** The tourism tax inside an accommodation amount that already includes it. */
function tourismTaxIncludedRwf(accommodationRwf) {
    if (!Number.isFinite(accommodationRwf) || accommodationRwf <= 0)
        return 0;
    return Math.round((accommodationRwf * exports.TOURISM_TAX_RATE) / (1 + exports.TOURISM_TAX_RATE));
}
/** An accommodation amount split into the room's own part and the tax inside it. */
function splitTourismTax(accommodationRwf) {
    const taxRwf = tourismTaxIncludedRwf(accommodationRwf);
    return { roomRwf: Math.max(0, Math.round(accommodationRwf) - taxRwf), taxRwf };
}
//# sourceMappingURL=tourism-tax.js.map