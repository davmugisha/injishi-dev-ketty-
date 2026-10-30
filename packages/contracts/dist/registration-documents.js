"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrationDocumentRows = registrationDocumentRows;
exports.requiredRegistrationDocument = requiredRegistrationDocument;
exports.missingRegistrationDocument = missingRegistrationDocument;
const business_kind_1 = require("./business-kind");
/**
 * A stay or a venue asks for its RDB certificate and nothing else (owner's decision, 2026-10-29). The
 * optional rows (tourism licence, grade, tax clearance, fire safety, health inspection, PSF certificate)
 * are gone from the wizard; their kinds stay in `OrgCertificateKind`, so certificates already on file
 * still read back.
 */
const STAY_ROWS = [{ kind: "rdb_certificate", required: true }];
/** A venue (Bar & Restaurant, Coffee Shop): the same one row. */
const VENUE_ROWS = STAY_ROWS;
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