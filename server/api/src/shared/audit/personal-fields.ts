/**
 * Fields whose VALUE never enters an audit row (ADR-058 index contract 10;
 * ADR-076 contract section 8).
 *
 * The audit trail is read by platform staff, who have no business reading a
 * person's HR file, their contact details or where their pay goes. A diff that
 * names one of these keeps the key, so the trail still says WHAT changed, and
 * writes `"changed"` in place of the value.
 *
 * Two lists, because a key can mean a person in one domain and a building in
 * another:
 *
 * - `PERSONAL_FIELDS` is personal in ANY domain. `AuditWriter` applies it to
 *   every row, so a writer that built its diff by hand cannot leak one.
 * - `HR_FILE_FIELDS` adds what is personal on an HR file but ordinary
 *   elsewhere: a home `villageId` and `street`, and a bank's `branchName`.
 *   A property's village and a business branch's name are facts the trail
 *   should keep, so only HR's diff builder applies these.
 */
export const PERSONAL_FIELDS: ReadonlySet<string> = new Set([
  'legalName',
  'preferredName',
  'phone',
  'email',
  'dateOfBirth',
  'sex',
  'idDocumentType',
  'idDocumentNumber',
  'nationalId',
  'rssbNumber',
  'wageRwf',
  // 058-people-file AC-PF1: family, emergency contact and the photo.
  'maritalStatus',
  'childrenCount',
  'emergencyName',
  'emergencyPhone',
  'emergencyRelation',
  'photoKey',
  // Where pay goes (AC-PF3).
  'bankName',
  'accountNumber',
  'momoPhone',
]);

export const HR_FILE_FIELDS: ReadonlySet<string> = new Set([
  ...PERSONAL_FIELDS,
  'villageId',
  'street',
  'branchName',
]);

/**
 * A copy of the diff with every personal value written as `"changed"`, at any
 * depth. Arrays and plain objects are walked; anything else is kept as it is.
 */
export function redactPersonal(value: unknown, fields: ReadonlySet<string> = PERSONAL_FIELDS): unknown {
  if (Array.isArray(value)) return value.map((item) => redactPersonal(item, fields));
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = fields.has(key) && inner !== undefined ? 'changed' : redactPersonal(inner, fields);
  }
  return out;
}
