import type {
  AdminListMeta,
  AdminTrainingVenue,
  TrainingVenueSummary,
} from '@injishi/contracts';

import { districts, provinces } from '../../../database/drizzle/geography';
import { trainingVenues } from '../../../database/drizzle/training';

/**
 * The column lists and row mappers every training query shares.
 *
 * Held in one file for the reason `waitlist-admin.service.ts` gives for its own
 * `ROW_COLUMNS`: a count and a page built from two column lists eventually
 * disagree, and a venue rendered two ways eventually shows a district in the
 * wrong province on one of them.
 */

/**
 * A venue with its district and province names.
 *
 * THE PROVINCE COMES FROM A JOIN, not from arithmetic on the district id.
 * ADR-049's value-sourcing table describes deriving it from the leading digit
 * of the smart code, which is true of the numbering (D11: district `101` sits
 * in province `1`) and is the wrong way to read it here, because
 * `districts.province_id` is a real foreign key column one join away. Parsing
 * a digit out of an integer would be a second, weaker copy of a relationship
 * the database already holds, and it would quietly break the day a district id
 * needs three digits of province.
 */
export const VENUE_COLUMNS = {
  id: trainingVenues.id,
  name: trainingVenues.name,
  address: trainingVenues.address,
  districtId: trainingVenues.districtId,
  districtName: districts.name,
  provinceId: provinces.id,
  provinceName: provinces.name,
  isOffice: trainingVenues.isOffice,
  retiredAt: trainingVenues.retiredAt,
  createdAt: trainingVenues.createdAt,
};

/** The raw shape `VENUE_COLUMNS` selects. */
export interface VenueRow {
  id: string;
  name: string;
  address: string;
  districtId: number;
  districtName: string | null;
  provinceId: number | null;
  provinceName: string | null;
  isOffice: boolean;
  retiredAt: Date | null;
  createdAt: Date;
}

/**
 * A venue as any public reader sees it.
 *
 * The district and province names fall back to an empty string rather than
 * throwing, because the joins are `leftJoin`s and a venue whose district row
 * went missing is a reference-data problem, not a reason to fail a page a
 * stranger is reading. It renders thin instead of 500-ing.
 */
export function toVenueSummary(row: VenueRow): TrainingVenueSummary {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    districtId: row.districtId,
    districtName: row.districtName ?? '',
    provinceId: row.provinceId ?? 0,
    provinceName: row.provinceName ?? '',
    isOffice: row.isOffice,
  };
}

/** A venue as staff see it: the summary plus whether it is retired. */
export function toAdminVenue(row: VenueRow): AdminTrainingVenue {
  return {
    ...toVenueSummary(row),
    retiredAt: iso(row.retiredAt),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Timestamps cross the wire as ISO strings, which is what the contracts say. */
export function iso(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

/** A required timestamp. Same conversion, no null in the contract. */
export function isoRequired(value: Date): string {
  return value.toISOString();
}

/**
 * Page and page size, applied once.
 *
 * The contracts make both optional and cap `pageSize` at 100. The defaults live
 * here rather than in each route so that two list endpoints cannot page
 * differently, which is the kind of difference a client only finds on page two.
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;

export interface Paging {
  readonly page: number;
  readonly pageSize: number;
  readonly limit: number;
  readonly offset: number;
}

export function pagingFor(query: {
  page?: number;
  pageSize?: number;
}): Paging {
  const page = query.page ?? DEFAULT_PAGE;
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, 100);
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

export function metaFor(paging: Paging, total: number): AdminListMeta {
  return { total, page: paging.page, pageSize: paging.pageSize };
}
