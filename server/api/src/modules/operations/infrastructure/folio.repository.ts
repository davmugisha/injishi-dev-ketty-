import type {
  ChargeType,
  FolioStatus,
  FolioType,
  PaymentMethod,
  TaxCode,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';

import {
  bookings,
  configEntries,
  departments,
  folioCharges,
  folios,
  guestStays,
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  rooms,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { ledgerKindFor } from './ledger-posting';

export interface FolioRow {
  id: string;
  workspaceId: string;
  propertyId: string;
  folioNumber: string;
  folioType: FolioType;
  status: FolioStatus;
  guestStayId: string | null;
  bookingId: string | null;
  guestName: string | null;
  roomLabel: string | null;
  balanceRwf: number;
  openedAt: Date;
  closedAt: Date | null;
}

export interface ChargeRow {
  id: string;
  folioId: string;
  workspaceId: string;
  chargeType: ChargeType;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  quantity: number;
  unitPriceRwf: number | null;
  amountRwf: number;
  taxCode: TaxCode | null;
  taxRate: string | null;
  taxAmountRwf: number | null;
  sourceRefType: string | null;
  sourceRefId: string | null;
  postedByUserId: string | null;
  businessDate: string | null;
  postedAt: Date;
}

/** One line to write, already priced. The repository does not decide amounts. */
export interface ChargeDraft {
  chargeType: ChargeType;
  description: string | null;
  departmentId: string | null;
  outletId?: string | null;
  quantity: number;
  unitPriceRwf: number | null;
  amountRwf: number;
  taxCode: TaxCode | null;
  taxRate: string | null;
  taxAmountRwf: number | null;
  sourceRefType: string;
  sourceRefId: string | null;
  postedByUserId: string | null;
  businessDate: string | null;
  idempotencyKey: string | null;
  /** Resolved by the service from the chart of accounts. */
  accountCode: string;
  method?: PaymentMethod | null;
}

/** Base32 without the letters a reader confuses: no I, L, O, U. */
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomFolioNumber(): string {
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += BASE32[Math.floor(Math.random() * BASE32.length)];
  }
  return out;
}

/** The transaction handle Drizzle hands a `db.transaction` callback. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Post lines and make the balance true again, INSIDE a transaction the caller
 * owns (AC-2, AC-4).
 *
 * Exported as a function rather than kept as a repository method because a
 * fulfilled service order has to post its charge in the SAME transaction that
 * moves the order to `delivered` (§14.7). Two transactions there means a crash
 * between them leaves a delivered order with nothing on the bill.
 *
 * The folio row is locked first (`SELECT ... FOR UPDATE`), then every line is
 * inserted, then the balance is recomputed from the sum of the charges. Two
 * concurrent charges therefore queue on a single guest's bill rather than each
 * writing a total that omits the other.
 *
 * Every line also writes exactly one `ledger_transactions` row and one
 * `ledger_entries` row against the account its type maps to, carrying the
 * workspace and the same sign as the charge. Same transaction, so a charge with
 * no entry behind it is not a state this code can reach.
 */
export async function postChargesTx(
  tx: Tx,
  input: { folioId: string; workspaceId: string; drafts: ChargeDraft[] },
): Promise<{ chargeIds: string[]; balanceRwf: number; status: FolioStatus }> {
    const [locked] = await tx
      .select({ id: folios.id, status: folios.status })
      .from(folios)
      .where(eq(folios.id, input.folioId))
      .for('update');
    if (!locked) throw new Error('Folio vanished under the lock.');

    const chargeIds: string[] = [];
    for (const draft of input.drafts) {
      const [charge] = await tx
        .insert(folioCharges)
        .values({
          folioId: input.folioId,
          workspaceId: input.workspaceId,
          departmentId: draft.departmentId,
          outletId: draft.outletId ?? null,
          chargeType: draft.chargeType,
          description: draft.description,
          quantity: draft.quantity,
          unitPriceRwf: draft.unitPriceRwf,
          amountRwf: draft.amountRwf,
          taxCode: draft.taxCode,
          taxRate: draft.taxRate,
          taxAmountRwf: draft.taxAmountRwf,
          sourceRefType: draft.sourceRefType,
          sourceRefId: draft.sourceRefId,
          postedByUserId: draft.postedByUserId,
          businessDate: draft.businessDate,
          idempotencyKey: draft.idempotencyKey,
        })
        .returning({ id: folioCharges.id });
      if (!charge) throw new Error('Charge insert returned no row.');
      chargeIds.push(charge.id);

      const [account] = await tx
        .select({ id: ledgerAccounts.id })
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.code, draft.accountCode))
        .limit(1);
      if (!account) {
        // Migration phase 2 ships every code this map can produce, so this is
        // a broken database rather than a bad request. Failing loudly beats a
        // charge whose money was never recorded anywhere.
        throw new Error(
          `Ledger account ${draft.accountCode} is missing. Migration phase 2 has not run.`,
        );
      }

      const [txn] = await tx
        .insert(ledgerTransactions)
        .values({
          kind: ledgerKindFor(draft.chargeType),
          idempotencyKey: draft.idempotencyKey,
          memo: draft.description,
        })
        .returning({ id: ledgerTransactions.id });
      if (!txn) throw new Error('Ledger transaction insert returned no row.');

      await tx.insert(ledgerEntries).values({
        transactionId: txn.id,
        accountId: account.id,
        // Same sign as the charge, which is the whole sign convention: a
        // department's revenue is the plain sum of its account's entries.
        amountRwf: draft.amountRwf,
        workspaceId: input.workspaceId,
        relatedType: 'folio_charge',
        relatedId: charge.id,
      });
    }

    const [sum] = await tx
      .select({
        total: sql<number>`coalesce(sum(${folioCharges.amountRwf}), 0)::bigint`,
      })
      .from(folioCharges)
      .where(eq(folioCharges.folioId, input.folioId));
    const balanceRwf = Number(sum?.total ?? 0);

    // A settled folio that stops being zero (a void) reopens; an open one
    // that reaches zero settles. `closed` and `disputed` are moved by their
    // own commands and are never touched here.
    let status: FolioStatus = locked.status;
    if (status === 'open' && balanceRwf === 0) status = 'settled';
    else if (status === 'settled' && balanceRwf !== 0) status = 'open';

    await tx
      .update(folios)
      .set({ balanceRwf, status, updatedAt: new Date() })
      .where(eq(folios.id, input.folioId));

    return { chargeIds, balanceRwf, status };
}

/**
 * The only place that touches Drizzle for folios and their charges
 * (ADR-016 slice 3).
 *
 * Two rules run through every write here and both are load bearing:
 *
 * 1. **A charge row is never updated or deleted.** Voiding posts a second,
 *    negative row naming the first. There is no `is_void` column to flip, which
 *    is ADR-016 correction 1: §14 said "never a mutation" and then put a
 *    mutable boolean on the row.
 * 2. **The balance is recomputed from the sum under a row lock**, inside the
 *    charge's own transaction (D-l). Recomputing alone is not concurrency safe:
 *    under the default isolation two charges each read a sum that misses the
 *    other, and the second write wins with a total that is too low. The lost
 *    charge is typically the last one before checkout.
 */
@Injectable()
export class FolioRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Reads ---------------------------------------------------------------

  async listFolios(workspaceId: string): Promise<FolioRow[]> {
    return this.selectFolios(eq(folios.workspaceId, workspaceId));
  }

  async findFolio(id: string): Promise<FolioRow | null> {
    const [row] = await this.selectFolios(eq(folios.id, id));
    return row ?? null;
  }

  async findFolioForBooking(bookingId: string): Promise<FolioRow | null> {
    const [row] = await this.selectFolios(eq(folios.bookingId, bookingId));
    return row ?? null;
  }

  async findFolioForStay(stayId: string): Promise<FolioRow | null> {
    const [row] = await this.selectFolios(eq(folios.guestStayId, stayId));
    return row ?? null;
  }

  async listCharges(folioId: string): Promise<ChargeRow[]> {
    return this.selectCharges(eq(folioCharges.folioId, folioId));
  }

  async findCharge(id: string): Promise<ChargeRow | null> {
    const [row] = await this.selectCharges(eq(folioCharges.id, id));
    return row ?? null;
  }

  /** The reversing line naming this charge, when one exists. */
  async findReversalOf(chargeId: string): Promise<ChargeRow | null> {
    const [row] = await this.selectCharges(
      and(
        eq(folioCharges.sourceRefType, 'void'),
        eq(folioCharges.sourceRefId, chargeId),
      )!,
    );
    return row ?? null;
  }

  /** A replay of a command that already ran, found by its stored key. */
  async findChargeByIdempotencyKey(key: string): Promise<ChargeRow | null> {
    const [row] = await this.selectCharges(eq(folioCharges.idempotencyKey, key));
    return row ?? null;
  }

  /**
   * The tax rates effective right now (AC-5, D-m).
   *
   * Effective dated in `config_entries`, because a rate a tax authority can
   * change does not belong in a document or in a constant. The table carries no
   * workspace column and that is correct: these rates are national.
   *
   * Returns null when nothing is effective, and the service then REFUSES the
   * post rather than defaulting. A defaulted tax rate is a wrong invoice that
   * nobody notices until an audit.
   */
  async effectiveTaxRates(
    at: Date,
  ): Promise<Record<string, number> | null> {
    const [row] = await this.db
      .select({ value: configEntries.value })
      .from(configEntries)
      .where(
        and(
          eq(configEntries.configType, 'tax_rates'),
          or(
            isNull(configEntries.effectiveFrom),
            sql`${configEntries.effectiveFrom} <= ${at}`,
          ),
          or(
            isNull(configEntries.effectiveTo),
            sql`${configEntries.effectiveTo} > ${at}`,
          ),
        ),
      )
      .orderBy(desc(configEntries.effectiveFrom), desc(configEntries.version))
      .limit(1);

    const value = row?.value;
    return value && typeof value === 'object'
      ? (value as Record<string, number>)
      : null;
  }

  async findDepartment(id: string): Promise<{
    id: string;
    workspaceId: string;
    propertyId: string | null;
    departmentCategory: string;
    isRevenueCenter: boolean;
    status: string;
  } | null> {
    const [row] = await this.db
      .select({
        id: departments.id,
        workspaceId: departments.workspaceId,
        propertyId: departments.propertyId,
        departmentCategory: departments.departmentCategory,
        isRevenueCenter: departments.isRevenueCenter,
        status: departments.status,
      })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);
    return row ?? null;
  }

  // --- Writes --------------------------------------------------------------

  /**
   * Open a folio for a confirmed booking, if it has none.
   *
   * The system opens folios; there is no `POST /ops/folios`, because a bill
   * with no subject is not a thing an operator should be able to make.
   */
  async openForBooking(input: {
    bookingId: string;
    workspaceId: string;
    propertyId: string;
    guestUserId: string | null;
  }): Promise<string | null> {
    const existing = await this.findFolioForBooking(input.bookingId);
    if (existing) return existing.id;

    // Retried rather than assumed unique: the number is random, and a collision
    // is rare enough that a loop is cheaper than a sequence that leaks volume.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const [row] = await this.db
        .insert(folios)
        .values({
          folioNumber: randomFolioNumber(),
          workspaceId: input.workspaceId,
          propertyId: input.propertyId,
          bookingId: input.bookingId,
          guestUserId: input.guestUserId,
          folioType: 'guest',
        })
        .onConflictDoNothing()
        .returning({ id: folios.id });
      if (row) return row.id;
    }
    return null;
  }

  /**
   * Open a folio for a WALK IN, which has no booking to open one against
   * (ADR-035).
   *
   * The twin of `openForBooking`, and it exists because the folio check is
   * "at least one of booking or stay is set" rather than "exactly one" — a
   * relaxation ADR-016 correction 2 made for the bind below, and the same
   * relaxation is what lets a bill exist for a guest who never booked.
   *
   * A walk in that got no bill would be a guest nobody could charge, which is
   * most of what a walk in is: someone who pays at the counter.
   */
  async openForStay(input: {
    guestStayId: string;
    workspaceId: string;
    propertyId: string;
    guestUserId: string | null;
  }): Promise<string | null> {
    const existing = await this.findFolioForStay(input.guestStayId);
    if (existing) return existing.id;

    // Retried rather than assumed unique, exactly as `openForBooking` does: the
    // number is random and a loop is cheaper than a sequence that leaks volume.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const [row] = await this.db
        .insert(folios)
        .values({
          folioNumber: randomFolioNumber(),
          workspaceId: input.workspaceId,
          propertyId: input.propertyId,
          guestStayId: input.guestStayId,
          guestUserId: input.guestUserId,
          folioType: 'guest',
        })
        .onConflictDoNothing()
        .returning({ id: folios.id });
      if (row) return row.id;
    }
    return null;
  }

  /**
   * Bind a pre-arrival folio to the stay at check in (D-k).
   *
   * KEEPS the booking id. §14 asked for "exactly one is set" and for this bind
   * to happen, which cannot both hold; ADR-016 correction 2 relaxes the check
   * to "at least one" and scopes it to a `guest` folio.
   */
  async bindToStay(folioId: string, guestStayId: string): Promise<void> {
    await this.db
      .update(folios)
      .set({ guestStayId, updatedAt: new Date() })
      .where(and(eq(folios.id, folioId), isNull(folios.guestStayId)));
  }

  /**
   * Post one or more lines and make the balance true again, in ONE transaction.
   *
   * The folio row is locked first (`SELECT ... FOR UPDATE`), then every line is
   * inserted, then the balance is recomputed from the sum of the charges
   * (AC-2). Two concurrent charges therefore queue on a single guest's bill
   * rather than each writing a total that omits the other.
   *
   * Every line also writes exactly one `ledger_transactions` row and one
   * `ledger_entries` row against the account its type maps to, carrying the
   * workspace and the same sign as the charge (AC-4). Same transaction, so a
   * charge with no entry behind it is not a state this code can reach.
   */
  async postCharges(input: {
    folioId: string;
    workspaceId: string;
    drafts: ChargeDraft[];
  }): Promise<{ chargeIds: string[]; balanceRwf: number; status: FolioStatus }> {
    return this.db.transaction((tx) => postChargesTx(tx, input));
  }

  /** Refuses a non zero balance at the database, not only in the service. */
  async closeFolio(folioId: string): Promise<boolean> {
    const rows = await this.db
      .update(folios)
      .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(folios.id, folioId), eq(folios.balanceRwf, 0)))
      .returning({ id: folios.id });
    return rows.length > 0;
  }

  // --- Query builders ------------------------------------------------------

  private selectFolios(where: SQL): Promise<FolioRow[]> {
    return this.db
      .select({
        id: folios.id,
        workspaceId: folios.workspaceId,
        propertyId: folios.propertyId,
        folioNumber: folios.folioNumber,
        folioType: folios.folioType,
        status: folios.status,
        guestStayId: folios.guestStayId,
        bookingId: folios.bookingId,
        /*
         * THE ACCOUNT NAME WINS, the stay's own name is the fallback
         * (ADR-035). A WALK IN has no `users` row, so a bill raised
         * against one used to head itself "Unnamed guest" — the person
         * standing at the counter, on the bill they are about to pay.
         * `guest_stays` is already joined here for the room label, so
         * this costs nothing.
         */
        guestName: sql<string | null>`coalesce(${users.name}, ${guestStays.guestName})`,
        roomLabel: rooms.label,
        balanceRwf: folios.balanceRwf,
        openedAt: folios.openedAt,
        closedAt: folios.closedAt,
      })
      .from(folios)
      .leftJoin(users, eq(users.id, folios.guestUserId))
      .leftJoin(guestStays, eq(guestStays.id, folios.guestStayId))
      .leftJoin(rooms, eq(rooms.id, guestStays.roomId))
      .where(where)
      .orderBy(desc(folios.openedAt));
  }

  private selectCharges(where: SQL): Promise<ChargeRow[]> {
    return this.db
      .select({
        id: folioCharges.id,
        folioId: folioCharges.folioId,
        workspaceId: folioCharges.workspaceId,
        chargeType: folioCharges.chargeType,
        description: folioCharges.description,
        departmentId: folioCharges.departmentId,
        departmentName: departments.name,
        quantity: folioCharges.quantity,
        unitPriceRwf: folioCharges.unitPriceRwf,
        amountRwf: folioCharges.amountRwf,
        taxCode: folioCharges.taxCode,
        taxRate: folioCharges.taxRate,
        taxAmountRwf: folioCharges.taxAmountRwf,
        sourceRefType: folioCharges.sourceRefType,
        sourceRefId: folioCharges.sourceRefId,
        postedByUserId: folioCharges.postedByUserId,
        businessDate: folioCharges.businessDate,
        postedAt: folioCharges.postedAt,
      })
      .from(folioCharges)
      .leftJoin(departments, eq(departments.id, folioCharges.departmentId))
      .where(where)
      .orderBy(asc(folioCharges.postedAt));
  }

  /**
   * Every in-house stay that owes tonight's room charge (AC-15).
   *
   * Read by the night audit. The unique index on `(folio_id, business_date)`
   * for room charges is what actually makes "exactly once per night" true; this
   * query only keeps the job from doing obvious repeat work.
   */
  async staysOwedRoomCharge(businessDate: string): Promise<
    {
      folioId: string;
      workspaceId: string;
      propertyId: string;
      bookingId: string | null;
      lockedNightlyRateRwf: number | null;
    }[]
  > {
    return this.db
      .select({
        folioId: folios.id,
        workspaceId: folios.workspaceId,
        propertyId: folios.propertyId,
        bookingId: folios.bookingId,
        lockedNightlyRateRwf: bookings.lockedNightlyRateRwf,
      })
      .from(folios)
      .innerJoin(guestStays, eq(guestStays.id, folios.guestStayId))
      .leftJoin(bookings, eq(bookings.id, folios.bookingId))
      .where(
        and(
          eq(folios.status, 'open'),
          eq(guestStays.lifecycle, 'open'),
          sql`NOT EXISTS (
            SELECT 1 FROM "folio_charges" fc
            WHERE fc."folio_id" = ${folios.id}
              AND fc."charge_type" = 'room'
              AND fc."business_date" = ${businessDate}
          )`,
        ),
      );
  }
}
