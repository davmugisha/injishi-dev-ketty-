"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Rentals: the residence side of Injishi, rebuilt (blueprint WP 1.1).
 *
 * The vocabulary every rentals table and screen shares, Kigali calendar rules,
 * the lease state machine and drafting shapes, the calendar-month rent
 * schedule, payment allocation, the lease contract and its fingerprint, and
 * the money rules (rental income tax, payout accounts), and what each landlord
 * route takes and answers (`api.ts`), signing and the tenant's invitation
 * (`signing.ts`), and the tenant's own tenancies (`tenancy.ts`). Pure
 * functions and zod schemas only: no clock but `kigaliToday()`, no I/O.
 */
__exportStar(require("./vocab"), exports);
__exportStar(require("./dates"), exports);
__exportStar(require("./identity"), exports);
__exportStar(require("./sha256"), exports);
__exportStar(require("./lease"), exports);
__exportStar(require("./schedule"), exports);
__exportStar(require("./allocation"), exports);
__exportStar(require("./money"), exports);
__exportStar(require("./contract"), exports);
__exportStar(require("./api"), exports);
__exportStar(require("./signing"), exports);
__exportStar(require("./tenancy"), exports);
//# sourceMappingURL=index.js.map