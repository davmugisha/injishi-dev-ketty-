import { sql, type SQL } from 'drizzle-orm';

import type { LeaderGrant } from '../domain/guest-routing';

/**
 * A leader's area as a SQL predicate (P5): the same rule `grantCovers` applies
 * to one registration, written for a list. One post is one clause; no posts,
 * no rows. The columns are named by the caller, so the same rule reads guest
 * registrations (`g`) and the purge's counts (`t`).
 */
export interface ScopeColumns {
  village: SQL;
  cell: SQL;
  sector: SQL;
  district: SQL;
  /** True for a guest from abroad. */
  abroad: SQL;
}

export const REGISTRATION_COLUMNS: ScopeColumns = {
  village: sql`g.village_id`,
  cell: sql`g.cell_id`,
  sector: sql`g.sector_id`,
  district: sql`g.district_id`,
  abroad: sql`(g.nationality <> 'RW')`,
};

export const TALLY_COLUMNS: ScopeColumns = {
  village: sql`t.village_id`,
  cell: sql`t.cell_id`,
  sector: sql`t.sector_id`,
  district: sql`t.district_id`,
  abroad: sql`t.from_abroad`,
};

/** One post's clause, or null when the post names no area (it never should). */
export function grantClause(g: LeaderGrant, c: ScopeColumns): SQL | null {
  switch (g.oversightRole) {
    case 'village_leader':
      return g.villageId ? sql`${c.village} = ${g.villageId}` : null;
    case 'dgie_village':
      return g.villageId ? sql`(${c.village} = ${g.villageId} and ${c.abroad})` : null;
    case 'dgie_cell':
      return g.cellId ? sql`(${c.cell} = ${g.cellId} and ${c.abroad})` : null;
    case 'dasso':
    case 'sector_executive':
      return g.sectorId ? sql`${c.sector} = ${g.sectorId}` : null;
    case 'cell_executive':
      return g.cellId ? sql`${c.cell} = ${g.cellId}` : null;
    // Local government reads every guest in its area, Rwandan or foreign.
    case 'district_officer':
      return g.districtId ? sql`${c.district} = ${g.districtId}` : null;
    // DGIE reads guests from abroad only, at each of its levels.
    case 'district_immigration':
      return g.districtId ? sql`(${c.district} = ${g.districtId} and ${c.abroad})` : null;
    case 'dgie_province':
      return g.provinceId
        ? sql`(${c.district} in (select pd.id from districts pd where pd.province_id = ${g.provinceId}) and ${c.abroad})`
        : null;
    case 'dgie_national':
      return sql`${c.abroad}`;
  }
}

/** Every post of the leader, OR-ed. `false` when none names an area. */
export function scopeSql(grants: readonly LeaderGrant[], c: ScopeColumns = REGISTRATION_COLUMNS): SQL {
  const parts = grants.map((g) => grantClause(g, c)).filter((p): p is SQL => p !== null);
  return parts.length ? sql`(${sql.join(parts, sql` or `)})` : sql`false`;
}

/**
 * Guests in scope this leader has not opened: for each post, inside its area
 * and its own route still unseen.
 */
export function unseenSql(grants: readonly LeaderGrant[]): SQL {
  const parts = grants
    .map((g) => {
      const clause = grantClause(g, REGISTRATION_COLUMNS);
      if (!clause) return null;
      return sql`(${clause} and exists (select 1 from guest_registration_routes ur
        where ur.registration_id = g.id and ur.recipient_role::text = ${g.oversightRole} and ur.seen_at is null))`;
    })
    .filter((p): p is SQL => p !== null);
  return parts.length ? sql`(${sql.join(parts, sql` or `)})` : sql`false`;
}
