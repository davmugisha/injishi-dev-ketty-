import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AdminLocalization } from '@injishi/contracts';

import {
  emailTemplates,
  translationEntries,
} from '../../../../database/drizzle/governance';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';

/**
 * How many translation strings the response carries.
 *
 * `AdminLocalization` has no `meta`, so unlike a list route there is no place
 * to say "there are more". The cap is safe anyway because `coverage` below is
 * counted over the WHOLE table, not over these rows: the four numbers stay true
 * no matter how many entries are shown, so the screen can never report a
 * coverage figure that only describes the page it is looking at. Raising this
 * is a size decision; adding paging is a contract amendment.
 */
const MAX_ENTRIES = 500;

/**
 * `GET /api/v1/admin/localization` (INTERFACE.md §14).
 *
 * **Coverage is COUNTED, never asserted.** The whole value of this screen is
 * that somebody can answer "how much of the product exists in Kinyarwanda"
 * without trusting a number a human typed into a spreadsheet, so the four
 * figures are `count(*) FILTER` over `translation_entries.status` and nothing
 * else. If the enum grows a fourth state, `total` will stop equalling the sum
 * of the other three and the screen will show it — which is the correct
 * behaviour, because a silently absorbed new state is a coverage report that
 * has quietly become wrong.
 */
@Injectable()
export class AdminLocalizationService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async read(): Promise<AdminLocalization> {
    const [entries, templates, coverage] = await Promise.all([
      this.entries(),
      this.templates(),
      this.coverage(),
    ]);

    return AdminLocalization.parse({ entries, templates, coverage });
  }

  /**
   * The strings themselves, ordered by key.
   *
   * By key rather than by status, because the key is how a translator finds the
   * one they were asked about, and a list that reorders itself as work lands is
   * a list nobody can navigate twice.
   */
  private entries(): Promise<
    {
      id: string;
      key: string;
      valueEn: string | null;
      valueRw: string | null;
      status: 'translated' | 'missing' | 'needs_review';
      version: number;
    }[]
  > {
    return this.db
      .select({
        id: translationEntries.id,
        key: translationEntries.key,
        // Both languages on one row, because the question is always
        // comparative — what is missing in Kinyarwanda that exists in English —
        // and two separate rows cannot answer it without a join the console
        // would have to perform on itself.
        valueEn: translationEntries.valueEn,
        valueRw: translationEntries.valueRw,
        status: translationEntries.status,
        version: translationEntries.version,
      })
      .from(translationEntries)
      .orderBy(translationEntries.key)
      .limit(MAX_ENTRIES);
  }

  /**
   * Email templates, ordered by key.
   *
   * The BODIES are not selected. A list needs the subject to identify a row,
   * and pulling four long bodies per template across the wire to render a table
   * of names is waste the console cannot use.
   */
  private templates(): Promise<
    {
      id: string;
      templateKey: string;
      subjectEn: string | null;
      subjectRw: string | null;
      version: number;
      isTransactional: boolean;
    }[]
  > {
    return this.db
      .select({
        id: emailTemplates.id,
        templateKey: emailTemplates.templateKey,
        subjectEn: emailTemplates.subjectEn,
        subjectRw: emailTemplates.subjectRw,
        version: emailTemplates.version,
        // Carried because it decides whether a recipient may opt out: a booking
        // confirmation is not marketing, and a console that cannot see the
        // difference will let somebody unsubscribe from their own receipts.
        isTransactional: emailTemplates.isTransactional,
      })
      .from(emailTemplates)
      .orderBy(emailTemplates.templateKey);
  }

  /**
   * The four coverage counts, over the whole table, in one scan.
   *
   * `stale` counts `needs_review` — the string HAS a Kinyarwanda value but the
   * English one moved under it. It is counted apart from `missing` because the
   * two need different work: one needs a translator, the other needs a
   * reviewer, and merging them would send the wrong person at half the queue.
   */
  private async coverage(): Promise<{
    total: number;
    translated: number;
    missing: number;
    stale: number;
  }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        translated: sql<number>`count(*) filter (where ${translationEntries.status} = 'translated')::int`,
        missing: sql<number>`count(*) filter (where ${translationEntries.status} = 'missing')::int`,
        stale: sql<number>`count(*) filter (where ${translationEntries.status} = 'needs_review')::int`,
      })
      .from(translationEntries);

    return {
      total: row?.total ?? 0,
      translated: row?.translated ?? 0,
      missing: row?.missing ?? 0,
      stale: row?.stale ?? 0,
    };
  }
}
