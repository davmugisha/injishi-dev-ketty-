import { type BusinessKind } from "./business-kind";
import type { OrgCertificateKind } from "./registration";
export interface RegistrationDocumentRow {
    kind: OrgCertificateKind;
    required: boolean;
}
/**
 * The rows for a kind, in the order the wizard asks. A broker registers with no
 * documents (and not through `POST /registrations` at all).
 */
export declare function registrationDocumentRows(kind: BusinessKind, options?: {
    franchisee?: boolean;
}): readonly RegistrationDocumentRow[];
/** The one document a kind cannot register without, or null for none (a broker). */
export declare function requiredRegistrationDocument(kind: BusinessKind): OrgCertificateKind | null;
/** The required document a registration's certificates leave out, or null when it is there. */
export declare function missingRegistrationDocument(kind: BusinessKind, certificates: readonly {
    kind: string;
}[]): OrgCertificateKind | null;
//# sourceMappingURL=registration-documents.d.ts.map