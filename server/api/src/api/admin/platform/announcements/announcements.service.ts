import { Inject, Injectable } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import { AdminAnnouncementResponse } from '@injishi/contracts';

import { announcements } from '../../../../database/drizzle/governance';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';

/**
 * The page this route serves.
 *
 * INTERFACE.md declares NO query schema for `admin/announcements` — unlike
 * `admin/orgs` or `admin/users`, which have `AdminOrgListQuery` and
 * `AdminUserListQuery` in the contract. Inventing one here would fork the seam:
 * the console would send parameters the frozen interface never promised and a
 * later leaf would have to guess which spelling won. So this answers a fixed
 * first page at the contract's own ceiling, and `meta.total` still carries the
 * REAL count — the console can therefore tell that more exist, and paging is a
 * contract amendment rather than a silent divergence.
 */
const PAGE_SIZE = 100;

/**
 * `GET /api/v1/admin/announcements` (INTERFACE.md §12).
 *
 * Newest first, drafts included. A draft is the state somebody is mid-way
 * through, and a list that showed only published announcements would hide the
 * half-written one this screen exists to finish.
 */
@Injectable()
export class AdminAnnouncementsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(): Promise<AdminAnnouncementResponse> {
    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          id: announcements.id,
          audience: announcements.audience,
          bodyEn: announcements.bodyEn,
          bodyRw: announcements.bodyRw,
          publishAt: announcements.publishAt,
          state: announcements.state,
          createdAt: announcements.createdAt,
        })
        .from(announcements)
        .orderBy(desc(announcements.createdAt))
        .limit(PAGE_SIZE),
      // The count is taken over the whole table, not over the page, because
      // `meta.total` means "before paging" — that is what lets the console say
      // "1-25 of 380" without a second request, and what makes `total: 0` an
      // honest statement about a fresh platform rather than a failed load.
      this.db.select({ n: sql<number>`count(*)::int` }).from(announcements),
    ]);

    return AdminAnnouncementResponse.parse({
      items: rows.map((row) => ({
        id: row.id,
        // `audience` is `jsonb` holding a targeting expression whose vocabulary
        // is not settled. It crosses as `unknown` and is passed through
        // untouched: shaping it here would freeze a format nothing validates.
        audience: row.audience,
        // BOTH bodies ride along. An announcement with only the English written
        // is a real draft state, and collapsing the pair into one `body` would
        // hide which half is missing.
        bodyEn: row.bodyEn,
        bodyRw: row.bodyRw,
        publishAt: row.publishAt === null ? null : row.publishAt.toISOString(),
        state: row.state,
        createdAt: row.createdAt.toISOString(),
      })),
      meta: {
        total: countRows[0]?.n ?? 0,
        page: 1,
        pageSize: PAGE_SIZE,
      },
    });
  }
}
