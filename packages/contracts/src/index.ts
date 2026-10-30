/**
 * @injishi/contracts — the single source of truth for shared shapes.
 *
 * API schemas (Zod) and their inferred TypeScript types are defined here and
 * consumed by every app and the backend. Add or change a shape HERE before
 * wiring it into a consumer; a breaking change is a cross-app event.
 */
export * from "./primitives";
export * from "./phone";
export * from "./authz";
export * from "./staff-authz";
export * from "./rdb";
export * from "./business-kind";
export * from "./countries";
export * from "./geography";
export * from "./registration";
export * from "./registration-documents";
export * from "./inventory";
export * from "./setup-steps";
export * from "./booking";
export * from "./booking-change";
export * from "./trips";
export * from "./refunds";
export * from "./money-queue";
export * from "./stay";
export * from "./offers";
export * from "./inbox";
export * from "./ops";
export * from "./broker";
export * from "./broker-plans";
export * from "./ordering";
export * from "./outlets";
export * from "./property-detail";
export * from "./property-policies";
export * from "./ebm";
export * from "./ebm-connection";
export * from "./admin";
export * from "./support";
export * from "./assistant";
export * from "./platform";
export * from "./training";
export * from "./psf";
export * from "./psf-public";
export * from "./business-code";
export * from "./identity";
export * from "./registration-draft";
export * from "./people";
export * from "./people-file";
export * from "./time";
export * from "./leave";
export * from "./payroll-items";
export * from "./payroll";
export * from "./checklists";
export * from "./shift-templates";
export * from "./list-query";
export * from "./owner";
export * from "./hr-lists";
export * from "./hr-workforce";
export * from "./redaction";
export * from "./housekeeping-board";
export * from "./maintenance";
export * from "./lost-found";
// The front desk's day in one read, and the no-show command (interface real-data, frontdesk leaf).
export * from "./front-desk";
export * from "./marketplace";
// The guest's public search over stays and homes (mobile spec 0005).
export * from "./explore";
// The residence screens of the new interface (real-data 1.3.1).
export * from "./interface-residence";
export * from "./staff-phone";
// Rentals, rebuilt (blueprint WP 1.1): vocabulary, Kigali dates, the lease
// state machine, the rent schedule, allocation, the contract, tax and payouts.
export * from "./rentals";
// Who am I, in one call (blueprint 2.5): where a person lands.
export * from "./me-context";
export * from "./guests";
// The bar and restaurant point of sale (POS spec, phase 1).
export * from "./pos";
// Rwanda's 3% tourism tax, included in room prices (2026-10-30).
export * from "./tourism-tax";
// Offline writes from the phone (mobile spec 0003): the reported time and its refusal codes.
export * from "./offline";
