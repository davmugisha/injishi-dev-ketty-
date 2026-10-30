import type { PayDeclarationKind, PayExportKind, PayFile, PayFileList, PayFileResult } from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertCoversEveryBranch, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { StorageService } from '../../storage/application/storage.service';
import { kigaliToday, monthOf } from '../domain/hr-calendar';
import { bankFile, momoFile, payeDeclaration, rssbDeclaration, type PayeeRow } from '../domain/pay-files';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { HrRulesRepository } from '../infrastructure/hr-rules.repository';
import { PayRecordsRepository } from '../infrastructure/pay-records.repository';
import { PayrollRepository } from '../infrastructure/payroll.repository';
import { displayNameOf } from './employee-presenter';
import { HR_FILE_LINK_SECONDS } from './hr-files.service';
import { orgOf } from './hr-access';

/**
 * The files a confirmed run produces (058-payroll AC-PY10, AC-PY12): the bank
 * and MoMo payment files from each person's primary pay account, and the PAYE
 * and RSSB declarations from the frozen lines. Each is built from the whole
 * run, so only a caller covering every branch builds one; each is stored
 * privately, recorded as a row, and handed back as a five minute link. Until
 * the accountant's sheet names a format, every file says it is provisional.
 */
@Injectable()
export class PayFilesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly payroll: PayrollRepository,
    private readonly records: PayRecordsRepository,
    private readonly rules: HrRulesRepository,
    private readonly storage: StorageService,
  ) {}

  async list(ws: ScopedWorkspace, runId: string): Promise<PayFileList> {
    assertOwnedByOrg(await this.payroll.findRun(runId), ws);
    return { files: (await this.records.filesOfRun(runId)).map(presentFile) };
  }

  /** `POST /ops/pay-runs/:id/exports`: the bank or MoMo file, and who was left out of it and why. */
  async createExport(ws: ScopedWorkspace, userId: string, runId: string, kind: PayExportKind): Promise<PayFileResult> {
    const orgId = orgOf(ws);
    const run = await this.confirmedRun(ws, runId);
    const period = monthOf(run.periodStart);
    const slips = await this.records.payslipsOfRun(runId);
    const accounts = await this.records.primaryAccounts(slips.map((s) => s.employeeId));
    const rows: PayeeRow[] = slips.map((s) => ({
      employeeId: s.employeeId,
      employeeNumber: s.employeeNumber,
      name: displayNameOf(s),
      netRwf: s.netRwf,
      account: accounts.get(s.employeeId) ?? null,
    }));
    const reference = `PAY-${period}`;
    const built = kind === 'bank' ? bankFile(rows, reference) : momoFile(rows, reference);
    const total = built.included.reduce((sum, r) => sum + r.netRwf, 0);
    const fileKey = await this.storage.putHrPayFile({
      body: Buffer.from(built.text, 'utf8'),
      filename: `${kind}-${period}.csv`,
      workspaceId: ws.workspaceId,
      createdByUserId: userId,
    });
    const id = await this.db.transaction(async (tx) => {
      const created = await this.records.insertExport(tx, { orgId, payRunId: runId, kind, fileKey, rowCount: built.included.length, totalRwf: total, createdByUserId: userId });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'pay_run',
        subjectId: runId,
        eventType: 'hr.pay_export_built',
        orgId,
        diff: { exportId: created, kind, rows: built.included.length, leftOut: built.leftOut.length },
      });
      return created;
    });
    return this.result(runId, id, fileKey, built.leftOut.map((l) => ({ employeeId: l.row.employeeId, displayName: l.row.name, reason: l.reason })));
  }

  /** `POST /ops/pay-runs/:id/declarations`: PAYE or RSSB, in the format the rule names, provisional until it names one. */
  async createDeclaration(ws: ScopedWorkspace, userId: string, runId: string, kind: PayDeclarationKind): Promise<PayFileResult> {
    const orgId = orgOf(ws);
    const run = await this.confirmedRun(ws, runId);
    const period = monthOf(run.periodStart);
    const slips = await this.records.payslipsOfRun(runId);
    const people = new Map((await this.records.people(slips.map((s) => s.employeeId))).map((p) => [p.employeeId, p]));
    const business = await this.records.business(orgId);
    const rows = slips.map((s) => ({
      employeeNumber: s.employeeNumber,
      name: displayNameOf(s),
      rssbNumber: people.get(s.employeeId)?.rssbNumber ?? null,
      idNumber: people.get(s.employeeId)?.idDocumentNumber ?? null,
      grossRwf: s.grossRwf,
      payeRwf: s.payeRwf,
      lines: s.lines,
    }));
    const formats = await this.rules.declarationFormats(kigaliToday());
    const formatVersion = formats ? `provisional_csv v${formats.version}` : 'provisional';
    const text = kind === 'paye' ? payeDeclaration(rows, business, period) : rssbDeclaration(rows, business, period);
    const fileKey = await this.storage.putHrPayFile({
      body: Buffer.from(text, 'utf8'),
      filename: `${kind}-declaration-${period}.csv`,
      workspaceId: ws.workspaceId,
      createdByUserId: userId,
    });
    const id = await this.db.transaction(async (tx) => {
      const created = await this.records.insertDeclaration(tx, { orgId, payRunId: runId, kind, formatVersion, fileKey, createdByUserId: userId });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'pay_run',
        subjectId: runId,
        eventType: 'hr.pay_declaration_built',
        orgId,
        diff: { declarationId: created, kind, formatVersion, rows: rows.length },
      });
      return created;
    });
    return this.result(runId, id, fileKey, []);
  }

  /** `GET /ops/pay-files/:id`: a file built before, as a fresh five minute link. */
  async link(ws: ScopedWorkspace, fileId: string): Promise<{ url: string; expiresInSeconds: number }> {
    const file = await this.records.findFile(fileId);
    if (!file || file.orgId !== orgOf(ws)) throw new NotFoundException();
    assertCoversEveryBranch(ws);
    return { url: await this.storage.signedUrl(file.fileKey, HR_FILE_LINK_SECONDS), expiresInSeconds: HR_FILE_LINK_SECONDS };
  }

  private async confirmedRun(ws: ScopedWorkspace, runId: string): Promise<{ periodStart: string }> {
    const run = assertOwnedByOrg(await this.payroll.findRun(runId), ws);
    // A file of the whole run: a caller limited to some branches would read pay they do not cover.
    assertCoversEveryBranch(ws);
    if (run.status !== 'confirmed') throw new ConflictException('Files are built from a confirmed run. Confirm it first.');
    return run;
  }

  private async result(runId: string, id: string, fileKey: string, leftOut: PayFileResult['leftOut']): Promise<PayFileResult> {
    const file = (await this.records.filesOfRun(runId)).find((f) => f.id === id);
    if (!file) throw new NotFoundException();
    return { file: presentFile(file), url: await this.storage.signedUrl(fileKey, HR_FILE_LINK_SECONDS), expiresInSeconds: HR_FILE_LINK_SECONDS, leftOut };
  }
}

function presentFile(f: { id: string; kind: PayExportKind | PayDeclarationKind; rowCount: number | null; totalRwf: number | null; formatVersion: string | null; createdAt: Date; createdByName: string | null }): PayFile {
  return {
    id: f.id,
    kind: f.kind,
    rowCount: f.rowCount,
    totalRwf: f.totalRwf,
    formatVersion: f.formatVersion,
    createdAt: f.createdAt.toISOString(),
    createdByName: f.createdByName,
  };
}
