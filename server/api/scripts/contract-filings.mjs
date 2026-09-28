// The contract filing behind each lease: F-R10's 15 day clock, as rows.
//
// `contract_filings` has been in the schema since the first migration and has
// never been written or read by anything. So the Filings lens on Finance had
// nothing to show and was a placeholder, and F-R10 — "on signing, Injishi files
// the signed contract with the tax administration within 15 days, no landlord
// action" — existed only as a sentence in a spec.
//
// This module mints the demo's rows. It is PURE so `contract-filings.test.mjs`
// can prove the arithmetic and the refusals without a database.
//
// It refuses three things rather than writing them, because each one is a lie a
// demo could tell:
//
//   * a `filed` row whose filing landed AFTER its own deadline. That is a
//     missed filing with a green badge on it, which is the single worst row
//     this table could carry;
//   * a `failed` row with no reason. F-R10 §6 says a failure surfaces to the
//     landlord with ready-to-file copy, "never silently dropped" — a row that
//     cannot say what went wrong is exactly the silent drop;
//   * any row claiming a live adapter. Nothing in this repository can file a
//     contract with the RRA: there is no adapter and no channel (F-R10 §11,
//     O-4 is still open). Every row this module mints is marked `mock`, so the
//     screen can say so instead of implying a filing that never happened.

const DAY_MS = 864e5;

/** The one window F-R10 names. Exported so nothing retypes 15. */
export const FILING_WINDOW_DAYS = 15;

/**
 * One `contract_filings` row per entry, with the clock arithmetic done once.
 *
 * @param {ReadonlyArray<{
 *   lease: string,
 *   clockStartAt: Date,
 *   status: 'pending' | 'filed' | 'failed',
 *   filedAfterDays?: number,
 *   attempts?: number,
 *   failureReason?: string,
 * }>} entries
 * @param {{windowDays?: number, idFor?: (n: number) => string, adapterMode?: string}} [options]
 */
export function contractFilings(entries, options = {}) {
  const {
    windowDays = FILING_WINDOW_DAYS,
    idFor = (n) => `contract-filing-${n}`,
    adapterMode = 'mock',
  } = options;

  if (adapterMode !== 'mock') {
    throw new Error(
      'contract-filings.mjs mints demo rows only: there is no live filing channel (F-R10, O-4).',
    );
  }

  return entries.map((entry, i) => {
    const { lease, clockStartAt, status } = entry;
    if (!(clockStartAt instanceof Date) || Number.isNaN(clockStartAt.getTime())) {
      throw new Error(`${lease}: clockStartAt must be a Date. The clock starts at signing.`);
    }
    const dueBy = new Date(clockStartAt.getTime() + windowDays * DAY_MS);

    let attempts = entry.attempts ?? 1;
    let decidedAt = clockStartAt;
    let failureReason = null;

    if (status === 'filed') {
      const after = entry.filedAfterDays;
      if (typeof after !== 'number') {
        throw new Error(`${lease}: a filed row must say how long it took.`);
      }
      if (after > windowDays) {
        throw new Error(
          `${lease}: filed on day ${after} of a ${windowDays} day window. That is a missed filing, not a filed one.`,
        );
      }
      decidedAt = new Date(clockStartAt.getTime() + after * DAY_MS);
    } else if (status === 'failed') {
      failureReason = entry.failureReason?.trim() || '';
      if (!failureReason) {
        throw new Error(`${lease}: a failed filing must say why. F-R10 §6: never silently dropped.`);
      }
      if (attempts < 1) throw new Error(`${lease}: a failure has been attempted at least once.`);
      decidedAt = new Date(clockStartAt.getTime() + attempts * DAY_MS);
    } else if (status === 'pending') {
      if (entry.failureReason) {
        throw new Error(`${lease}: a pending filing has not failed, so it has no reason.`);
      }
      attempts = entry.attempts ?? 0;
    } else {
      throw new Error(`${lease}: ${status} is not a filing_status.`);
    }

    return {
      id: idFor(i + 1),
      lease_id: lease,
      status,
      clock_start_at: clockStartAt,
      due_by: dueBy,
      filing_copy_object_id: null,
      attempts,
      failure_reason: failureReason,
      adapter_mode: adapterMode,
      created_at: clockStartAt,
      updated_at: decidedAt,
    };
  });
}

// ---------------------------------------------------------------------------
// The demo's plan
// ---------------------------------------------------------------------------

/**
 * Which filing each Green Hills lease carries, by a symbolic key the seed maps
 * onto its own lease ids.
 *
 * It lives here rather than in `seed-demo-portfolio.mjs` because that script
 * runs `main()` on import and so cannot be tested. The plan is the part worth
 * testing: it is what decides whether the Filings lens opens on one state
 * repeated eleven times or on the three a landlord actually has to tell apart.
 *
 * `clockStart` says where the fifteen days begin:
 *
 *   `atSigning` — F-R10 §9's ordinary case, and where ten of these sit. The
 *   instant comes from the lease's own `tenant_signed_at`, read back from the
 *   database rather than guessed here, so a filing can never be dated before
 *   the contract it files.
 *
 *   `daysAgo` — a clock that started for a reason the tenancy dates do not
 *   show. Aline's is F-R10 §9's "corrected/amended contract re-files": the
 *   contract was amended this month, so the fifteen days started again and the
 *   lens has one filing genuinely in flight rather than a table of history.
 */
export const GREEN_HILLS_FILING_PLAN = [
  // The five Ingoro tenancies `seed-demo.mjs` writes. Filed, boringly, which is
  // what the overwhelming majority of rows must look like for the two that are
  // not boring to read as exceptions.
  { key: 'a1', status: 'filed', clockStart: { kind: 'atSigning' }, filedAfterDays: 2 },
  { key: 'a2', status: 'filed', clockStart: { kind: 'atSigning' }, filedAfterDays: 4 },
  { key: 'b1', status: 'filed', clockStart: { kind: 'atSigning' }, filedAfterDays: 11 },
  { key: 'b2', status: 'filed', clockStart: { kind: 'atSigning' }, filedAfterDays: 1 },
  { key: 'c1', status: 'filed', clockStart: { kind: 'atSigning' }, filedAfterDays: 6 },
  // The six `seed-demo-portfolio.mjs` writes.
  { key: 'didier', status: 'filed', clockStart: { kind: 'atSigning' }, filedAfterDays: 3 },
  { key: 'patrick', status: 'filed', clockStart: { kind: 'atSigning' }, filedAfterDays: 9 },
  { key: 'jeanpaul', status: 'filed', clockStart: { kind: 'atSigning' }, filedAfterDays: 5 },
  // Esther has moved out. Her filing stays: an ended tenancy still had a
  // contract, and the declaration still counts the rent she paid.
  { key: 'esther', status: 'filed', clockStart: { kind: 'atSigning' }, filedAfterDays: 13 },
  // In flight. The amended contract restarted the clock six days ago.
  { key: 'aline', status: 'pending', clockStart: { kind: 'daysAgo', days: 6 }, attempts: 1 },
  // Refused, and the landlord has to know. This is the row the lens exists for.
  {
    key: 'olive',
    status: 'failed',
    clockStart: { kind: 'atSigning' },
    attempts: 4,
    failureReason:
      'The tax administration refused the submission: the TIN on the contract copy is not the TIN this business is registered under. Correct it on the lease and Injishi will re-file; the ready-to-file copy is on the lease record meanwhile.',
  },
];

/**
 * Turn the plan into `contractFilings` entries for real lease ids.
 *
 * It refuses a plan key with no lease and a lease with no plan key, because
 * either one leaves a tenancy whose contract nothing filed and nothing says so.
 *
 * @param {ReadonlyArray<{key: string, status: string, clockStart: object,
 *   filedAfterDays?: number, attempts?: number, failureReason?: string}>} plan
 * @param {Record<string, {id: string, signedAt: Date}>} leases keyed as the plan is
 * @param {Date} now
 */
export function filingEntries(plan, leases, now) {
  const planned = new Set(plan.map((p) => p.key));
  for (const key of Object.keys(leases)) {
    if (!planned.has(key)) {
      throw new Error(`lease "${key}" has no contract filing. Every signed lease is filed (F-R10).`);
    }
  }
  return plan.map((entry) => {
    const lease = leases[entry.key];
    if (!lease) throw new Error(`the filing plan names "${entry.key}", which is not a lease here.`);
    if (entry.clockStart.kind === 'atSigning' && !(lease.signedAt instanceof Date)) {
      throw new Error(
        `lease "${entry.key}" is filed from its signature and has none. The clock starts at signing (F-R10 §9).`,
      );
    }
    const clockStartAt =
      entry.clockStart.kind === 'daysAgo'
        ? new Date(now.getTime() - entry.clockStart.days * DAY_MS)
        : new Date(lease.signedAt.getTime());
    const { key: _key, clockStart: _clockStart, ...rest } = entry;
    return { lease: lease.id, clockStartAt, ...rest };
  });
}
