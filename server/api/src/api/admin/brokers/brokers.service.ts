import {
  AdminBrokerListResponse,
  AdminRevealListResponse,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';

import { users } from '../../../database/drizzle/auth';
import { districts } from '../../../database/drizzle/geography';
import { listings, properties } from '../../../database/drizzle/inventory';
import { placementFees } from '../../../database/drizzle/money';
import { orgs } from '../../../database/drizzle/org';
import {
  brokerRevealCredits,
  brokers,
  contactReveals,
  tenantPlacements,
} from '../../../database/drizzle/residence';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * Show the tail of a phone number and hide the rest.
 *
 * Same rule and same shape as `ProfileService`'s document masking, for the same
 * reason: enough for a staff member to recognise which number is on file, not
 * enough to be worth exfiltrating. A short number is masked entirely rather
 * than mostly shown, because four digits of a six-digit number is the number.
 *
 * The console lists brokers; it does not export the directory that
 * `broker_reveal_credits` exists to meter.
 */
function maskPhone(phone: string | null): string | null {
  if (phone === null) return null;
  if (phone.length <= 4) return '•'.repeat(phone.length);
  return `${'•'.repeat(4)}${phone.slice(-4)}`;
}

/**
 * The Brokers section: the directory and the contact-reveal log.
 *
 * Both responses are parsed against their `@injishi/contracts` schema before
 * they leave, so an aggregate that came back null — which is what every `sum`
 * over an empty ledger does — cannot reach the browser as a missing field.
 */
@Injectable()
export class AdminBrokersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // -------------------------------------------------------------------------
  // GET /admin/brokers
  // -------------------------------------------------------------------------

  /**
   * The broker directory, with each broker's activity counted beside them.
   *
   * The four aggregates are correlated subqueries rather than four joins with a
   * GROUP BY. Joining `contact_reveals`, `tenant_placements` and
   * `placement_fees` onto one row multiplies them together — a broker with 3
   * reveals and 2 placements would report 6 of each — and the `DISTINCT`
   * gymnastics that fix a fan-out are the thing that later gets edited wrong.
   *
   * `brokers.national_id` is on the table and is not selected. A broker's
   * government number is not needed to administer a broker, and
   * `AdminBrokerRow` has no field for it.
   */
  async listBrokers(
    page: number,
    pageSize: number,
  ): Promise<AdminBrokerListResponse> {
    const rows = await this.db
      .select({
        id: brokers.id,
        userId: brokers.userId,
        // `brokers.name`/`.email` are the broker's own trading details and are
        // nullable; the account row always has an email and usually a name. The
        // fallback is the SAME person either way, so it adds no disclosure —
        // it only stops the directory showing a blank where a name exists.
        name: sql<string | null>`coalesce(${brokers.name}, ${users.name})`,
        email: sql<string | null>`coalesce(${brokers.email}, ${users.email})`,
        phone: brokers.phone,
        status: brokers.status,
        /*
         * `sum(delta)`, not a stored counter. `broker_reveal_credits` is a
         * ledger precisely so a balance can always be explained by the rows
         * that produced it, and the contract says the number is SIGNED: a
         * ledger with more spends than grants is a real, visible state, and
         * clamping it at zero would hide the bug that produced it.
         */
        revealCreditBalance: sql<number>`(
          select coalesce(sum(${brokerRevealCredits.delta}), 0)
            from ${brokerRevealCredits}
           where ${brokerRevealCredits.brokerId} = ${brokers.id}
        )::int`,
        revealCount: sql<number>`(
          select count(*) from ${contactReveals}
           where ${contactReveals.brokerId} = ${brokers.id}
        )::int`,
        placementCount: sql<number>`(
          select count(*) from ${tenantPlacements}
           where ${tenantPlacements.brokerId} = ${brokers.id}
        )::int`,
        /*
         * Fees are money, so they are summed as `bigint` and carried through
         * `pg` as a string. An `::int` cast here would overflow at roughly two
         * billion RWF, which is a plausible lifetime total for a busy broker
         * and would fail as a wrong number rather than as an error.
         */
        placementFeesRwf: sql<string>`(
          select coalesce(sum(${placementFees.amountRwf}), 0)
            from ${placementFees}
           where ${placementFees.brokerId} = ${brokers.id}
        )::bigint`,
        /*
         * The currency those fees are denominated in, read from the rows rather
         * than assumed. `placement_fees.currency` defaults to RWF and the
         * platform is single-currency in v1, so `min` over the set is the
         * currency; when a broker has no fees at all there is no row to read
         * and RWF is the fallback, because `AdminBrokerRow.currency` is not
         * nullable and an empty string would be worse than the default.
         */
        currency: sql<string>`(
          select coalesce(min(${placementFees.currency}), 'RWF')
            from ${placementFees}
           where ${placementFees.brokerId} = ${brokers.id}
        )`,
        createdAt: brokers.createdAt,
      })
      .from(brokers)
      // Inner: `brokers.user_id` is NOT NULL and references `users`, so a
      // broker without an account cannot exist.
      .innerJoin(users, eq(users.id, brokers.userId))
      .orderBy(desc(brokers.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(brokers);

    return AdminBrokerListResponse.parse({
      items: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.name,
        email: r.email,
        phoneMasked: maskPhone(r.phone),
        status: r.status,
        revealCreditBalance: r.revealCreditBalance,
        revealCount: r.revealCount,
        placementCount: r.placementCount,
        placementFeesRwf: Number(r.placementFeesRwf),
        currency: r.currency,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { total: counted?.n ?? 0, page, pageSize },
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/brokers/reveals
  // -------------------------------------------------------------------------

  /**
   * The contact-reveal log: a broker spent a credit to see a landlord's number.
   *
   * `contact_reveals.revealed_phone` and `.revealed_email` are on the table and
   * are NOT selected. The point of the audit is that a reveal HAPPENED, by whom
   * and against which listing; replaying the contact details into an admin list
   * would hand every staff member the directory the credit system exists to
   * meter. They are not masked here — they are not read.
   */
  async listReveals(
    page: number,
    pageSize: number,
  ): Promise<AdminRevealListResponse> {
    const rows = await this.db
      .select({
        id: contactReveals.id,
        brokerId: contactReveals.brokerId,
        brokerName: sql<string | null>`coalesce(${brokers.name}, ${users.name})`,
        listingId: contactReveals.listingId,
        landlordOrgId: contactReveals.landlordOrgId,
        landlordOrgName: orgs.legalName,
        /*
         * The district of the PROPERTY the listing is for, not of the landlord
         * org. A property manager registered in Gasabo lists buildings across
         * the country, and the question this log answers — where is the
         * reveal activity — is about the building.
         *
         * Null when the reveal names no listing (`listing_id` is nullable) or
         * when the property has no district yet. `AdminRevealEvent.districtName`
         * is nullable for exactly that, and the org's own district is
         * deliberately NOT used as a fallback: it would silently answer a
         * different question in the same column.
         */
        districtName: districts.name,
        revealedAt: contactReveals.revealedAt,
      })
      .from(contactReveals)
      .innerJoin(brokers, eq(brokers.id, contactReveals.brokerId))
      .innerJoin(users, eq(users.id, brokers.userId))
      .leftJoin(orgs, eq(orgs.id, contactReveals.landlordOrgId))
      .leftJoin(listings, eq(listings.id, contactReveals.listingId))
      .leftJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .orderBy(desc(contactReveals.revealedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(contactReveals);

    return AdminRevealListResponse.parse({
      items: rows.map((r) => ({
        id: r.id,
        brokerId: r.brokerId,
        brokerName: r.brokerName,
        listingId: r.listingId,
        landlordOrgId: r.landlordOrgId,
        landlordOrgName: r.landlordOrgName,
        districtName: r.districtName,
        revealedAt: r.revealedAt.toISOString(),
      })),
      meta: { total: counted?.n ?? 0, page, pageSize },
    });
  }
}
