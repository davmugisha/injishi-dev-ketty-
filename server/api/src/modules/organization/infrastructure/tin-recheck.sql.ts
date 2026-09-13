import { type SQL, sql } from 'drizzle-orm';

import {
  orgRegistrationEvents,
  orgs,
  tinVerifications,
} from '../../../database/drizzle/schema';

/**
 * The businesses held on an unanswered RRA check, with how many attempts they
 * have had (ADR-049, AC-R5).
 *
 * ONE definition, read by two callers: the retry sweep, to decide what is due,
 * and admin's review queue, to flag what has stalled. Two copies of "how many
 * attempts" is how the sweep stops retrying a business that admin still shows as
 * healthy, or the reverse.
 *
 * A row per org that is at `submitted` AND whose NEWEST `tin_verifications` row
 * is `pending`. Columns: `org_id`, `attempts`, `last_checked_at`.
 *
 * **Attempts count from the org's last `submitted` event**, not from the start of
 * time. A registration rejected and resubmitted gets a fresh set of attempts,
 * because the thing being retried is this submission. A business that predates
 * the event log has no such event, and every row it has counts.
 *
 * Written as aliased raw SQL with literal column names, the shape
 * `booking.repository.ts` already uses. Interpolating Drizzle column objects here
 * would render them qualified by TABLE name, which the aliases would not match.
 */
export function pendingTinAttemptsSql(): SQL {
  return sql`
    select o.id as org_id,
           count(t.id)::int as attempts,
           max(t.checked_at) as last_checked_at
      from ${orgs} o
      join ${tinVerifications} t
        on t.org_id = o.id
       and t.checked_at >= coalesce(
             (select max(e.occurred_at)
                from ${orgRegistrationEvents} e
               where e.org_id = o.id
                 and e.to_status = 'submitted'),
             '-infinity'::timestamptz
           )
     where o.registration_status = 'submitted'
       and (select n.result
              from ${tinVerifications} n
             where n.org_id = o.id
             order by n.checked_at desc
             limit 1) = 'pending'
     group by o.id
  `;
}
