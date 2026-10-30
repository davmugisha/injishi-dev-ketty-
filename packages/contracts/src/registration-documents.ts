import { type BusinessKind, isVenueKind } from "./business-kind";
import type { OrgCertificateKind } from "./registration";
// ---------------------------------------------------------------------------
// The documents a registration asks for, by business kind (ADR-075 S5, AC-11).
//
// THE ONE TABLE. The wizard draws its Documents rows from it (web's
// `documentRows`) and the API refuses a registration missing its required row
// from it (`RegistrationService.create`), so "required by the API exactly as by
// the wizard" holds because there is nothing else to drift from. The labels a
// screen shows are the screen's own; what is here is which kinds, in which
// order, and which one is required.
// ---------------------------------------------------------------------------
export interface RegistrationDocumentRow {
    kind: OrgCertificateKind;
    required: boolean;
}
/**
 * A stay or a venue asks for its RDB certificate and nothing else (owner's decision, 2026-10-29). The
 * optional rows (tourism licence, grade, tax clearance, fire safety, health inspection, PSF certificate)
 * are gone from the wizard; their kinds stay in `OrgCertificateKind`, so certificates already on file
 * still read back.
 */
const STAY_ROWS: readonly RegistrationDocumentRow[] = [{ kind: "rdb_certificate", required: true }];
/** A venue (Bar & Restaurant, Coffee Shop): the same one row. */
const VENUE_ROWS: readonly RegistrationDocumentRow[] = STAY_ROWS;
const RESIDENCE_ROWS: readonly RegistrationDocumentRow[] = [{ kind: "land_title", required: true }];
/** Added to its kind's rows for a franchisee (AC-8): the agreement, optional. */
const FRANCHISEE_ROWS: readonly RegistrationDocumentRow[] = [{ kind: "franchise_agreement", required: false }];
/**
 * The rows for a kind, in the order the wizard asks. A broker registers with no
 * documents (and not through `POST /registrations` at all).
 */
export function registrationDocumentRows(kind: BusinessKind, options: {
    franchisee?: boolean;
} = {}): readonly RegistrationDocumentRow[] {
    const rows = kind === "broker" ? [] : kind === "residence" ? RESIDENCE_ROWS : isVenueKind(kind) ? VENUE_ROWS : STAY_ROWS;
    return options.franchisee ? [...rows, ...FRANCHISEE_ROWS] : rows;
}
/** The one document a kind cannot register without, or null for none (a broker). */
export function requiredRegistrationDocument(kind: BusinessKind): OrgCertificateKind | null {
    return registrationDocumentRows(kind).find((row) => row.required)?.kind ?? null;
}
/** The required document a registration's certificates leave out, or null when it is there. */
export function missingRegistrationDocument(kind: BusinessKind, certificates: readonly {
    kind: string;
}[]): OrgCertificateKind | null {
    const required = requiredRegistrationDocument(kind);
    return required !== null && !certificates.some((c) => c.kind === required) ? required : null;
}
