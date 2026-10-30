import {
  EBM_VAT_LABEL,
  type ChargeType,
  type FolioStatus,
  type FolioType,
  type PaymentMethod,
  type TaxCode,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';

import {
  bookings,
  configEntries,
  departments,
  ebmInvoiceLines,
  ebmInvoices,
  folioCharges,
  folios,
  guestStays,
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  outlets,
  properties,
  rooms,
  serviceItems,
  serviceOrderItems,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import {
  inBranchScope,
  type BranchScope,
} from '../../../shared/auth/branch-scope';
import { writeOutboxTx } from '../../../shared/outbox/outbox';
import { signPointOf } from '../../platform/fiscal/domain/sign-point';
import { rraPaymentCode } from '../../platform/fiscal/domain/rra-payment-codes';
import {
  insertHeldTx,
  mintReceiptNumberTx,
} from '../../platform/fiscal/infrastructure/ebm-emission.repository';
import {
  emissionKeyFor,
  folioEmissionKeyFor,
} from '../../platform/fiscal/domain/emission-keys';
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
  /** Which bill of the stay this is (ADR-050 D-c). 1 unless a late charge opened it. */
  folioSequence: number;
  /** Set when the bill was signed. A locked folio takes no new charge. */
  lockedAt: Date | null;
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
  /**
   * Whose turnover this line is (ADR-050, cross child contract 1).
   *
   * Leave it UNSET and `postChargesTx` resolves it by the spec's own rule,
   * which is the normal case. Name it only when the caller knows something the
   * folio cannot see: a tenant outlet's passthrough line, which belongs to the
   * tenant while sitting on the host's bill.
   */
  taxEntityOrgId?: string | null;
  /**
   * The fiscal document that ALREADY declared this line, when one has.
   *
   * Set only by a tenant outlet's fulfilment, which signs its own `NS` before
   * writing this line. A charge carrying one is excluded from the host's close,
   * because declaring it again would declare one meal to two taxpayers.
   */
  ebmInvoiceId?: string | null;
  /**
   * The RRA means of payment code. REQUIRED on a `payment` or `deposit` line:
   * §4 k puts it on the receipt and the close refuses a payment line without
   * one, because a receipt that cannot say how it was paid is not a receipt.
   */
  paymentMethodCode?: string | null;
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
 * A line was posted to a bill that has already been signed, by a path that may
 * not move it to the next bill (ADR-050 D-c).
 *
 * A charge and an order reaching `delivered` never see this: they post with
 * `onLocked: 'open_next'` and land on the stay's next folio. What still reaches
 * it is a payment and a void, and both are right to be refused. A payment
 * belongs on the bill that owes it, and voiding a line the Authority already
 * certified is a refund, which is an `NR` and not a reversing line. So is a
 * house or master folio, which has no stay to open a next bill for.
 */
export class FolioLockedError extends ConflictException {
  constructor(readonly folioId: string) {
    super(
      'This bill has already been signed, so no further charge can be added to it.',
    );
    this.name = 'FolioLockedError';
  }
}

/**
 * THE STAY'S BILL THAT CAN STILL TAKE A LINE, opening it when there is none
 * (ADR-050 D-c, value sourcing "Late charge").
 *
 * The highest `folio_sequence` of the stay when it is unlocked, else a new
 * folio at the next sequence, numbered the ORIGINAL's number with `-<sequence>`
 * appended, so `folios_number_uk` still holds and the receipt reads as the same
 * stay's second bill. The number is random base32 and never contains a dash, so
 * stripping a suffix always recovers the original.
 *
 * Two late charges racing on one stay both compute the same next sequence. The
 * second insert meets `folios_stay_sequence_uk`, does nothing, and the loop
 * reads the row the first one wrote, so both land on one new bill rather than
 * one of them failing.
 */
async function nextOpenFolioForStayTx(
  tx: Tx,
  from: {
    guestStayId: string;
    workspaceId: string;
    propertyId: string;
    bookingId: string | null;
    guestUserId: string | null;
    folioNumber: string;
  },
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const bills = await tx
      .select({
        id: folios.id,
        folioNumber: folios.folioNumber,
        folioSequence: folios.folioSequence,
        lockedAt: folios.lockedAt,
        status: folios.status,
      })
      .from(folios)
      .where(eq(folios.guestStayId, from.guestStayId))
      .orderBy(desc(folios.folioSequence));

    const latest = bills[0];
    if (latest && !latest.lockedAt && latest.status !== 'closed') return latest.id;

    const sequence = (latest?.folioSequence ?? 1) + 1;
    const original = (bills.at(-1)?.folioNumber ?? from.folioNumber).replace(/-\d+$/, '');
    const [row] = await tx
      .insert(folios)
      .values({
        folioNumber: `${original}-${sequence}`,
        folioSequence: sequence,
        workspaceId: from.workspaceId,
        propertyId: from.propertyId,
        guestStayId: from.guestStayId,
        bookingId: from.bookingId,
        guestUserId: from.guestUserId,
        folioType: 'guest',
      })
      .onConflictDoNothing()
      .returning({ id: folios.id });
    if (row) return row.id;
  }
  throw new ConflictException(
    'This stay’s bill changed while the charge was being posted. Try again.',
  );
}

/**
 * WHOSE TURNOVER THIS LINE IS (ADR-050, cross child contract 1).
 *
 * One function, called from one place, so no writer of a charge can forget to
 * answer the question and no second rule can grow beside this one. The spec's
 * order, exactly:
 *
 * 1. What the caller named, when it knows something the folio cannot see (a
 *    tenant outlet's passthrough line).
 * 2. The line's outlet, which is THE answer for a revenue line.
 * 3. The line this one derives from, for a non revenue line: a tax, discount,
 *    adjustment, payment, deposit or refund naming a `source_ref_id`. This is
 *    what keeps a discount against a tenant's meal on the tenant's side of the
 *    ledger rather than quietly reducing the host's declared turnover.
 * 4. The folio's property's org, which is every remaining line.
 */
async function resolveTaxEntityTx(
  tx: Tx,
  draft: ChargeDraft,
  folioOrgId: string,
): Promise<string> {
  if (draft.taxEntityOrgId) return draft.taxEntityOrgId;

  if (draft.outletId) {
    const [outlet] = await tx
      .select({ orgId: outlets.taxEntityOrgId })
      .from(outlets)
      .where(eq(outlets.id, draft.outletId));
    if (outlet) return outlet.orgId;
  }

  if (draft.sourceRefId && !isRevenueLine(draft.chargeType)) {
    const [parent] = await tx
      .select({ orgId: folioCharges.taxEntityOrgId })
      .from(folioCharges)
      .where(eq(folioCharges.id, draft.sourceRefId));
    if (parent) return parent.orgId;
  }

  return folioOrgId;
}

/** The reason a declaration is born refused when the business never connected (D-b). */
export const NO_CONNECTION = 'no_connection';

/**
 * What the close is told about the business's fiscal setup. Resolved by the
 * service, because it depends on the platform and the adapter mode, which a
 * repository must not know about.
 */
export interface CloseDeclarationPlan {
  /**
   * Null in the demo environment: the bill locks and nothing is declared,
   * because a demo business is fictional (ADR-041 D-p).
   */
  declare: null | {
    adapterMode: 'mock' | 'live';
    /** The folio's org holds a connected EBM account. */
    connected: boolean;
    tin: string | null;
    rraBranchId: string;
  };
  customerTin: string | null;
  customerName: string | null;
}

export type CloseOutcome =
  | { kind: 'balance_owed'; balanceRwf: number }
  | { kind: 'foreign_undeclared'; chargeIds: string[] }
  | { kind: 'payment_without_code'; chargeIds: string[] }
  | {
      kind: 'closed';
      replayed: boolean;
      lockedAt: Date | null;
      emissionId: string | null;
      status: 'held' | 'failed' | 'emitted' | null;
      reason: string | null;
      excludedChargeIds: string[];
      /** A held row this close created, which the worker should be woken for. */
      wake: boolean;
    };

/** The lines that describe something sold. Tax is inside them; money is not a sale. */
const RECEIPT_LINE_TYPES: ReadonlySet<ChargeType> = new Set<ChargeType>([
  'room',
  'service_order',
  'pos',
  'service_charge',
  'adjustment',
  'discount',
]);

/** The lines §4 k needs a means of payment for. */
const PAYMENT_LINE_TYPES: ReadonlySet<ChargeType> = new Set<ChargeType>([
  'payment',
  'deposit',
]);

/**
 * The tax code a receipt line is declared under.
 *
 * The charge's own, when it has one. A ROOM charge from the night audit carries
 * none, because the folio posts no VAT line for accommodation; ADR-041 declares
 * accommodation under `EBM_VAT_LABEL` with the locked rate tax INCLUSIVE, so a
 * room line takes that label and its amount is read as inclusive. Any other
 * line without one inherits from the line it derives from. A line that still
 * has none is left off the receipt rather than given a rate nobody chose.
 */
function receiptTaxCode(
  charge: { chargeType: ChargeType; taxCode: TaxCode | null; sourceRefId: string | null },
  all: ReadonlyArray<{ id: string; taxCode: TaxCode | null }>,
): TaxCode | null {
  if (charge.taxCode) return charge.taxCode;
  if (charge.chargeType === 'room') return `TAX_${EBM_VAT_LABEL}` as TaxCode;
  if (charge.sourceRefId) {
    return all.find((c) => c.id === charge.sourceRefId)?.taxCode ?? null;
  }
  return null;
}

/**
 * The six line types that earn. The other four (tax, discount, payment,
 * deposit, refund, adjustment) derive from a line rather than from a sale, and
 * so inherit rather than declare.
 */
function isRevenueLine(type: ChargeType): boolean {
  return (
    type === 'room' ||
    type === 'service_order' ||
    type === 'pos' ||
    type === 'service_charge'
  );
}

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
 *
 * `folioId` in the answer is the bill the lines actually landed on, which is
 * not the one asked for when that one was signed and `onLocked` said to open
 * the next.
 */
export async function postChargesTx(
  tx: Tx,
  input: {
    folioId: string;
    workspaceId: string;
    drafts: ChargeDraft[];
    /**
     * What a signed bill does with these lines (ADR-050 D-c). `refuse`, the
     * default, throws `FolioLockedError`; `open_next` posts them to the stay's
     * next folio instead. Only a charge may move: see `FolioLockedError`.
     */
    onLocked?: 'refuse' | 'open_next';
  },
): Promise<{
  folioId: string;
  /** Set when the asked for bill was signed and the lines went to the next one. */
  movedToFolioId: string | null;
  chargeIds: string[];
  balanceRwf: number;
  status: FolioStatus;
}> {
    const [locked] = await tx
      .select({
        id: folios.id,
        status: folios.status,
        lockedAt: folios.lockedAt,
        workspaceId: folios.workspaceId,
        propertyId: folios.propertyId,
        guestStayId: folios.guestStayId,
        bookingId: folios.bookingId,
        guestUserId: folios.guestUserId,
        folioNumber: folios.folioNumber,
      })
      .from(folios)
      .where(eq(folios.id, input.folioId))
      .for('update');
    if (!locked) throw new Error('Folio vanished under the lock.');

    /**
     * ADR-050 D-c. Signing LOCKS the bill, and §7.17 allows an original to be
     * cancelled only once, so a line arriving afterwards must not be quietly
     * added to a document the Authority has already certified, nor spend that
     * one cancellation on a minibar read. It opens the stay's next folio, which
     * settles and signs its own `NS` when it is closed.
     */
    if (locked.lockedAt) {
      if (input.onLocked !== 'open_next' || !locked.guestStayId) {
        throw new FolioLockedError(input.folioId);
      }
      const nextId = await nextOpenFolioForStayTx(tx, {
        guestStayId: locked.guestStayId,
        workspaceId: locked.workspaceId,
        propertyId: locked.propertyId,
        bookingId: locked.bookingId,
        guestUserId: locked.guestUserId,
        folioNumber: locked.folioNumber,
      });
      // The next folio is unlocked by construction, so this cannot recurse
      // again; `refuse` makes sure of it if a close raced in between.
      const posted = await postChargesTx(tx, {
        folioId: nextId,
        workspaceId: input.workspaceId,
        drafts: input.drafts,
      });
      return { ...posted, movedToFolioId: posted.folioId };
    }

    /**
     * The folio's own taxpayer: the fallback every line falls back to. Read
     * once per transaction rather than per line.
     */
    const [host] = await tx
      .select({ orgId: properties.orgId })
      .from(properties)
      .where(eq(properties.id, locked.propertyId));
    if (!host) throw new Error('Folio names a property that does not exist.');

    const chargeIds: string[] = [];
    for (const draft of input.drafts) {
      const taxEntityOrgId = await resolveTaxEntityTx(tx, draft, host.orgId);
      const [charge] = await tx
        .insert(folioCharges)
        .values({
          folioId: input.folioId,
          workspaceId: input.workspaceId,
          departmentId: draft.departmentId,
          outletId: draft.outletId ?? null,
          taxEntityOrgId,
          ebmInvoiceId: draft.ebmInvoiceId ?? null,
          // Derived here rather than at each call site, so a payment line
          // cannot reach the table without the code §4 k puts on the receipt.
          paymentMethodCode:
            draft.paymentMethodCode ??
            (draft.method ? rraPaymentCode(draft.method) : null),
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

    // ADR-050 D-v: the open bill screen re-reads when this lands. Keyed on the
    // first charge this transaction wrote, so every real change is one row.
    if (chargeIds[0]) {
      await writeOutboxTx(tx, {
        eventType: 'folio.balance',
        aggregateType: 'folio',
        aggregateId: input.folioId,
        change: chargeIds[0],
        workspaceId: input.workspaceId,
        payload: {
          folioId: input.folioId,
          propertyId: locked.propertyId,
          userId: locked.guestUserId,
          status,
        },
      });
    }

    return { folioId: input.folioId, movedToFolioId: null, chargeIds, balanceRwf, status };
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

  async listFolios(workspaceId: string, scope: BranchScope): Promise<FolioRow[]> {
    return this.selectFolios(
      and(eq(folios.workspaceId, workspaceId), inBranchScope(folios.propertyId, scope)) as SQL,
    );
  }

  /** The taxpayer a property sells under: whose EBM account signs its bills. */
  async orgOfProperty(propertyId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ orgId: properties.orgId })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    return row?.orgId ?? null;
  }

  async findFolio(id: string): Promise<FolioRow | null> {
    const [row] = await this.selectFolios(eq(folios.id, id));
    return row ?? null;
  }

  async findFolioForBooking(bookingId: string): Promise<FolioRow | null> {
    const [row] = await this.selectFolios(eq(folios.bookingId, bookingId));
    return row ?? null;
  }

  /**
   * The stay's CURRENT bill: its highest `folio_sequence` (ADR-050 D-c).
   *
   * A stay has more than one folio once a late charge arrives after signing,
   * and the one a desk settles, and check out closes, is always the latest.
   */
  async findFolioForStay(stayId: string): Promise<FolioRow | null> {
    const rows = await this.selectFolios(eq(folios.guestStayId, stayId));
    return rows.sort((a, b) => b.folioSequence - a.folioSequence)[0] ?? null;
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
    onLocked?: 'refuse' | 'open_next';
  }): Promise<Awaited<ReturnType<typeof postChargesTx>>> {
    return this.db.transaction((tx) => postChargesTx(tx, input));
  }

  /**
   * CLOSE A BILL AND DECLARE ITS SALE, in ONE transaction (ADR-050 D-a, D-c).
   *
   * The order is the spec's and is not rearrangeable:
   *
   * 1. Lock the folio row. A close that finds it already locked is a replay and
   *    answers with what the first close raised.
   * 2. Refuse a balance still owed (`folios_closed_is_zero` refuses it again).
   * 3. Refuse a charge belonging to ANOTHER taxpayer that nobody has declared.
   *    Signing it here would declare a tenant's meal under the host's TIN.
   * 4. Refuse a payment or deposit line with no RRA means of payment code: a
   *    receipt that cannot say how it was paid is not a receipt.
   * 5. Raise ONE `NS` over the host's own undeclared lines, write its lines,
   *    and stamp those charges with it, so they can never be covered twice.
   * 6. Lock the folio, and write the `ebm.sale` outbox row.
   * 7. LAST, mint the receipt number (AC-9), so the counter row is held for
   *    one statement rather than for the whole close.
   *
   * A missing EBM connection is NOT a refusal: the row is written `failed`
   * with reason `no_connection` and the close succeeds (D-b). A 409 there would
   * strand every front desk the moment the flag flips.
   */
  async closeAndDeclare(
    folioId: string,
    plan: CloseDeclarationPlan,
  ): Promise<CloseOutcome> {
    return this.db.transaction(async (tx): Promise<CloseOutcome> => {
      const [folio] = await tx
        .select({
          id: folios.id,
          workspaceId: folios.workspaceId,
          propertyId: folios.propertyId,
          bookingId: folios.bookingId,
          guestUserId: folios.guestUserId,
          status: folios.status,
          lockedAt: folios.lockedAt,
          balanceRwf: folios.balanceRwf,
        })
        .from(folios)
        .where(eq(folios.id, folioId))
        .for('update');
      if (!folio) throw new Error('Folio vanished under the lock.');

      // 1. A replay. `status = closed` with no lock is a bill closed before
      // ADR-050, which declared nothing and must not start declaring now.
      if (folio.lockedAt || folio.status === 'closed') {
        const [existing] = await tx
          .select({
            id: ebmInvoices.id,
            status: ebmInvoices.status,
            lastError: ebmInvoices.lastError,
          })
          .from(ebmInvoices)
          .where(eq(ebmInvoices.idempotencyKey, folioEmissionKeyFor(folio.id)))
          .limit(1);
        return {
          kind: 'closed',
          replayed: true,
          lockedAt: folio.lockedAt,
          emissionId: existing?.id ?? null,
          status: existing?.status ?? null,
          reason: existing?.lastError ?? null,
          excludedChargeIds: [],
          wake: false,
        };
      }

      // 2.
      if (folio.balanceRwf !== 0) {
        return { kind: 'balance_owed', balanceRwf: folio.balanceRwf };
      }

      const [host] = await tx
        .select({ orgId: properties.orgId })
        .from(properties)
        .where(eq(properties.id, folio.propertyId));
      if (!host) throw new Error('Folio names a property that does not exist.');

      const charges = await tx
        .select({
          id: folioCharges.id,
          chargeType: folioCharges.chargeType,
          description: folioCharges.description,
          quantity: folioCharges.quantity,
          amountRwf: folioCharges.amountRwf,
          taxAmountRwf: folioCharges.taxAmountRwf,
          taxCode: folioCharges.taxCode,
          taxRate: folioCharges.taxRate,
          sourceRefType: folioCharges.sourceRefType,
          sourceRefId: folioCharges.sourceRefId,
          taxEntityOrgId: folioCharges.taxEntityOrgId,
          ebmInvoiceId: folioCharges.ebmInvoiceId,
          paymentMethodCode: folioCharges.paymentMethodCode,
        })
        .from(folioCharges)
        .where(eq(folioCharges.folioId, folio.id))
        .orderBy(asc(folioCharges.postedAt));

      // A voided line and its reversal net to nothing and describe no sale.
      const reversed = new Set(
        charges
          .filter((c) => c.sourceRefType === 'void' && c.sourceRefId)
          .map((c) => c.sourceRefId!),
      );
      const standing = charges.filter(
        (c) => c.sourceRefType !== 'void' && !reversed.has(c.id),
      );

      // 3.
      const foreign = standing
        .filter((c) => c.taxEntityOrgId !== host.orgId && !c.ebmInvoiceId)
        .map((c) => c.id);
      if (foreign.length > 0) {
        return { kind: 'foreign_undeclared', chargeIds: foreign };
      }

      // 4.
      const uncoded = standing
        .filter((c) => PAYMENT_LINE_TYPES.has(c.chargeType) && !c.paymentMethodCode)
        .map((c) => c.id);
      if (uncoded.length > 0) {
        return { kind: 'payment_without_code', chargeIds: uncoded };
      }

      /**
       * THE STRADDLING CASE (fiscal child, Migration plan, Risks). A booking
       * stamped `booking` had its room signed as an `NS` at confirmation, so its
       * room lines, and the tax raised from them, belong to THAT document and
       * are excluded here. Read from the stamp rather than from whether that
       * `NS` has emitted yet: a booking sale still queued would otherwise be
       * declared twice, once here and once when its own row sends.
       */
      const ownedByBooking = new Set<string>();
      let bookingSaleId: string | null = null;
      if (folio.bookingId) {
        const [booking] = await tx
          .select({ stamp: bookings.ebmSignAt })
          .from(bookings)
          .where(eq(bookings.id, folio.bookingId));
        if (signPointOf(booking?.stamp) === 'booking') {
          for (const c of standing) {
            if (c.chargeType === 'room' && !c.ebmInvoiceId) ownedByBooking.add(c.id);
          }
          for (const c of standing) {
            if (c.chargeType === 'tax' && c.sourceRefId && ownedByBooking.has(c.sourceRefId)) {
              ownedByBooking.add(c.id);
            }
          }
          const [sale] = await tx
            .select({ id: ebmInvoices.id })
            .from(ebmInvoices)
            .where(eq(ebmInvoices.idempotencyKey, emissionKeyFor(folio.bookingId, 'NS')))
            .limit(1);
          bookingSaleId = sale?.id ?? null;
        }
      }

      const alreadyDeclared = standing.filter((c) => c.ebmInvoiceId).map((c) => c.id);
      const covered = standing.filter(
        (c) =>
          c.taxEntityOrgId === host.orgId &&
          !c.ebmInvoiceId &&
          !ownedByBooking.has(c.id),
      );

      const lockedAt = new Date();
      let emissionId: string | null = null;
      let status: 'held' | 'failed' | null = null;
      let reason: string | null = null;
      let created = false;

      // 5. Null `declare` is the demo environment: nothing is ever declared.
      if (plan.declare) {
        const connected = plan.declare.connected;
        status = connected ? 'held' : 'failed';
        reason = connected ? null : NO_CONNECTION;
        const row = await insertHeldTx(tx, {
          source: 'folio',
          folioId: folio.id,
          orgId: host.orgId,
          tin: plan.declare.tin,
          receiptType: 'normal',
          rraBranchId: plan.declare.rraBranchId,
          adapterMode: plan.declare.adapterMode,
          customerTin: plan.customerTin,
          customerName: plan.customerName,
          idempotencyKey: folioEmissionKeyFor(folio.id),
          status,
          lastError: reason,
          // A row with no connection waits for a person, not for a timer.
          dueAt: connected ? lockedAt : null,
        });
        emissionId = row.id;
        created = row.created;

        if (created) {
          /**
           * An order's bill line is ONE charge for the whole order, with its tax
           * on a separate line and no tax code of its own, so it cannot describe
           * what was sold. Its `service_order_items` snapshots can, and they are
           * the spec's named source for an order line: one receipt line per item
           * ordered, priced as it was locked at order time.
           */
          const orderIds = covered
            .filter((c) => c.chargeType === 'service_order' && c.sourceRefType === 'service_order' && c.sourceRefId)
            .map((c) => c.sourceRefId!);
          const orderItems = orderIds.length
            ? await tx
                .select({
                  id: serviceOrderItems.id,
                  serviceOrderId: serviceOrderItems.serviceOrderId,
                  nameSnapshot: serviceOrderItems.nameSnapshot,
                  quantity: serviceOrderItems.quantity,
                  lineTotalRwf: serviceOrderItems.lineTotalRwf,
                  taxCode: serviceOrderItems.taxCode,
                  taxRate: serviceOrderItems.taxRate,
                  // The item's RRA codes, read at sign time (ADR-050 D-m, value
                  // sourcing "line item codes").
                  rraItemClsCd: serviceItems.rraItemClsCd,
                  rraItemCd: serviceItems.rraItemCd,
                  rraPkgUnitCd: serviceItems.rraPkgUnitCd,
                  rraQtyUnitCd: serviceItems.rraQtyUnitCd,
                })
                .from(serviceOrderItems)
                .leftJoin(serviceItems, eq(serviceItems.id, serviceOrderItems.serviceItemId))
                .where(inArray(serviceOrderItems.serviceOrderId, orderIds))
            : [];

          const lines = covered
            .filter((c) => RECEIPT_LINE_TYPES.has(c.chargeType))
            .flatMap((c): Array<typeof ebmInvoiceLines.$inferInsert> => {
              const items =
                c.chargeType === 'service_order' && c.sourceRefId
                  ? orderItems.filter((i) => i.serviceOrderId === c.sourceRefId && i.taxCode)
                  : [];
              if (items.length > 0) {
                return items.map((i) => {
                  // The same per line rounding the order priced its tax with,
                  // so the receipt adds up to the bill.
                  const total =
                    i.lineTotalRwf + Math.round(i.lineTotalRwf * Number(i.taxRate ?? 0));
                  const quantity = Math.max(i.quantity, 1);
                  return {
                    ebmInvoiceId: row.id,
                    folioChargeId: c.id,
                    serviceOrderItemId: i.id,
                    description: i.nameSnapshot,
                    quantity,
                    unitPriceRwf: Math.round(total / quantity),
                    taxCode: i.taxCode!,
                    taxRate: i.taxRate,
                    lineTotalRwf: total,
                    taxTypeCode: i.taxCode,
                    rraItemClsCd: i.rraItemClsCd,
                    rraItemCd: i.rraItemCd,
                    rraPkgUnitCd: i.rraPkgUnitCd,
                    rraQtyUnitCd: i.rraQtyUnitCd,
                  };
                });
              }
              const taxCode = receiptTaxCode(c, standing);
              if (!taxCode) return [];
              // Tax EXCLUSIVE on the folio, INCLUSIVE on the receipt: the
              // VSDC's `prc` includes it, and `tax` lines are left out because
              // they are already inside every other line.
              const total = c.amountRwf + (c.taxAmountRwf ?? 0);
              const quantity = Math.max(c.quantity, 1);
              return [
                {
                  ebmInvoiceId: row.id,
                  folioChargeId: c.id,
                  serviceOrderItemId: null,
                  description: c.description,
                  quantity,
                  unitPriceRwf: Math.round(total / quantity),
                  taxCode,
                  taxRate: c.taxRate,
                  lineTotalRwf: total,
                  taxTypeCode: taxCode,
                },
              ];
            });
          if (lines.length > 0) await tx.insert(ebmInvoiceLines).values(lines);

          // The one update `folio_charges` allows: naming the document that
          // declared a line. Set once, never cleared (D-a).
          if (covered.length > 0) {
            await tx
              .update(folioCharges)
              .set({ ebmInvoiceId: row.id })
              .where(
                and(
                  inArray(folioCharges.id, covered.map((c) => c.id)),
                  isNull(folioCharges.ebmInvoiceId),
                ),
              );
          }
        }
      }

      if (bookingSaleId && ownedByBooking.size > 0) {
        await tx
          .update(folioCharges)
          .set({ ebmInvoiceId: bookingSaleId })
          .where(
            and(
              inArray(folioCharges.id, [...ownedByBooking]),
              isNull(folioCharges.ebmInvoiceId),
            ),
          );
      }

      // 6.
      await tx
        .update(folios)
        .set({
          status: 'closed',
          closedAt: lockedAt,
          lockedAt,
          customerTin: plan.customerTin,
          customerName: plan.customerName,
          updatedAt: lockedAt,
        })
        .where(and(eq(folios.id, folio.id), eq(folios.balanceRwf, 0)));

      if (emissionId && created && status) {
        await writeOutboxTx(tx, {
          eventType: 'ebm.sale',
          aggregateType: 'ebm_invoice',
          aggregateId: emissionId,
          change: status,
          workspaceId: folio.workspaceId,
          payload: {
            emissionId,
            folioId: folio.id,
            propertyId: folio.propertyId,
            userId: folio.guestUserId,
            status,
          },
        });
      }

      // 7. The last statement before commit.
      if (emissionId && created && plan.declare) {
        const number = await mintReceiptNumberTx(tx, {
          orgId: host.orgId,
          rraBranchId: plan.declare.rraBranchId,
          receiptLabel: 'NS',
        });
        await tx
          .update(ebmInvoices)
          .set({ cisReceiptNo: number })
          .where(eq(ebmInvoices.id, emissionId));
      }

      return {
        kind: 'closed',
        replayed: false,
        lockedAt,
        emissionId,
        status,
        reason,
        excludedChargeIds: [...new Set([...alreadyDeclared, ...ownedByBooking])],
        wake: created && status === 'held',
      };
    });
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
        folioSequence: folios.folioSequence,
        lockedAt: folios.lockedAt,
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
        /*
         * THE STAY'S OWN PRICE FIRST, the booking's locked rate second.
         *
         * This read only ever joined the booking, and a WALK IN has none, so
         * every walk in came back with no rate, the audit skipped it with a
         * warning, and its bill stayed at zero. Check out then closed that zero
         * bill on its own (ADR-050), so the guest left without the room ever
         * being charged. `guest_stays.price_rwf` is where both check ins write
         * the nightly figure: a walk in's agreed rate, and for a reservation the
         * locked rate or the counter override of it, which this also stops
         * ignoring.
         */
        lockedNightlyRateRwf: sql<number | null>`coalesce(${guestStays.priceRwf}, ${bookings.lockedNightlyRateRwf})`.mapWith(Number),
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
