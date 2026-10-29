"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrationDocumentRows = registrationDocumentRows;
exports.requiredRegistrationDocument = requiredRegistrationDocument;
exports.missingRegistrationDocument = missingRegistrationDocument;
const business_kind_1 = require("./business-kind");
/** A stay, including "Other": a stay that fits no named class takes these rows (S5). */
const STAY_ROWS = [
    { kind: "rdb_certificate", required: true },
    { kind: "tourism_license", required: false },
    { kind: "rdb_grade", required: false },
    { kind: "tax_clearance", required: false },
    { kind: "fire_safety", required: false },
    { kind: "health_inspection", required: false },
    { kind: "psf_certificate", required: false },
];
/** A venue (Bar & Restaurant, Coffee Shop): no tourism licence and no grade, because it has no rooms. */
const VENUE_ROWS = [
    { kind: "rdb_certificate", required: true },
    { kind: "health_inspection", required: false },
    { kind: "fire_safety", required: false },
    { kind: "tax_clearance", required: false },
    { kind: "psf_certificate", required: false },
];
const RESIDENCE_ROWS = [{ kind: "land_title", required: true }];
/** Added to its kind's rows for a franchisee (AC-8): the agreement, optional. */
const FRANCHISEE_ROWS = [{ kind: "franchise_agreement", required: false }];
/**
 * The rows for a kind, in the order the wizard asks. A broker registers with no
 * documents (and not through `POST /registrations` at all).
 */
function registrationDocumentRows(kind, options = {}) {
    const rows = kind === "broker" ? [] : kind === "residence" ? RESIDENCE_ROWS : (0, business_kind_1.isVenueKind)(kind) ? VENUE_ROWS : STAY_ROWS;
    return options.franchisee ? [...rows, ...FRANCHISEE_ROWS] : rows;
}
/** The one document a kind cannot register without, or null for none (a broker). */
function requiredRegistrationDocument(kind) {
    return registrationDocumentRows(kind).find((row) => row.required)?.kind ?? null;
}
/** The required document a registration's certificates leave out, or null when it is there. */
function missingRegistrationDocument(kind, certificates) {
    const required = requiredRegistrationDocument(kind);
    return required !== null && !certificates.some((c) => c.kind === required) ? required : null;
}
//# sourceMappingURL=registration-documents.js.map