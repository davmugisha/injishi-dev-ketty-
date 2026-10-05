import { auditEvents } from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * The HR audit row (ADR-058 AC-U5).
 *
 * Exactly one per person initiated action, in the SAME transaction as the write
 * it records, so there is never a change without its row or a row without its
 * change. The diff names the fields that changed. A personal value (an ID
 * number, an RSSB number, a wage, a date of birth, a name, a phone) is written
 * as `"changed"`, never as itself: the audit trail is read by platform staff,
 * who have no business reading a person's HR file (index contract 10).
 */

/** Fields whose VALUE never enters an audit row. */
const PERSONAL = new Set([
  'legalName',
  'preferredName',
  'phone',
  'email',
  'dateOfBirth',
  'sex',
  'idDocumentType',
  'idDocumentNumber',
  'rssbNumber',
  'wageRwf',
  // 058-people-file AC-PF1: family, home, emergency contact and the photo.
  'maritalStatus',
  'childrenCount',
  'villageId',
  'street',
  'emergencyName',
  'emergencyPhone',
  'emergencyRelation',
  'photoKey',
  // Where pay goes (AC-PF3).
  'bankName',
  'accountNumber',
  'branchName',
  'momoPhone',
]);

/**
 * `{ field: { from, to } }` for a structural field, `{ field: "changed" }` for a
 * personal one. Only fields whose value moved appear.
 */
export function auditDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const [key, to] of Object.entries(after)) {
    const from = before ? before[key] : undefined;
    if (before && from === to) continue;
    diff[key] = PERSONAL.has(key) ? 'changed' : { from: from ?? null, to: to ?? null };
  }
  return diff;
}

export async function writeHrAudit(
  tx: Tx | Database,
  row: {
    /** Null for what nobody signed in did: a kiosk punch, the sweep (058-time). The diff names the source. */
    actorUserId: string | null;
    /** `org` for what belongs to the whole business: a policy, an announcement, a catalog, the settings. */
    subjectType: 'employee' | 'pay_run' | 'org';
    subjectId: string;
    eventType: string;
    orgId: string;
    diff?: Record<string, unknown>;
    reason?: string | null;
  },
): Promise<void> {
  await tx.insert(auditEvents).values({
    actorUserId: row.actorUserId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    eventType: row.eventType,
    payloadDiff: { orgId: row.orgId, ...(row.diff ?? {}) } as never,
    reason: row.reason ?? null,
  });
}
