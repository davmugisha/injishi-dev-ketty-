import {
  FILING_PROOF_MAX_BYTES,
  daysBetween,
  kigaliDateOf,
  kigaliToday,
  leaseFilingDateProblem,
  type LeaseFilingList,
  type LeaseFilingView,
  type LeaseFilingsQuery,
  type MarkFilingFiledRequest,
} from '@injishi/contracts';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { RentalsFilesStorage } from '../../storage/application/rentals-files-storage';
import { buildingIdsOf } from '../domain/attention';
import { assertBuildingInScope, assertResidence } from '../domain/residence';
import { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { TaxesRepository, type FilingRow } from '../infrastructure/taxes.repository';
import type { ReceiptUpload } from './fault-payments.service';

export const FILING_NOT_FOUND = 'Filing not found.';

/**
 * Lease copies owed to RRA (blueprint 1.2 "lease_filings", WP 4.4). Every
 * lease signed by both sides owes one within 15 days (the row is made at the
 * second signature). The landlord files on RRA's portal and marks it filed
 * here, with the day, RRA's reference and a photo or PDF of the proof. Late is
 * worked out: due and past its day.
 */
@Injectable()
export class FilingsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly taxes: TaxesRepository,
    private readonly files: RentalsFilesStorage,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  /** The filings of a year (by due day), or with no year every one still due and this year's. */
  async list(ws: ScopedWorkspace, query: LeaseFilingsQuery): Promise<LeaseFilingList> {
    const r = assertResidence(ws);
    const today = kigaliToday(this.now());
    const buildings = buildingIdsOf(ws.branchScope);
    const rows = query.year
      ? await this.taxes.filings({ workspaceId: r.workspaceId, buildings, year: query.year, status: query.status ?? null })
      : (await this.taxes.filings({ workspaceId: r.workspaceId, buildings, year: null, status: query.status ?? null })).filter(
          (f) => f.status === 'pending' || f.dueOn.slice(0, 4) === today.slice(0, 4),
        );
    return { items: await Promise.all(rows.map((row) => this.present(row, today))) };
  }

  /** Filings whose day falls in `year`, for the tax page. */
  async forYear(ws: ScopedWorkspace, year: number): Promise<LeaseFilingView[]> {
    const r = assertResidence(ws);
    const today = kigaliToday(this.now());
    const rows = await this.taxes.filings({ workspaceId: r.workspaceId, buildings: buildingIdsOf(ws.branchScope), year, status: null });
    return Promise.all(rows.map((row) => this.present(row, today)));
  }

  /** The landlord gave RRA the copy: the day (from signing to today), the reference, the proof. */
  async markFiled(ws: ScopedWorkspace, userId: string, id: string, body: MarkFilingFiledRequest, proof: ReceiptUpload | null): Promise<LeaseFilingView> {
    const r = assertResidence(ws);
    const row = await this.taxes.filing(id);
    if (!row || row.workspaceId !== r.workspaceId) throw new NotFoundException(FILING_NOT_FOUND);
    assertBuildingInScope(ws, row.propertyId, 'Filing');
    const today = kigaliToday(this.now());
    const notBefore = row.kind === 'new_lease' && row.signedAt ? kigaliDateOf(row.signedAt) : kigaliDateOf(row.createdAt);
    const problem = leaseFilingDateProblem(body.filedOn, notBefore, today);
    if (problem) throw new BadRequestException({ message: problem, issues: [{ path: ['filedOn'], message: problem }] });
    const stored = proof
      ? await this.files.putDocument({
          kind: 'filing_proof',
          body: proof.body,
          mime: proof.mime,
          filename: proof.filename,
          maxBytes: FILING_PROOF_MAX_BYTES,
          uploadedByUserId: userId,
          workspaceId: r.workspaceId,
        })
      : null;
    await this.db.transaction(async (tx) => {
      const locked = await this.taxes.filing(id, tx, true);
      if (!locked) throw new NotFoundException(FILING_NOT_FOUND);
      await this.taxes.markFiled(tx, { id, filedOn: body.filedOn, reference: body.reference ?? null, proofObjectId: stored?.id ?? null, userId });
      await this.events.write(tx, {
        leaseId: row.leaseId,
        workspaceId: r.workspaceId,
        kind: 'filed',
        actorUserId: userId,
        actorRole: 'landlord',
        visibleToTenant: false,
        payload: { filingId: id, kind: row.kind, filedOn: body.filedOn, reference: body.reference ?? null, again: locked.status === 'filed' },
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'lease',
        subjectId: row.leaseId,
        eventType: locked.status === 'filed' ? 'lease.filing_corrected' : 'lease.filed',
        diff: { filingId: id, kind: row.kind, dueOn: row.dueOn, filedOn: body.filedOn, reference: body.reference ?? null, proof: Boolean(stored) },
      });
    });
    const after = await this.taxes.filing(id);
    if (!after) throw new NotFoundException(FILING_NOT_FOUND);
    return this.present(after, today);
  }

  async present(row: FilingRow, today: string): Promise<LeaseFilingView> {
    const pending = row.status === 'pending';
    return {
      id: row.id,
      leaseId: row.leaseId,
      leaseReference: row.leaseReference,
      tenantName: row.tenantName,
      unitLabel: row.unitLabel,
      propertyName: row.propertyName,
      kind: row.kind,
      signedOn: row.signedAt ? kigaliDateOf(row.signedAt) : null,
      dueOn: row.dueOn,
      status: row.status,
      late: pending && row.dueOn < today,
      daysLeft: pending ? daysBetween(today, row.dueOn) : null,
      filedOn: row.filedOn,
      reference: row.reference,
      proofUrl: row.proofObjectKey ? await this.files.signedUrl(row.proofObjectKey) : null,
    };
  }
}
