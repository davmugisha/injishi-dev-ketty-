import { WaitlistAudience } from "@injishi/contracts";
import { Card, CardDescription, CardTitle } from "@injishi/ui";

import { FailureNextStep } from "@/components/failure/failure-next-step";
import { API_BASE_URL } from "@/lib/api/base-url";
import { listDistricts } from "@/lib/api/geography";
import { apiFailureMessage, failureHeading } from "@/lib/api/server";
import { listWaitlist } from "@/lib/api/waitlist";
import { EMPTY, count } from "@/lib/present/format";
import { STAT_NOTE, STAT_TERM, STAT_TILE, STAT_VALUE } from "@/lib/stat-tile";

import { WaitlistDirectory, type WaitlistView } from "./waitlist-directory";

export const metadata = { title: "Waitlist" };

/**
 * The API's own default page size, and comfortably under its cap of 100.
 */
const PAGE_SIZE = 50;

/**
 * The pre-launch waitlist (ADR-048 AC-17).
 *
 * THIS WHOLE SECTION IS DELETED AT LAUNCH, along with the nav entry, the API
 * module and the page it collects from. `apps/web/WAITLIST-REMOVAL.md` names
 * every file.
 *
 * THE FILTERS AND THE PAGE LIVE IN THE URL and are read here, on the server,
 * then handed to the API, which filters and pages the whole table. They used to
 * filter only the hundred rows already loaded, so a filter could hide somebody
 * who had joined, and its count described the loaded slice as if it were the
 * list. A URL also makes a filtered view something a staffer can share.
 *
 * The three tiles are always the WHOLE list, whatever the filter says: `total`
 * is the count before paging, so a read with `limit: 1` answers "how many owners
 * have joined" for the price of one row, the pattern the Businesses console
 * already uses. The filtered count sits under the table, beside the rows it
 * describes.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = viewFrom(await searchParams);

  const [directory, everyone, travellers, owners, districts] = await Promise.all([
    listWaitlist({
      audience: view.audience,
      districtId: view.districtId,
      limit: PAGE_SIZE,
      offset: (view.page - 1) * PAGE_SIZE,
    }),
    listWaitlist({ limit: 1, offset: 0 }),
    listWaitlist({ audience: "traveller", limit: 1, offset: 0 }),
    listWaitlist({ audience: "owner", limit: 1, offset: 0 }),
    listDistricts(),
  ]);

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="On the list"
          total={everyone.ok ? everyone.data.total : null}
          note="everyone who has joined, minus nobody — unsubscribing keeps the row"
        />
        <Stat
          label="Travellers"
          total={travellers.ok ? travellers.data.total : null}
          note="demand, waiting to be told it opened"
        />
        <Stat
          label="Property owners"
          total={owners.ok ? owners.data.total : null}
          note="supply — district, type and size are on every one"
        />
      </div>

      {directory.ok ? (
        <WaitlistDirectory
          rows={directory.data.rows}
          total={directory.data.total}
          view={view}
          pageSize={PAGE_SIZE}
          // A failed district read still leaves the filter usable for the
          // district already chosen in the URL; it just offers nothing else.
          districts={districts.ok ? districts.data : []}
          apiBaseUrl={API_BASE_URL}
        />
      ) : (
        <section className="mt-8" aria-label="Waitlist">
          <div className="animate-arrive rounded-card border border-border bg-field p-5">
            <p className="text-sm font-semibold">
              {failureHeading(directory.reason, "admin.overview.view")}
            </p>
            <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
              {apiFailureMessage(directory.reason)}
            </p>
            <FailureNextStep reason={directory.reason} />
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * The view the URL asks for, with anything malformed quietly dropped.
 *
 * A hand edited `?page=abc` or `?audience=staff` shows the unfiltered first
 * page rather than an error: the URL is a convenience, not an input anybody is
 * owed a validation message about. The API validates again regardless.
 */
function viewFrom(params: Record<string, string | string[] | undefined>): WaitlistView {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const audience = WaitlistAudience.safeParse(one("audience"));
  const districtId = Number(one("district"));
  const page = Number(one("page"));

  return {
    audience: audience.success ? audience.data : undefined,
    districtId: Number.isInteger(districtId) && districtId > 0 ? districtId : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/**
 * One stat tile.
 *
 * A read that failed shows an em dash, never a zero. "Nobody has joined the
 * waitlist" and "we could not count them" are different statements, and the
 * second printed as the first is how a console reports calm during an outage —
 * on the one screen whose whole purpose is a number going up.
 */
function Stat({
  label,
  total,
  note,
}: {
  label: string;
  total: number | null;
  note: string;
}) {
  return (
    <Card as="dl" className={STAT_TILE}>
      <CardTitle className={STAT_TERM}>{label}</CardTitle>
      <CardDescription className={`${STAT_VALUE} text-3xl`}>
        {total === null ? EMPTY : count(total)}
      </CardDescription>
      <dd className={STAT_NOTE}>
        {total === null ? "not counted — the read did not answer" : note}
      </dd>
    </Card>
  );
}
