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
export * from "./vocab";
export * from "./dates";
export * from "./identity";
export * from "./sha256";
export * from "./lease";
export * from "./schedule";
export * from "./allocation";
export * from "./money";
export * from "./contract";
export * from "./api";
export * from "./overview";
export * from "./signing";
export * from "./tenancy";
// The rent cycle (WP 1.6): reminders, recorded and gateway payments, payouts.
export * from "./rent";
// Faults (WP 4.1): the ticket lifecycle a rented home shares with a hotel.
export * from "./faults";
// Expenses and paying a fault's fixer (WP 4.3).
export * from "./expenses";
// Rental income tax and lease filings with RRA (WP 4.4).
export * from "./taxes";
// Messages between a landlord and a tenant (P3.4).
export * from "./messages";
