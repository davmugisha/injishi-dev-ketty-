import { HOTEL_GUEST } from '../domain/hotel-guest';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  RWANDA_CODE,
  type FlagGuestRequest,
  GUEST_ARRIVED_LABEL,
  GUEST_LEAVING_LABEL,
  GUEST_LENGTH_LABEL,
  GUEST_LENGTH_NIGHTS,
  GUEST_PLACE_TYPE_KINDS,
  GUEST_PLACE_TYPE_LABEL,
  type GuestArrived,
  type GuestLeaving,
  type GuestLength,
  type GuestPlaceType,
  LEADER_ARRIVING_DAYS,
  type LeaderAudience,
  LEADER_ROLE_LABEL,
  type LeaderFilters,
  type LeaderGuest,
  type LeaderGuestPage,
  type LeaderGuestQuery,
  type LeaderRole,
  type LeaderScope,
  type LeaderSummary,
  type OversightGrant,
  addDays,
  guestArrivedRange,
  guestPlaceTypeOf,
  kigaliDateOf,
  kigaliToday,
  leaderAudienceOf,
} from '@injishi/contracts';
import { sql, type SQL } from 'drizzle-orm';

import { type LeaderGrant, grantLevel, grantsCovering, leaderGrants, routeArea } from '../domain/guest-routing';
import { type Workbook, guestSheet, guestSummary } from '../domain/guest-export';
import { renderGuestListPdf } from '../domain/guest-list-pdf';
import { placeWords, toCsv } from '../domain/guest-words';
import { GuestRegistryRepository, type RegistrationRow } from '../infrastructure/guest-registry.repository';
import { scopeSql, unseenSql } from '../infrastructure/leader-scope';
import { writeXlsx } from '../infrastructure/xlsx-workbook';
import { presentLeaderGuest } from './guest-presenters';

/** Guests per page of the leader's list. */
export const LEADER_PAGE_SIZE = 50;
/** The most rows one export carries. */
export const LEADER_EXPORT_MAX = 5000;

const NOT_FOUND = 'That guest was not found.';

/** The places a narrowing names; applied on top of the leader's own area, never instead of it. */
export function narrowSql(q: Pick<LeaderGuestQuery, 'sectorId' | 'cellId' | 'villageId'>, alias: 'g' | 't' = 'g'): SQL {
  const parts: SQL[] = [];
  const col = (c: string): SQL => sql.raw(`${alias}.${c}`);
  if (q.sectorId) parts.push(sql`${col('sector_id')} = ${q.sectorId}`);
  if (q.cellId) parts.push(sql`${col('cell_id')} = ${q.cellId}`);
  if (q.villageId) parts.push(sql`${col('village_id')} = ${q.villageId}`);
  return parts.length ? sql`(${sql.join(parts, sql` and `)})` : sql`true`;
}

/** The guest filters a list, its downloads and a report share; each optional. */
export interface GuestFilterInput {
  origin?: 'nationals' | 'international';
  nationality?: string;
  relationship?: string;
  flagged?: 'only';
  placeType?: GuestPlaceType;
  length?: GuestLength;
  arrived?: GuestArrived;
  arrivedFrom?: string;
  arrivedTo?: string;
  presentOn?: string;
  leaving?: GuestLeaving;
}

const ALL_PLACE_KINDS = Object.values(GUEST_PLACE_TYPE_KINDS).flat();
const listOf = (values: readonly string[]): SQL => sql.join(values.map((v) => sql`${v}`), sql`, `);

/** A type of place as a predicate over `g`: the business's kind for a hotel desk, any residence else. */
export function placeTypeSql(type: GuestPlaceType): SQL {
  if (type === 'residence') return sql`g.host_kind::text <> 'hotel'`;
  const kind = sql`(select po.business_kind::text from orgs po where po.id = g.org_id)`;
  if (type === 'other') return sql`(g.host_kind::text = 'hotel' and coalesce(${kind}, '') not in (${listOf(ALL_PLACE_KINDS)}))`;
  return sql`(g.host_kind::text = 'hotel' and ${kind} in (${listOf(GUEST_PLACE_TYPE_KINDS[type])}))`;
}

/** The days a list's Arrived filter covers, or null with none: a preset, else a custom range. */
export function arrivedWindow(q: Pick<GuestFilterInput, 'arrived' | 'arrivedFrom' | 'arrivedTo'>, today: string): { from: string | null; to: string | null } | null {
  if (q.arrived) return guestArrivedRange(q.arrived, today);
  if (q.arrivedFrom || q.arrivedTo) return { from: q.arrivedFrom ?? null, to: q.arrivedTo ?? null };
  return null;
}

/**
 * The guest filters over `guest_registrations g` (nationality, Rwandan or foreign, relationship, flagged, the
 * type of place, the length of stay, when they arrived, were here or leave), shared by the list, its counts
 * and downloads, and the report's figures read in SQL. The relative ones read from `today`, the Kigali day.
 */
export function guestFilterSql(q: GuestFilterInput, today: string): SQL {
  const parts: SQL[] = [];
  if (q.origin === 'nationals') parts.push(sql`g.nationality = ${RWANDA_CODE}`);
  if (q.origin === 'international') parts.push(sql`g.nationality <> ${RWANDA_CODE}`);
  if (q.nationality) parts.push(sql`g.nationality = ${q.nationality}`);
  if (q.relationship) {
    // A hotel guest has no relationship of its own; the reads name it `HOTEL_GUEST`.
    parts.push(q.relationship === HOTEL_GUEST.code ? sql`g.host_kind = 'hotel'` : sql`g.relationship = ${q.relationship}`);
  }
  if (q.flagged) {
    parts.push(sql`exists (select 1 from guest_registration_routes fr where fr.registration_id = g.id and fr.flagged_at is not null)`);
  }
  if (q.placeType) parts.push(placeTypeSql(q.placeType));
  if (q.length) {
    const { min, max } = GUEST_LENGTH_NIGHTS[q.length];
    if (min !== undefined) parts.push(sql`(g.departure_on - g.arrival_on) >= ${min}`);
    if (max !== undefined) parts.push(sql`(g.departure_on - g.arrival_on) <= ${max}`);
  }
  const arrived = arrivedWindow(q, today);
  if (arrived?.from) parts.push(sql`g.arrival_on >= ${arrived.from}::date`);
  if (arrived?.to) parts.push(sql`g.arrival_on <= ${arrived.to}::date`);
  if (q.presentOn) parts.push(sql`(g.arrival_on <= ${q.presentOn}::date and g.departure_on >= ${q.presentOn}::date)`);
  if (q.leaving === 'today') parts.push(sql`g.departure_on = ${today}::date`);
  if (q.leaving === 'next_7_days') parts.push(sql`g.departure_on between ${today}::date and ${addDays(today, LEADER_ARRIVING_DAYS)}::date`);
  return parts.length ? sql`(${sql.join(parts, sql` and `)})` : sql`true`;
}

/** The tab as a predicate over `g`, and the order it reads in. */
export function tabSql(q: Pick<LeaderGuestQuery, 'tab' | 'when' | 'q'>, today: string): { where: SQL; order: SQL } {
  const soon = addDays(today, LEADER_ARRIVING_DAYS);
  const search = q.q
    ? sql` and (g.full_name ilike ${`%${q.q}%`} or g.phone like ${`%${q.q.replace(/\s/g, '')}%`} or coalesce(g.id_number, '') ilike ${`%${q.q}%`})`
    : sql``;
  switch (q.tab) {
    case 'all':
      // Everyone in the area: who is to come or staying first, soonest arrival first; then who left.
      return {
        where: sql`(true${search})`,
        order: sql`(g.departure_on < ${today}::date) asc, case when g.departure_on < ${today}::date then null else g.arrival_on end asc, g.departure_on desc`,
      };
    case 'arriving':
      return q.when === 'later'
        ? { where: sql`(g.arrival_on > ${soon}::date${search})`, order: sql`g.arrival_on asc` }
        : { where: sql`(g.arrival_on > ${today}::date and g.arrival_on <= ${soon}::date${search})`, order: sql`g.arrival_on asc` };
    case 'staying':
      return { where: sql`(g.arrival_on <= ${today}::date and g.departure_on >= ${today}::date${search})`, order: sql`g.departure_on asc` };
    case 'left':
      return { where: sql`(g.departure_on < ${today}::date${search})`, order: sql`g.departure_on desc` };
    case 'flagged':
      return {
        where: sql`(exists (select 1 from guest_registration_routes fr where fr.registration_id = g.id and fr.flagged_at is not null)${search})`,
        order: sql`(select max(fr.flagged_at) from guest_registration_routes fr where fr.registration_id = g.id) desc nulls last`,
      };
  }
}

/**
 * The local leader's console (P5): the guests in their area, by tab, with the
 * counts, the filters a wider post can narrow to, opening (seen), flagging and
 * the export. Scope is the leader's own posts on every read: a guest outside
 * them, or of the wrong kind (a Rwandan for immigration), answers 404 exactly
 * like an id that does not exist.
 */
@Injectable()
export class LeaderConsoleService {
  constructor(private readonly guests: GuestRegistryRepository) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  protected today(): string {
    return kigaliToday(this.now());
  }

  /** The leader posts among the grants the guard handed over. */
  posts(grants: readonly OversightGrant[]): LeaderGrant[] {
    const posts = leaderGrants(grants);
    if (posts.length === 0) throw new ForbiddenException('You do not hold a local leader post.');
    return posts;
  }

  async summary(userId: string, grants: readonly OversightGrant[], query: Partial<LeaderGuestQuery> = {}): Promise<LeaderSummary> {
    const posts = this.posts(grants);
    const today = this.today();
    const scope = scopeSql(posts);
    const narrow = sql`${narrowSql(query)} and ${guestFilterSql(query, today)}`;
    const [leader, scopes, filters, counts] = await Promise.all([
      this.guests.leader(userId),
      this.scopes(posts),
      this.filters(posts, query),
      this.guests.leaderCounts(scope, narrow, unseenSql(posts), today, addDays(today, LEADER_ARRIVING_DAYS)),
    ]);
    return { leader, audience: this.audience(posts), scopes, filters, counts };
  }

  async page(userId: string, grants: readonly OversightGrant[], query: LeaderGuestQuery): Promise<LeaderGuestPage> {
    const posts = this.posts(grants);
    const today = this.today();
    const scope = scopeSql(posts);
    const narrow = sql`${narrowSql(query)} and ${guestFilterSql(query, today)}`;
    const tab = tabSql(query, today);
    const where = sql`${narrow} and ${tab.where}`;
    const [summary, rows, total] = await Promise.all([
      this.summary(userId, grants, query),
      this.guests.leaderList(scope, where, tab.order, LEADER_PAGE_SIZE, (query.page - 1) * LEADER_PAGE_SIZE),
      this.guests.leaderTotal(scope, where),
    ]);
    return {
      ...summary,
      tab: query.tab,
      when: query.when,
      guests: await this.present(rows, posts, today),
      page: query.page,
      pageSize: LEADER_PAGE_SIZE,
      total,
    };
  }

  /** One guest, read only. */
  async one(grants: readonly OversightGrant[], registrationId: string): Promise<LeaderGuest> {
    const posts = this.posts(grants);
    const row = await this.row(posts, registrationId);
    const [guest] = await this.present([row], posts, this.today());
    if (!guest) throw new NotFoundException(NOT_FOUND);
    return guest;
  }

  /** Opening a guest marks it seen on each of this leader's posts that cover it. */
  async seen(userId: string, grants: readonly OversightGrant[], registrationId: string): Promise<LeaderGuest> {
    const posts = this.posts(grants);
    const row = await this.row(posts, registrationId);
    const roles = this.rolesFor(posts, row);
    await this.guests.markSeen(row.id, roles, userId, this.now());
    return this.one(grants, registrationId);
  }

  /** Flag a guest for a closer look, with a note, on the leader's own step of the chain. */
  async flag(userId: string, grants: readonly OversightGrant[], registrationId: string, body: FlagGuestRequest): Promise<LeaderGuest> {
    const posts = this.posts(grants);
    const row = await this.row(posts, registrationId);
    const [role] = this.rolesFor(posts, row);
    if (!role) throw new NotFoundException(NOT_FOUND);
    const now = this.now();
    await this.guests.transaction(async (tx) => {
      const routeId = await this.guests.flag(tx, row.id, role, userId, body.note, now);
      if (!routeId) throw new NotFoundException(NOT_FOUND);
      await this.guests.audit(tx, {
        actorUserId: userId,
        registrationId: row.id,
        eventType: 'guest_registration.flagged',
        diff: { role, routeId },
        reason: body.note,
        districtId: row.districtId,
      });
      await this.guests.outbox(tx, {
        eventType: 'guest.flagged',
        registrationId: row.id,
        workspaceId: row.workspaceId,
        change: `${role}:${now.toISOString()}`,
        payload: { role, districtId: row.districtId },
      });
    });
    await this.guests.markSeen(row.id, this.rolesFor(posts, row), userId, now);
    return this.one(grants, registrationId);
  }

  /** Local government or DGIE: what the screens, the columns and the files show. */
  audience(posts: readonly LeaderGrant[]): LeaderAudience {
    return leaderAudienceOf(posts.map((p) => p.oversightRole));
  }

  /**
   * The list as a file: the same rows, tab and filters as the screen, up to the export ceiling, with who it is
   * for and the filters in words. Every format (Excel, CSV, PDF) is built from this.
   */
  async exportBook(userId: string, grants: readonly OversightGrant[], query: LeaderGuestQuery): Promise<Workbook & { guests: LeaderGuest[]; audience: LeaderAudience }> {
    const posts = this.posts(grants);
    const today = this.today();
    const tab = tabSql(query, today);
    const where = sql`${narrowSql(query)} and ${guestFilterSql(query, today)} and ${tab.where}`;
    const [rows, leader, scopes, narrowed, filters] = await Promise.all([
      this.guests.leaderList(scopeSql(posts), where, tab.order, LEADER_EXPORT_MAX, 0),
      this.guests.leader(userId),
      this.scopes(posts),
      this.narrowedWords(query),
      this.filters(posts, query),
    ]);
    const guests = await this.present(rows, posts, today);
    const audience = this.audience(posts);
    const area = narrowed ?? scopes[0]?.area ?? 'your area';
    const words = listFilterWords(query, today, filters);
    const meta: [string, string][] = [
      ['Prepared by', leader.name ? `${leader.name} (${leader.email})` : leader.email],
      ...scopes.map((s): [string, string] => [s.roleLabel, s.area]),
      ...(narrowed ? [['Narrowed to', narrowed] as [string, string]] : []),
      ['Filters', words.length ? words.join(', ') : 'None: every guest in the area'],
      ['Generated', `${kigaliDateOf(this.now())} on Injishi`],
      ...(guests.length >= LEADER_EXPORT_MAX ? [['Note', `The first ${LEADER_EXPORT_MAX} guests only: narrow the filters for the rest.`] as [string, string]] : []),
    ];
    return {
      title: `${audience === 'dgie' ? 'Foreign guests' : 'Guests'} in ${area.split(',')[0]}`,
      meta,
      summary: guestSummary(guests, audience),
      sheets: [guestSheet(guests, audience)],
      guests,
      audience,
    };
  }

  /** The list as an Excel workbook: the summary sheet first, then the guests. */
  async xlsx(userId: string, grants: readonly OversightGrant[], query: LeaderGuestQuery): Promise<Buffer> {
    return writeXlsx(await this.exportBook(userId, grants, query));
  }

  /** The list as A4 landscape: the counts first, then the guests, grouped. */
  async pdf(userId: string, grants: readonly OversightGrant[], query: LeaderGuestQuery): Promise<Buffer> {
    const book = await this.exportBook(userId, grants, query);
    return renderGuestListPdf({ title: book.title, meta: book.meta, guests: book.guests, audience: book.audience });
  }

  /** The list as CSV, for another system: the same columns as the workbook, days as `yyyy-mm-dd`. */
  async csv(userId: string, grants: readonly OversightGrant[], query: LeaderGuestQuery): Promise<string> {
    const [sheet] = (await this.exportBook(userId, grants, query)).sheets;
    return toCsv(sheet?.columns.map((c) => c.header) ?? [], sheet?.rows ?? []);
  }

  // --- Helpers ----------------------------------------------------------------------------

  /** The narrowing in words ("Urugwiro village, Kamatamu cell…"), or null. */
  async narrowedWords(query: Pick<LeaderGuestQuery, 'sectorId' | 'cellId' | 'villageId'>): Promise<string | null> {
    const level = query.villageId ? 'village' : query.cellId ? 'cell' : query.sectorId ? 'sector' : null;
    if (!level) return null;
    const area = await this.guests.placeIn(level, (query.villageId ?? query.cellId ?? query.sectorId) as number);
    if (!area) return null;
    return placeWords(await this.guests.areaNames(area)) || null;
  }

  private async row(posts: readonly LeaderGrant[], registrationId: string): Promise<RegistrationRow> {
    const row = await this.guests.leaderFind(scopeSql(posts), registrationId);
    // The SQL scope and the rule in code are the same rule; both must agree before a guest is shown.
    if (!row || grantsCovering(posts, row).length === 0) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  private rolesFor(posts: readonly LeaderGrant[], row: RegistrationRow): LeaderRole[] {
    return [...new Set(grantsCovering(posts, row).map((p) => p.oversightRole))];
  }

  private async present(rows: RegistrationRow[], posts: readonly LeaderGrant[], today: string): Promise<LeaderGuest[]> {
    const routes = await this.guests.routesFor(rows.map((r) => r.id));
    return rows.map((r) => presentLeaderGuest(r, routes, this.rolesFor(posts, r), today));
  }

  /** Each post in words: its role and its place, village up to district. */
  async scopes(posts: readonly LeaderGrant[]): Promise<LeaderScope[]> {
    return Promise.all(
      posts.map(async (p) => {
        const area = routeArea(p.oversightRole, {
          villageId: p.villageId,
          cellId: p.cellId,
          sectorId: p.sectorId,
          districtId: p.districtId,
        });
        const names = await this.guests.areaNames(area);
        return {
          assignmentId: p.assignmentId,
          role: p.oversightRole,
          roleLabel: LEADER_ROLE_LABEL[p.oversightRole],
          level: grantLevel(p),
          area: placeWords(names) || 'Area not on record',
        };
      }),
    );
  }

  /**
   * The places a wider post can narrow to, one level at a time: a district
   * post offers its sectors, then the chosen sector's cells, then the chosen
   * cell's villages; a DASSO starts at cells, a cell executive at villages; a
   * village leader has nothing to narrow.
   */
  async filters(posts: readonly LeaderGrant[], query: Partial<LeaderGuestQuery>): Promise<LeaderFilters> {
    const districts = [...new Set(posts.filter((p) => grantLevel(p) === 'district').map((p) => p.districtId).filter((x): x is number => x !== null))];
    const sectors = await this.guests.sectorsIn(districts);
    const ownSectors = posts.filter((p) => grantLevel(p) === 'sector').map((p) => p.sectorId).filter((x): x is number => x !== null);
    // A narrowing outside the leader's own places offers nothing below it.
    const sectorOffered = (id: number): boolean => sectors.some((s) => s.id === id) || ownSectors.includes(id);
    const sectorIds = query.sectorId ? (sectorOffered(query.sectorId) ? [query.sectorId] : []) : ownSectors;
    const cells = await this.guests.cellsIn([...new Set(sectorIds)]);
    const ownCells = posts.filter((p) => grantLevel(p) === 'cell').map((p) => p.cellId).filter((x): x is number => x !== null);
    const cellOffered = (id: number): boolean => cells.some((c) => c.id === id) || ownCells.includes(id);
    const cellIds = query.cellId ? (cellOffered(query.cellId) ? [query.cellId] : []) : ownCells;
    const [villages, nationalities, kinds, relationships] = await Promise.all([
      this.guests.villagesIn([...new Set(cellIds)]),
      this.guests.nationalitiesIn(scopeSql(posts), narrowSql(query)),
      this.guests.placeTypesIn(scopeSql(posts), narrowSql(query)),
      this.guests.relationshipsIn(scopeSql(posts), narrowSql(query)),
    ]);
    const types = new Map<GuestPlaceType, number>();
    for (const k of kinds) {
      const type = guestPlaceTypeOf(k.hostKind, k.businessKind);
      types.set(type, (types.get(type) ?? 0) + k.count);
    }
    const placeTypes = [...types.entries()]
      .map(([type, count]) => ({ type, label: GUEST_PLACE_TYPE_LABEL[type], count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return { sectors, cells, villages, nationalities, placeTypes, relationships };
  }
}

/** A list's filters in words, for the top of a file. */
export function listFilterWords(q: Partial<LeaderGuestQuery>, today: string, filters: Pick<LeaderFilters, 'nationalities' | 'relationships'>): string[] {
  const words: string[] = [];
  const tabs: Record<string, string> = { arriving: q.when === 'later' ? 'Arriving later' : 'Arriving in 7 days', staying: 'Staying now', left: 'Left', flagged: 'Flagged' };
  if (q.tab && tabs[q.tab]) words.push(tabs[q.tab] as string);
  if (q.arrived) {
    const r = guestArrivedRange(q.arrived, today);
    words.push(`Arrived ${GUEST_ARRIVED_LABEL[q.arrived].toLowerCase()} (${r.from === r.to ? r.from : `${r.from} to ${r.to}`})`);
  } else if (q.arrivedFrom || q.arrivedTo) {
    words.push(`Arrived ${q.arrivedFrom ?? 'any day'} to ${q.arrivedTo ?? 'today'}`);
  }
  if (q.presentOn) words.push(`Present on ${q.presentOn}`);
  if (q.leaving) words.push(`Leaving ${GUEST_LEAVING_LABEL[q.leaving].toLowerCase()}`);
  if (q.length) words.push(GUEST_LENGTH_LABEL[q.length]);
  if (q.placeType) words.push(GUEST_PLACE_TYPE_LABEL[q.placeType]);
  if (q.origin) words.push(q.origin === 'nationals' ? 'Rwandan guests' : 'Foreign guests');
  if (q.nationality) words.push(filters.nationalities.find((n) => n.code === q.nationality)?.name ?? q.nationality);
  if (q.relationship) words.push(filters.relationships.find((r) => r.code === q.relationship)?.label ?? q.relationship);
  if (q.q) words.push(`Search "${q.q}"`);
  return words;
}
