import { Card, CardDescription, CardTitle } from "@injishi/ui";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import { apiFailureMessage, failureHeading, type ApiFailure } from "@/lib/api/server";
import { listUnclaimedStays, listUsers } from "@/lib/api/users";
import { EMPTY, count } from "@/lib/present/format";
import { presentUnclaimedStay, presentUserRow } from "@/lib/present/users";
import { STAT_NOTE, STAT_TERM, STAT_TILE, STAT_VALUE } from "@/lib/stat-tile";

import { UnclaimedStays } from "./unclaimed-stays";
import { UserDirectory } from "./user-directory";

export const metadata = { title: "Users" };

/**
 * Why the console is reading a list of people, in the words that reach the log.
 *
 * `listUsers` takes the reason as a REQUIRED argument and the route writes a
 * `record_access_logs` row naming this staffer and every person returned. It is
 * stated here, at the one call site, and never defaulted inside the reader: a
 * log where every row carries the same sentence cannot distinguish a fraud
 * investigation from idle browsing, and a log that cannot do that is not an
 * audit trail. The server floors it at four characters and refuses shorter.
 */
const DIRECTORY_READ_REASON =
  "Users console — directory: locating the account behind a support, fraud or " +
  "data-subject case, and confirming which workspaces and grants it holds";

/**
 * F-A04 user management — the single identity (F-S01).
 *
 * ONE PII READ, NOT TWO. The KYC tile counts the rows on THIS page and says so,
 * rather than firing a second `?kyc=verified` read for a platform total: that
 * second read would write a second `record_access_logs` row over the same
 * people, and doubling the audit noise to fill a stat tile is exactly the
 * behaviour the log exists to discourage.
 *
 * The stays read carries no reason and needs none — a stay reference and a
 * property name are booking data, not the guest's identity record.
 */
export default async function Page() {
  const [users, stays] = await Promise.all([
    listUsers(DIRECTORY_READ_REASON),
    listUnclaimedStays(),
  ]);

  const listed = users.ok ? users.data.items : [];
  const verified = listed.filter((u) => u.kyc === "verified").length;

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card as="dl" className={STAT_TILE}>
          <CardTitle className={STAT_TERM}>Users</CardTitle>
          <CardDescription className={`${STAT_VALUE} text-3xl`}>
            {users.ok ? count(users.data.meta.total) : EMPTY}
          </CardDescription>
          <dd className={STAT_NOTE}>
            {users.ok ? "one login each — always" : "not counted — the read did not answer"}
          </dd>
        </Card>
        <Card as="dl" className={STAT_TILE}>
          <CardTitle className={STAT_TERM}>KYC-verified</CardTitle>
          <CardDescription className={`${STAT_VALUE} text-3xl`}>
            {users.ok ? count(verified) : EMPTY}
          </CardDescription>
          <dd className={STAT_NOTE}>of the {listed.length} people listed — elevated past guest</dd>
        </Card>
        <Card as="dl" className={STAT_TILE}>
          <CardTitle className={STAT_TERM}>Unclaimed stays</CardTitle>
          <CardDescription className={`${STAT_VALUE} text-3xl`}>
            {stays.ok ? count(stays.data.meta.total) : EMPTY}
          </CardDescription>
          <dd className={STAT_NOTE}>
            {stays.ok ? "walk-ins with no account yet" : "not counted — the read did not answer"}
          </dd>
        </Card>
      </div>

      {users.ok ? (
        <UserDirectory
          rows={users.data.items.map((u) => ({
            id: u.id,
            row: presentUserRow(u),
            // The masked identifiers travel beside the presented row: they are
            // raw facts the API already redacted, not view decisions, and
            // `UserRow` deliberately carries neither. There is no unmasked
            // variant anywhere in this console and there must not be one.
            phoneMasked: u.phoneMasked,
            nationalIdMasked: u.nationalIdMasked,
          }))}
          total={users.data.meta.total}
        />
      ) : (
        <Unavailable title="Directory — the single identity (F-S01)" reason={users.reason} />
      )}

      {stays.ok ? (
        <UnclaimedStays
          stays={stays.data.items.map((s) => ({
            // The stay id rides beside the presented row: reissuing a code is
            // a real write now, addressed by id rather than by the reference
            // shown, which for a walk-in IS the code being replaced.
            id: s.stayId,
            stay: presentUnclaimedStay(s),
          }))}
        />
      ) : (
        <Unavailable title="Unclaimed walk-in stays" reason={stays.reason} />
      )}
    </div>
  );
}

/**
 * One panel could not be read.
 *
 * The two halves fail separately because they are gated the same way but
 * answered by different routes, and a staffer working a claim-code case should
 * not lose the stays list because the directory read timed out. The sentence
 * comes from `apiFailureMessage`, so `unreachable` never reads as a refusal.
 */
function Unavailable({ title, reason }: { title: string; reason: ApiFailure }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="mt-3 animate-arrive rounded-card border border-border bg-field p-5">
        <p className="text-sm font-semibold">{failureHeading(reason, "admin.user.view")}</p>
        <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {apiFailureMessage(reason)}
        </p>
        <FailureNextStep reason={reason} />
      </div>
    </section>
  );
}
