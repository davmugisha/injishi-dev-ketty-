"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_PERMISSION_KEY = void 0;
exports.legacyKeyOf = legacyKeyOf;
exports.LEGACY_PERMISSION_KEY = {
    "reservation.approve": "pms.reservation.approve",
    "reservation.assign": "pms.reservation.assign",
    "stay.checkin": "pms.stay.checkin",
    "stay.checkout": "pms.stay.checkout",
    "folio.charge": "pms.folio.charge",
    "folio.payment": "pms.folio.payment",
    "folio.close": "pms.folio.close",
    "housekeeping.set": "pms.housekeeping.set",
    "task.assign": "pms.task.assign",
    "ticket.advance": "pms.ticket.advance",
    "offer.manage": "pms.offer.manage",
    "refund.decide": "pms.refund.decide",
    "lostfound.manage": "pms.lostfound.manage",
    // Today `listing.manage` guards the whole inventory controller: properties,
    // room types, photos and publishing.
    "listing.manage": "property.listing.manage",
    "amenity.manage": "property.amenity.manage",
    "message.send": "communications.message.send",
    "order.advance": "outlets.order.advance",
    "menu.manage": "outlets.menu.manage",
    "outlet.manage": "outlets.outlet.manage",
    "rent.record": "residence.rent.record",
    "lease.manage": "residence.lease.manage",
    "lease.sign": "residence.lease.sign",
    "deposit.return": "residence.deposit.return",
    "unit.manage": "residence.unit.manage",
    // The rentals rebuild (2026-10). Payouts and where they go are Pay's (ADR-074).
    // A landlord's expenses and a year's rental income tax are written in the
    // rentals screens, so Residence; Finance only reads other products' records.
    "payout.manage": "pay.payout.manage",
    "expense.manage": "residence.expense.manage",
    "tax.manage": "residence.tax.manage",
    // A guest registered with the local leaders: an obligation of the property, a
    // hotel's or a landlord's, like its listing.
    "guest.register": "property.guest.register",
    // Still the lock only an owner holds, under its new name.
    "team.manage": "account.team.manage",
    "department.manage": "account.department.manage",
    "money.view": "finance.money.view",
    "ebm.manage": "fiscal.ebm.manage",
    "ebm.refund": "fiscal.ebm.refund",
    "people.view": "hr.people.view",
    "people.manage": "hr.people.manage",
    "roster.manage": "hr.roster.manage",
    "attendance.record": "hr.attendance.record",
    "attendance.approve": "hr.attendance.approve",
    "leave.approve": "hr.leave.approve",
    "payroll.draft": "hr.payroll.draft",
    "payroll.run": "hr.payroll.run",
    // The bar and restaurant point of sale (POS spec, phase 1).
    "pos.sell": "pos.sale.sell",
    "pos.checkout": "pos.sale.checkout",
    "pos.discount": "pos.sale.discount",
    "pos.override": "pos.sale.override",
    "pos.refund": "pos.sale.refund",
    "table.manage": "pos.table.manage",
    "kitchen.work": "pos.kitchen.work",
    "register.operate": "pos.register.operate",
    // Reviewing shift close across tills is Finance's cash control (ADR-074).
    "shift.review": "finance.shift.review",
};
/** Today's key for a new one, or null when no permission of this release has that name. */
function legacyKeyOf(key) {
    for (const [legacy, renamed] of Object.entries(exports.LEGACY_PERMISSION_KEY)) {
        if (renamed === key)
            return legacy;
    }
    return null;
}
//# sourceMappingURL=legacy-keys.js.map