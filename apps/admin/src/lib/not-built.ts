/**
 * What an admin control says when the action behind it does not exist yet.
 *
 * WHY THIS FILE EXISTS. The console's controls were built against fixtures,
 * before any API existed, and they confirmed their actions with success
 * messages that described a backend that was never there:
 *
 *   "All sessions revoked — user signs in again passwordlessly"
 *   "Override executed — dual-signed, written to money audit trail + ledger"
 *   "TIN re-check queued — idempotent, attributed, audited"
 *   "View-as session ended — the user is notified a support session occurred"
 *
 * Nothing was revoked, executed, queued, audited or notified. While the screens
 * showed fixture data that was merely a costume; once the screens started
 * reading REAL accounts it became a lie told to the one person relying on it.
 * A staffer revoking a compromised account's sessions would be told it had
 * worked while those sessions stayed live, and would stop looking.
 *
 * So there is one sentence for this, here, and every unbuilt control uses it.
 * It says three things and must keep saying all three: the action is not built,
 * NOTHING CHANGED, and NOTHING WAS RECORDED. The last matters as much as the
 * first — several of these dialogs collect a "note for the audit trail", and a
 * staffer who typed one is owed being told it went nowhere.
 *
 * When a real write route lands, the control that uses it stops calling this.
 * A control that still calls this is a control that still does nothing.
 *
 * Six have landed and moved to `lib/actions/`, where the platform's actual
 * answer is worded by `outcome.ts`: suspend and reinstate a business, retry a
 * TIN check, suspend a broker, revoke a user's sessions, re-issue a claim code.
 * What still calls this has no route yet — role grants and money overrides
 * (which ADR-012 says need a second super_admin), broker reinstatement, the
 * OBO invite re-send, view-as, and global search.
 */
export function notBuilt(action: string): string {
  return `${action} isn't built yet — nothing was changed and nothing was recorded.`;
}
