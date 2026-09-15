import type {
  CloseFolioRequest,
  CloseFolioResult,
  OperatorFolio,
  OperatorFolioCharge,
  OperatorFolioDetail,
  PostChargeRequest,
  PostChargeResult,
  TakePaymentRequest,
  TaxCode,
  VoidChargeRequest,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import { EbmSaleTrigger } from '../../ebm/application/ebm-sale-trigger.service';
import { DeclarationPlanService } from './declaration-plan.service';
import {
  type ChargeDraft,
  type ChargeRow,
  type CloseDeclarationPlan,
  type FolioRow,
  FolioRepository,
} from '../infrastructure/folio.repository';
import { accountCodeFor, isRevenueChargeType } from '../infrastructure/ledger-posting';

/** The standard rate. Used when a manual charge names no tax code. */
const DEFAULT_TAX_CODE: TaxCode = 'TAX_B';

/**
 * The guest's running bill (ADR-016 slice 3, D13).
 *
 * This is what unblocks `folio.charge` and `folio.payment`, the two money
 * commands ADR-012 had to leave unbuilt. Four rules shape every method here and
 * none of them are negotiable, because this is the document a Rwandan tax
 * invoice is cut from:
 *
 * 1. **Append only.** A posted charge is never mutated or deleted (AC-3).
 * 2. **The balance is the sum of the lines**, recomputed under a row lock in
 *    the same transaction as the insert (AC-2).
 * 3. **Tax is its own line**, snapshotted from `config_entries` at post time
 *    (AC-5, D-n). `amountRwf` on a charge is TAX EXCLUSIVE.
 * 4. **Revenue posts once, at post time** (D-f). Taking a payment posts cash
 *    and never revenue, or every shilling would be counted twice.
 */
@Injectable()
export class FolioService {
  constructor(
    private readonly folios: FolioRepository,
    private readonly sales: EbmSaleTrigger,
    private readonly plans: DeclarationPlanService,
  ) {}

  /**
   * Open the pre-arrival folio for a booking that has just been confirmed
   * (D-k).
   *
   * The SYSTEM opens folios, never an operator: a bill with no subject is not a
   * thing anyone should be able to make. It is opened here, at confirmation,
   * rather than at check in, so a charge taken before the guest arrives (a
   * deposit, an airport pickup) has somewhere to go.
   *
   * Safe to call twice: it returns the existing folio rather than opening a
   * second bill for one booking.
   */
  async openForBooking(input: {
    bookingId: string;
    workspaceId: string;
    propertyId: string;
    guestUserId: string | null;
  }): Promise<string | null> {
    return this.folios.openForBooking(input);
  }

  /** The same, for a walk in, which has no booking (ADR-035). */
  async openForStay(input: {
    guestStayId: string;
    workspaceId: string;
    propertyId: string;
    guestUserId: string | null;
  }): Promise<string | null> {
    return this.folios.openForStay(input);
  }

  /** The Bills list. */
  async list(ws: ScopedWorkspace): Promise<OperatorFolio[]> {
    const rows = await this.folios.listFolios(ws.workspaceId, ws.branchScope);
    return rows.map((row) => this.presentFolio(row));
  }

  /** The bill, with its lines. */
  async detail(ws: ScopedWorkspace, id: string): Promise<OperatorFolioDetail> {
    const folio = this.ownFolio(ws, await this.folios.findFolio(id));
    const charges = await this.folios.listCharges(folio.id);
    const reversedIds = new Map<string, string>();
    for (const c of charges) {
      if (c.sourceRefType === 'void' && c.sourceRefId) {
        reversedIds.set(c.sourceRefId, c.id);
      }
    }
    return {
      ...this.presentFolio(folio),
      charges: charges.map((c) => this.presentCharge(c, reversedIds)),
    };
  }

  /**
   * Post a charge (AC-1 to AC-5, AC-12).
   *
   * The order matters. The replay check runs FIRST, before anything is read or
   * validated, so a retry of a command that already succeeded answers with the
   * original result rather than re-running the validation that might now fail
   * for an unrelated reason.
   */
  async postCharge(
    ws: ScopedWorkspace,
    folioId: string,
    body: PostChargeRequest,
    userId: string,
    clientKey: string,
  ): Promise<PostChargeResult> {
    const key = this.scopedKey(ws, clientKey);
    const replay = await this.folios.findChargeByIdempotencyKey(key);
    if (replay) {
      // A late charge that already moved to the stay's next bill is still the
      // same command: compare it against the bill it actually landed on.
      const asked = this.ownFolio(ws, await this.folios.findFolio(folioId));
      const landed = await this.folios.findFolio(replay.folioId);
      const sameStay =
        replay.folioId !== folioId &&
        asked.guestStayId !== null &&
        landed?.guestStayId === asked.guestStayId;
      this.assertSameCommand(replay, {
        folioId: sameStay ? replay.folioId : folioId,
        chargeType: body.chargeType,
        amountRwf: body.amountRwf,
      });
      return {
        ...(await this.detail(ws, replay.folioId)),
        openedFolioId: sameStay ? replay.folioId : null,
      };
    }

    const folio = this.lateChargeTarget(
      this.ownFolio(ws, await this.folios.findFolio(folioId)),
    );

    const departmentId = await this.resolveDepartment(ws, body, folio);
    const departmentCategory = departmentId
      ? (await this.folios.findDepartment(departmentId))?.departmentCategory
      : null;

    const accountCode = accountCodeFor({
      chargeType: body.chargeType,
      departmentCategory,
    });
    if (!accountCode) {
      throw new UnprocessableEntityException(
        `A ${body.chargeType} charge has no account to post to. Check the department's category.`,
      );
    }

    const { taxCode, taxRate } = await this.resolveTax(body.taxCode);
    const taxAmountRwf = Math.round(body.amountRwf * taxRate);

    const drafts: ChargeDraft[] = [
      {
        chargeType: body.chargeType,
        description: body.description,
        departmentId,
        outletId: body.outletId ?? null,
        quantity: body.quantity,
        unitPriceRwf: Math.round(body.amountRwf / Math.max(body.quantity, 1)),
        amountRwf: body.amountRwf,
        taxCode,
        taxRate: String(taxRate),
        taxAmountRwf,
        sourceRefType: 'manual',
        sourceRefId: null,
        postedByUserId: userId,
        businessDate: null,
        idempotencyKey: key,
        accountCode,
      },
    ];

    // A signed bill sends the charge to the stay's next one (ADR-050 D-c).
    const posted = await this.folios.postCharges({
      folioId: folio.id,
      workspaceId: ws.workspaceId,
      drafts,
      onLocked: 'open_next',
    });

    // The tax line is posted as its own charge, in its own transaction, so it
    // carries its own ledger entry against TAX_PAYABLE (AC-4) and can be
    // reversed with its parent. Zero rated codes raise no line at all rather
    // than a line worth nothing. It follows its parent onto whichever bill the
    // parent landed on.
    if (taxAmountRwf !== 0) {
      const parentId = (
        await this.folios.findChargeByIdempotencyKey(key)
      )?.id ?? null;
      await this.folios.postCharges({
        folioId: posted.folioId,
        workspaceId: ws.workspaceId,
        onLocked: 'open_next',
        drafts: [
          {
            chargeType: 'tax',
            description: `${taxCode} on ${body.description}`,
            departmentId: null,
            quantity: 1,
            unitPriceRwf: taxAmountRwf,
            amountRwf: taxAmountRwf,
            taxCode,
            taxRate: String(taxRate),
            taxAmountRwf: null,
            sourceRefType: 'tax',
            sourceRefId: parentId,
            postedByUserId: userId,
            businessDate: null,
            idempotencyKey: `${key}:tax`,
            accountCode: 'TAX_PAYABLE',
          },
        ],
      });
    }

    return {
      ...(await this.detail(ws, posted.folioId)),
      openedFolioId: posted.movedToFolioId,
    };
  }

  /**
   * Take a payment (AC-12).
   *
   * Posts a NEGATIVE `payment` line and one cash ledger entry, chosen by the
   * method on the request. It never posts revenue: the charges already did that
   * when they posted (D-f).
   */
  async takePayment(
    ws: ScopedWorkspace,
    folioId: string,
    body: TakePaymentRequest,
    userId: string,
    clientKey: string,
  ): Promise<OperatorFolioDetail> {
    const key = this.scopedKey(ws, clientKey);
    const replay = await this.folios.findChargeByIdempotencyKey(key);
    if (replay) {
      this.assertSameCommand(replay, {
        folioId,
        chargeType: 'payment',
        amountRwf: -body.amountRwf,
      });
      return this.detail(ws, replay.folioId);
    }

    const folio = this.openFolio(this.ownFolio(ws, await this.folios.findFolio(folioId)));

    const accountCode = accountCodeFor({
      chargeType: 'payment',
      method: body.method,
    });
    if (!accountCode) {
      throw new UnprocessableEntityException(
        'That payment method has no cash account to post to.',
      );
    }

    await this.folios.postCharges({
      folioId: folio.id,
      workspaceId: ws.workspaceId,
      drafts: [
        {
          chargeType: 'payment',
          description: body.reference
            ? `Payment (${body.method}) ${body.reference}`
            : `Payment (${body.method})`,
          departmentId: null,
          quantity: 1,
          unitPriceRwf: -body.amountRwf,
          // Negative, because the sign convention is fixed: charges positive,
          // payments and discounts negative, and the ledger entry inherits it.
          amountRwf: -body.amountRwf,
          taxCode: null,
          taxRate: null,
          taxAmountRwf: null,
          sourceRefType: 'manual',
          sourceRefId: null,
          postedByUserId: userId,
          businessDate: null,
          idempotencyKey: key,
          accountCode,
          method: body.method,
        },
      ],
    });

    return this.detail(ws, folio.id);
  }

  /**
   * Void a charge (AC-3).
   *
   * Posts a reversing line naming the original through `source_ref_id`. The
   * original row is not touched, so a bill shows the mistake AND the
   * correction. A charge can be voided at most once and a void can never itself
   * be voided, both checked here because neither is a shape a constraint can
   * express.
   *
   * A tax line goes with its parent rather than being voided on its own: they
   * were one act, and reversing half of one leaves a bill nobody can explain.
   */
  async voidCharge(
    ws: ScopedWorkspace,
    folioId: string,
    chargeId: string,
    body: VoidChargeRequest,
    userId: string,
    clientKey: string,
  ): Promise<OperatorFolioDetail> {
    const key = this.scopedKey(ws, clientKey);
    const replay = await this.folios.findChargeByIdempotencyKey(key);
    if (replay) {
      this.assertSameCommand(replay, {
        folioId,
        chargeType: replay.chargeType,
        amountRwf: replay.amountRwf,
      });
      return this.detail(ws, replay.folioId);
    }

    const folio = this.ownFolio(ws, await this.folios.findFolio(folioId));
    if (folio.status === 'closed') {
      throw new ConflictException(
        'This bill is closed. Reopen it before voiding anything on it.',
      );
    }

    const charge = assertOwned(await this.folios.findCharge(chargeId), ws);
    if (charge.folioId !== folio.id) {
      throw new ConflictException('That charge is not on this bill.');
    }
    if (charge.sourceRefType === 'void') {
      throw new ConflictException(
        'That line is already a correction. A void cannot itself be voided.',
      );
    }
    if (charge.chargeType === 'tax') {
      throw new ConflictException(
        'Void the charge this tax belongs to. The tax line goes with it.',
      );
    }
    if (await this.folios.findReversalOf(charge.id)) {
      throw new ConflictException('That charge has already been voided.');
    }

    const accountCode = accountCodeFor({
      chargeType: charge.chargeType,
      departmentCategory: charge.departmentId
        ? ((await this.folios.findDepartment(charge.departmentId))
            ?.departmentCategory ?? null)
        : null,
      method: this.methodFromDescription(charge.description),
    });
    if (!accountCode) {
      throw new UnprocessableEntityException(
        'That charge cannot be reversed: its account could not be resolved.',
      );
    }

    const drafts: ChargeDraft[] = [
      {
        chargeType: charge.chargeType,
        description: `Void: ${charge.description ?? charge.chargeType} (${body.reason})`,
        departmentId: charge.departmentId,
        quantity: 1,
        unitPriceRwf: -charge.amountRwf,
        // Read from the row being voided rather than from the request, so a
        // reversal can never be for a different amount than the thing it
        // reverses.
        amountRwf: -charge.amountRwf,
        taxCode: charge.taxCode,
        taxRate: charge.taxRate,
        taxAmountRwf: null,
        sourceRefType: 'void',
        sourceRefId: charge.id,
        postedByUserId: userId,
        businessDate: charge.businessDate,
        idempotencyKey: key,
        accountCode,
      },
    ];

    // The tax raised by this charge is reversed with it, as its own line
    // naming its own target, so each line is still voided at most once.
    const taxLine = (await this.folios.listCharges(folio.id)).find(
      (c) => c.sourceRefType === 'tax' && c.sourceRefId === charge.id,
    );
    if (taxLine && !(await this.folios.findReversalOf(taxLine.id))) {
      drafts.push({
        chargeType: 'tax',
        description: `Void: ${taxLine.description ?? 'tax'}`,
        departmentId: null,
        quantity: 1,
        unitPriceRwf: -taxLine.amountRwf,
        amountRwf: -taxLine.amountRwf,
        taxCode: taxLine.taxCode,
        taxRate: taxLine.taxRate,
        taxAmountRwf: null,
        sourceRefType: 'void',
        sourceRefId: taxLine.id,
        postedByUserId: userId,
        businessDate: null,
        idempotencyKey: `${key}:tax`,
        accountCode: 'TAX_PAYABLE',
      });
    }

    await this.folios.postCharges({
      folioId: folio.id,
      workspaceId: ws.workspaceId,
      drafts,
    });

    return this.detail(ws, folio.id);
  }

  /**
   * Close a bill, which SIGNS ITS SALE (ADR-050 D-a, AC-2, AC-6).
   *
   * One `NS` over the host's own undeclared lines, raised in the same
   * transaction that locks the bill. What the business's fiscal setup is (the
   * environment, the adapter mode, whether it has connected its EBM account) is
   * resolved here, because the repository must not know about any of it.
   *
   * A replay answers with what the first close raised. A missing connection is
   * never a refusal: the declaration is written `failed` with reason
   * `no_connection` and the bill still closes (D-b).
   */
  async close(
    ws: ScopedWorkspace,
    folioId: string,
    body: CloseFolioRequest = {},
  ): Promise<CloseFolioResult> {
    const folio = this.ownFolio(ws, await this.folios.findFolio(folioId));
    const outcome = await this.folios.closeAndDeclare(
      folio.id,
      await this.declarationPlan(folio.propertyId, body),
    );

    switch (outcome.kind) {
      case 'balance_owed':
        throw new ConflictException(
          `This bill still owes ${outcome.balanceRwf.toLocaleString()} RWF. Take the payment before closing it.`,
        );
      case 'foreign_undeclared':
        throw new UnprocessableEntityException(
          'A line on this bill belongs to another business and has not been declared by it yet, so this bill cannot be signed under your TIN. Ask that business to confirm its order was delivered.',
        );
      case 'payment_without_code':
        throw new UnprocessableEntityException(
          'A payment on this bill does not say how it was paid, and the receipt has to. Void it and take the payment again.',
        );
      case 'closed':
        break;
    }

    // Best effort, after commit: a lost wake-up costs one drain interval.
    if (outcome.wake && outcome.emissionId) {
      await this.sales.wake(outcome.emissionId, 0);
    }

    return {
      ...(await this.detail(ws, folio.id)),
      lockedAt: outcome.lockedAt?.toISOString() ?? null,
      declaration: {
        emissionId: outcome.emissionId,
        status: outcome.status,
        reason: outcome.reason,
        excludedChargeIds: outcome.excludedChargeIds,
      },
    };
  }

  /**
   * Who signs, and whether they can (ADR-050 D-b, value sourcing "which EBM
   * connection signs"): the folio's property's org, through its own
   * connection, as `DeclarationPlanService` answers it for every sale.
   */
  private async declarationPlan(
    propertyId: string,
    body: CloseFolioRequest,
  ): Promise<CloseDeclarationPlan> {
    const plan = await this.plans.forOrg(await this.folios.orgOfProperty(propertyId));
    return {
      ...plan,
      customerTin: body.customerTin ?? null,
      customerName: body.customerName ?? null,
    };
  }

  // --- Internals -----------------------------------------------------------

  /**
   * A client key alone is not unique across the platform.
   *
   * `folio_charges.idempotency_key` is globally unique, and two properties can
   * pick the same UUID. Without the workspace prefix the second one silently
   * receives the first one's result, which on a money command is the worst
   * possible outcome.
   */
  /**
   * The folio a route named, proved to be this workspace's AND on a branch in
   * scope. A bill of another branch reads as absent (ADR-054 AC-T2).
   */
  private ownFolio(ws: ScopedWorkspace, row: FolioRow | null): FolioRow {
    const folio = assertOwned(row, ws);
    assertInBranchScope(ws, folio.propertyId);
    return folio;
  }

  private scopedKey(ws: ScopedWorkspace, clientKey: string): string {
    return `${ws.workspaceId}:${clientKey}`;
  }

  /**
   * A replay is the SAME command, or it is a bug (AC-12).
   *
   * The same key with a different body is a client that reused a key, and
   * answering with the earlier result would hide a charge that never happened.
   */
  private assertSameCommand(
    existing: ChargeRow,
    now: { folioId: string; chargeType: string; amountRwf: number },
  ): void {
    if (
      existing.folioId !== now.folioId ||
      existing.chargeType !== now.chargeType ||
      existing.amountRwf !== now.amountRwf
    ) {
      throw new ConflictException(
        'That Idempotency-Key was already used for a different command. Generate a new one.',
      );
    }
  }

  private openFolio(folio: FolioRow): FolioRow {
    if (folio.status === 'closed') {
      throw new ConflictException(
        'This bill is closed. Nothing further can post to it.',
      );
    }
    return folio;
  }

  /**
   * A bill a CHARGE may be aimed at (ADR-050 D-c).
   *
   * Everything `openFolio` allows, plus a guest bill that was closed by signing
   * it: the charge goes to the stay's next bill. A bill closed before ADR-050
   * (closed, never locked) and a house or master bill (no stay to follow) stay
   * refused, because neither has a next bill that means anything.
   */
  private lateChargeTarget(folio: FolioRow): FolioRow {
    if (folio.status === 'closed' && folio.lockedAt && folio.guestStayId) return folio;
    return this.openFolio(folio);
  }

  /**
   * Which department a charge credits (AC-1).
   *
   * A revenue charge must name one, that department must be a revenue centre,
   * and it must belong to this workspace. A cost centre is refused with 422:
   * departmental revenue is read straight off the charge, so a charge on
   * Engineering would put restaurant takings in the maintenance budget forever.
   */
  private async resolveDepartment(
    ws: ScopedWorkspace,
    body: PostChargeRequest,
    folio: FolioRow,
  ): Promise<string | null> {
    if (!isRevenueChargeType(body.chargeType)) return body.departmentId ?? null;

    if (!body.departmentId) {
      throw new UnprocessableEntityException(
        'A revenue charge has to name the department it earns for.',
      );
    }
    const department = assertOwned(
      await this.folios.findDepartment(body.departmentId),
      ws,
    );
    if (!department.isRevenueCenter) {
      throw new UnprocessableEntityException(
        'That department is a cost centre, so revenue cannot be posted to it.',
      );
    }
    if (department.status !== 'active') {
      throw new UnprocessableEntityException(
        'That department is archived. Pick an active one.',
      );
    }
    if (department.propertyId && department.propertyId !== folio.propertyId) {
      throw new UnprocessableEntityException(
        'That department belongs to a different property.',
      );
    }
    return department.id;
  }

  /**
   * The tax rate effective right now, snapshotted onto the charge (AC-5, D-m).
   *
   * REFUSES when no row is effective rather than defaulting to 18%. A rate the
   * tax authority can change does not belong in code, and a defaulted rate is a
   * wrong invoice that surfaces at an audit rather than at the desk.
   */
  private async resolveTax(
    requested: TaxCode | undefined,
  ): Promise<{ taxCode: TaxCode; taxRate: number }> {
    const taxCode = requested ?? DEFAULT_TAX_CODE;
    const rates = await this.folios.effectiveTaxRates(new Date());
    if (!rates) {
      throw new UnprocessableEntityException(
        'No tax rates are effective right now, so nothing can be priced. Set them in config first.',
      );
    }
    const taxRate = rates[taxCode];
    if (typeof taxRate !== 'number') {
      throw new UnprocessableEntityException(
        `The effective tax rates do not cover ${taxCode}.`,
      );
    }
    return { taxCode, taxRate };
  }

  /** A payment line records its method in the description; a void re-reads it. */
  private methodFromDescription(
    description: string | null,
  ): 'mobile_money' | 'card' | 'cash' | null {
    if (!description) return null;
    if (description.includes('(mobile_money)')) return 'mobile_money';
    if (description.includes('(card)')) return 'card';
    if (description.includes('(cash)')) return 'cash';
    return null;
  }

  private presentFolio(row: FolioRow): OperatorFolio {
    return {
      id: row.id,
      folioNumber: row.folioNumber,
      folioType: row.folioType,
      status: row.status,
      guestStayId: row.guestStayId,
      bookingId: row.bookingId,
      guestName: row.guestName,
      roomLabel: row.roomLabel,
      balanceRwf: row.balanceRwf,
      folioSequence: row.folioSequence,
      lockedAt: row.lockedAt?.toISOString() ?? null,
      openedAt: row.openedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
    };
  }

  private presentCharge(
    row: ChargeRow,
    reversedIds: Map<string, string>,
  ): OperatorFolioCharge {
    return {
      id: row.id,
      chargeType: row.chargeType,
      description: row.description,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      quantity: row.quantity,
      unitPriceRwf: row.unitPriceRwf,
      amountRwf: row.amountRwf,
      taxCode: row.taxCode,
      taxRate: row.taxRate === null ? null : Number(row.taxRate),
      taxAmountRwf: row.taxAmountRwf,
      sourceRefType: row.sourceRefType,
      sourceRefId: row.sourceRefId,
      voidedByChargeId: reversedIds.get(row.id) ?? null,
      postedByUserId: row.postedByUserId,
      businessDate: row.businessDate,
      postedAt: row.postedAt.toISOString(),
    };
  }

  /** Kept for the night audit, which posts without a request behind it. */
  vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}
