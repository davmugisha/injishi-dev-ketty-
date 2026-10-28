import {
  ExpenseCategory,
  TAX_RECEIPT_MAX_BYTES,
  companyProfit,
  computeRentalIncomeTax,
  declarationDateProblem,
  deductibleLoanInterestRwf,
  kigaliToday,
  lateCharges,
  rentalTaxDueOn,
  taxYearEnded,
  taxYearProblem,
  type TaxYearView,
  type TaxpayerKind,
  type TaxpayerView,
  type UpdateTaxDeclarationRequest,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { RentalsFilesStorage } from '../../storage/application/rentals-files-storage';
import { assertResidence } from '../domain/residence';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { TaxesRepository } from '../infrastructure/taxes.repository';
import type { ReceiptUpload } from './fault-payments.service';
import { FilingsService } from './filings.service';

const bad = (path: string, message: string): BadRequestException => new BadRequestException({ message, issues: [{ path: [path], message }] });

/**
 * Rental income tax (blueprint 2.3 "Expenses and taxes", WP 4.4), by the
 * rules in contracts (`computeRentalIncomeTax`, Law No. 048/2023 as verified
 * on feat/rentals): a year's figures worked out from what came in and what
 * was spent, where the declaration stands, and the lease copies owed to RRA.
 *
 * For a person: rent received in the calendar year (succeeded payments by the
 * Kigali day they were received, through Injishi or recorded before rent went
 * gateway only; a part that paid a deposit is not rent), less 50%, less the
 * interest on a bank loan to build or buy the rented property (not voided;
 * one with no bank proof attached is flagged), then the bands, due 31 January
 * of the next year, with Art. 51's late charges while it is past due and not
 * declared. Other costs are listed for the records. For a company: rent less
 * every cost and the 28% it implies, no bands. Nothing computed is stored.
 * The whole business is one taxpayer, so the year is the business's in full.
 */
@Injectable()
export class TaxesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly taxes: TaxesRepository,
    private readonly context: RentalsContextRepository,
    private readonly files: RentalsFilesStorage,
    private readonly filings: FilingsService,
    private readonly audit: RentalsAuditWriter,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  async taxpayer(ws: ScopedWorkspace): Promise<TaxpayerView> {
    const r = assertResidence(ws);
    await this.context.ensureProfile(r);
    return { kind: await this.taxes.taxpayerKind(r.orgId) };
  }

  /** Does the business let as a person or as a company? It decides which tax applies. */
  async setTaxpayer(ws: ScopedWorkspace, userId: string, kind: TaxpayerKind): Promise<TaxpayerView> {
    const r = assertResidence(ws);
    await this.context.ensureProfile(r);
    await this.db.transaction(async (tx) => {
      const before = await this.taxes.setTaxpayerKind(tx, r.orgId, kind);
      if (before !== kind) {
        await this.audit.write(tx, {
          actorUserId: userId,
          subjectType: 'org',
          subjectId: r.orgId,
          eventType: 'taxpayer.set',
          diff: { from: before, to: kind },
        });
      }
    });
    return { kind };
  }

  async year(ws: ScopedWorkspace, year: number): Promise<TaxYearView> {
    const r = assertResidence(ws);
    const today = kigaliToday(this.now());
    const problem = taxYearProblem(year, today);
    if (problem) throw bad('year', problem);
    const [rent, costs, taxpayer, declaration, filings] = await Promise.all([
      this.taxes.rentReceived(r.workspaceId, year),
      this.taxes.expenses(r.orgId, year),
      this.taxes.taxpayerKind(r.orgId),
      this.taxes.declaration(r.orgId, year),
      this.filings.forYear(ws, year),
    ]);

    const byMonth = new Map<string, number>();
    const byProperty = new Map<string, { propertyId: string; name: string; amountRwf: number }>();
    let gatewayRwf = 0;
    let recordedRwf = 0;
    let paymentCount = 0;
    let depositsExcludedRwf = 0;
    for (const row of rent) {
      byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + row.rentRwf);
      const p = byProperty.get(row.propertyId) ?? { propertyId: row.propertyId, name: row.propertyName, amountRwf: 0 };
      p.amountRwf += row.rentRwf;
      byProperty.set(row.propertyId, p);
      if (row.channel === 'gateway') gatewayRwf += row.rentRwf;
      else recordedRwf += row.rentRwf;
      paymentCount += row.payments;
      depositsExcludedRwf += row.depositRwf;
    }
    const grossRentRwf = gatewayRwf + recordedRwf;

    const interest = costs.filter((c) => c.category === 'loan_interest');
    const other = costs.filter((c) => c.category !== 'loan_interest');
    const deductibleRwf = deductibleLoanInterestRwf(interest.map((c) => ({ amountRwf: c.amountRwf, purpose: c.loanPurpose })));
    const otherByCategory = new Map<ExpenseCategory, number>();
    for (const c of other) otherByCategory.set(c.category, (otherByCategory.get(c.category) ?? 0) + c.amountRwf);
    const allCostsRwf = costs.reduce((s, c) => s + c.amountRwf, 0);

    const dueOn = rentalTaxDueOn(year);
    const company = taxpayer === 'company';
    const rentalTax = company ? null : computeRentalIncomeTax({ grossRentRwf, loanInterestRwf: deductibleRwf });
    const status = declaration?.status ?? 'not_started';
    const late = rentalTax && today > dueOn && status === 'not_started' ? lateCharges({ taxRwf: rentalTax.taxRwf, dueOn, on: today, declaredOn: null }) : null;

    return {
      year,
      asOf: today,
      running: year === Number(today.slice(0, 4)),
      taxpayer,
      dueOn,
      canDeclare: taxYearEnded(year, today) && !company,
      rent: {
        totalRwf: grossRentRwf,
        gatewayRwf,
        recordedRwf,
        paymentCount,
        depositsExcludedRwf,
        months: Array.from({ length: 12 }, (_, i) => {
          const month = `${year}-${String(i + 1).padStart(2, '0')}`;
          return { month, amountRwf: byMonth.get(month) ?? 0 };
        }),
        properties: [...byProperty.values()].sort((a, b) => b.amountRwf - a.amountRwf),
      },
      interest: {
        deductibleRwf,
        entries: interest.map((c) => ({
          id: c.id,
          paidOn: c.paidOn,
          lender: c.payeeName,
          amountRwf: c.amountRwf,
          loanPurpose: c.loanPurpose,
          propertyName: c.propertyName,
          hasReceipt: c.hasReceipt,
          needsBankProof: !c.hasReceipt,
        })),
        needsProofCount: interest.filter((c) => !c.hasReceipt).length,
      },
      otherExpenses: {
        totalRwf: other.reduce((s, c) => s + c.amountRwf, 0),
        byCategory: ExpenseCategory.options.filter((c) => otherByCategory.has(c)).map((category) => ({ category, amountRwf: otherByCategory.get(category) ?? 0 })),
        entries: other.map((c) => ({ id: c.id, paidOn: c.paidOn, category: c.category, amountRwf: c.amountRwf, payeeName: c.payeeName, propertyName: c.propertyName })),
      },
      rentalTax,
      profit: taxpayer === 'individual' ? null : companyProfit({ rentRwf: grossRentRwf, expensesRwf: allCostsRwf }),
      lateCharges: late,
      declaration: {
        status,
        declaredOn: declaration?.declaredOn ?? null,
        paidOn: declaration?.paidOn ?? null,
        amountPaidRwf: declaration?.amountPaidRwf ?? null,
        rraReference: declaration?.rraReference ?? null,
        receiptUrl: declaration?.receiptObjectKey ? await this.files.signedUrl(declaration.receiptObjectKey) : null,
        updatedAt: declaration && (declaration.status !== 'not_started' || declaration.rraReference) ? declaration.updatedAt.toISOString() : null,
      },
      filings,
    };
  }

  /**
   * Mark where a year's declaration stands. The year must be over; a company
   * puts its rent in its corporate income tax return, so it is refused.
   */
  async declare(ws: ScopedWorkspace, userId: string, year: number, body: UpdateTaxDeclarationRequest, receipt: ReceiptUpload | null): Promise<TaxYearView> {
    const r = assertResidence(ws);
    const today = kigaliToday(this.now());
    const problem = taxYearProblem(year, today);
    if (problem) throw bad('year', problem);
    if (!taxYearEnded(year, today)) throw bad('year', `${year} isn't over yet. Declare it from 1 January ${year + 1}.`);
    if ((await this.taxes.taxpayerKind(r.orgId)) === 'company') {
      throw new ConflictException({ code: 'taxpayer_company', message: "A company puts its rent in its corporate income tax return, so there's no rental tax to mark." });
    }
    if (body.status !== 'not_started') {
      const declared = declarationDateProblem(body.declaredOn ?? '', year, { today });
      if (declared) throw bad('declaredOn', declared);
      if (body.status === 'paid') {
        const paid = declarationDateProblem(body.paidOn ?? '', year, { today, notBefore: body.declaredOn ?? null });
        if (paid) throw bad('paidOn', paid);
      }
    }
    const existing = await this.taxes.declaration(r.orgId, year);
    const stored = receipt && body.status !== 'not_started'
      ? await this.files.putDocument({
          kind: 'tax_receipt',
          body: receipt.body,
          mime: receipt.mime,
          filename: receipt.filename,
          maxBytes: TAX_RECEIPT_MAX_BYTES,
          uploadedByUserId: userId,
          workspaceId: r.workspaceId,
        })
      : null;
    const paid = body.status === 'paid';
    await this.db.transaction(async (tx) => {
      const declarationId = await this.taxes.saveDeclaration(tx, {
        orgId: r.orgId,
        workspaceId: r.workspaceId,
        year,
        status: body.status,
        declaredOn: body.status === 'not_started' ? null : (body.declaredOn ?? null),
        paidOn: paid ? (body.paidOn ?? null) : null,
        amountPaidRwf: paid ? (body.amountPaidRwf ?? null) : null,
        rraReference: body.status === 'not_started' ? null : (body.rraReference ?? existing?.rraReference ?? null),
        // A new receipt replaces the old; none sent keeps the one already there.
        receiptObjectId: body.status === 'not_started' ? null : (stored?.id ?? existing?.receiptObjectId ?? null),
        userId,
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'tax_declaration',
        subjectId: declarationId,
        eventType: `tax_declaration.${body.status}`,
        diff: { year, from: existing?.status ?? 'not_started', to: body.status, declaredOn: body.declaredOn ?? null, paidOn: body.paidOn ?? null, amountPaidRwf: body.amountPaidRwf ?? null, receipt: Boolean(stored) },
      });
    });
    return this.year(ws, year);
  }
}
