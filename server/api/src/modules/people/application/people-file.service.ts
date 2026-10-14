import {
  RwPhoneNumber,
  type CreateDocumentRequestRequest,
  type CreateEmployeeNoteRequest,
  type CreatePayAccountRequest,
  type DecideDocumentRequest,
  type DocumentFormat,
  type DocumentRequestList,
  type EmployeeDocument,
  type EmployeeDocumentList,
  type EmployeeNote,
  type EmployeeNoteList,
  type FileLink,
  type PayAccount,
  type PayAccountList,
  type UpdateDocumentDatesRequest,
  type UpdatePayAccountRequest,
  type UploadEmployeeDocumentRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { isCalendarDate } from '../../booking/domain/pricing';
import { kigaliToday } from '../domain/hr-calendar';
import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import {
  PeopleFileRepository,
  type DocumentRow,
  type PayAccountRow,
  type VersionRow,
} from '../infrastructure/people-file.repository';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';
import { HR_FILE_LINK_SECONDS, HrFilesService } from './hr-files.service';
import { DOCUMENT_FORMAT_MIME } from '../../storage/domain/sniff-mime';

/**
 * The people file's details (ADR-058, 058-people-file): pay accounts, notes,
 * documents and document requests.
 *
 * Every read resolves the person first, through the business and the caller's
 * branches, so a row of another business or outside the caller's branches is a
 * 404 (AC-PF15). Every write lands its audit row in the same transaction, with
 * personal values written as "changed", and the events people should hear
 * about go to the outbox in that transaction too (index contract 12).
 */
@Injectable()
export class PeopleFileService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly employees: EmployeesRepository,
    private readonly file: PeopleFileRepository,
    private readonly files: HrFilesService,
  ) {}

  /** The person, read as the caller may: 404 for another business or a branch they do not cover. */
  private async person(ws: ScopedWorkspace, employeeId: string): Promise<EmployeeRow> {
    const row = assertOwnedByOrg(await this.employees.find(employeeId), ws);
    assertInBranchScope(ws, row.workPropertyId);
    return row;
  }

  // --- Pay accounts (AC-PF3) ---------------------------------------------------------

  async payAccounts(ws: ScopedWorkspace, employeeId: string): Promise<PayAccountList> {
    const person = await this.person(ws, employeeId);
    return { accounts: (await this.file.accountsOf(person.id)).map(presentAccount) };
  }

  /**
   * Add an account, primary when asked or when the person has none. A change of
   * primary is the one place a salary could be redirected in silence, so it
   * writes `pay_account.changed`, which the automations deliver to the person's
   * contacts as they were before the change and to the owner (AC-PF3).
   */
  async addPayAccount(
    ws: ScopedWorkspace,
    userId: string,
    employeeId: string,
    body: CreatePayAccountRequest,
  ): Promise<PayAccount> {
    const orgId = orgOf(ws);
    const person = await this.person(ws, employeeId);
    assertPersonInReach(ws, person.workPropertyId);
    const momoPhone = body.kind === 'momo' ? normalisePhone(body.momoPhone) : null;
    const id = await this.employees.withEmployeeLock(person.id, async (tx) => {
      const existing = await this.file.accountsOf(person.id, tx);
      const hasPrimary = existing.some((a) => a.isPrimary && a.status === 'active');
      const makePrimary = body.makePrimary === true || !hasPrimary;
      const previousPrimary = makePrimary ? await this.file.clearPrimary(tx, person.id) : null;
      const accountId = await this.file.insertAccount(tx, {
        orgId,
        employeeId: person.id,
        kind: body.kind,
        bankName: body.kind === 'bank' ? body.bankName.trim() : null,
        accountNumber: body.kind === 'bank' ? body.accountNumber.replace(/\s+/g, ' ').trim() : null,
        branchName: body.kind === 'bank' ? (body.branchName?.trim() || null) : null,
        momoPhone,
        isPrimary: makePrimary,
        createdByUserId: userId,
      });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: person.id,
        eventType: 'hr.pay_account_added',
        orgId,
        diff: { payAccountId: { to: accountId }, kind: { to: body.kind }, accountNumber: 'changed', isPrimary: { to: makePrimary } },
      });
      if (makePrimary) {
        await writeHrEvent(tx, {
          trigger: 'pay_account.changed',
          aggregateType: 'employee',
          aggregateId: person.id,
          change: accountId,
          workspaceId: ws.workspaceId,
          payload: { employeeId: person.id, payAccountId: accountId, previousPayAccountId: previousPrimary },
        });
      }
      return accountId;
    });
    if (!id) throw new NotFoundException();
    const row = await this.file.findAccount(id);
    if (!row) throw new NotFoundException();
    return presentAccount(row);
  }

  /** Retire an account, or make it the primary one. An account is never edited in place. */
  async changePayAccount(
    ws: ScopedWorkspace,
    userId: string,
    accountId: string,
    body: UpdatePayAccountRequest,
  ): Promise<PayAccount> {
    const orgId = orgOf(ws);
    const account = assertOwnedByOrg(await this.file.findAccount(accountId), ws);
    const person = await this.person(ws, account.employeeId);
    assertPersonInReach(ws, person.workPropertyId);
    const done = await this.employees.withEmployeeLock(person.id, async (tx) => {
      const current = await this.file.findAccount(accountId, tx);
      if (!current) return false;
      if (current.status === 'retired') {
        throw new ConflictException('A retired account stays retired; add the account again instead.');
      }
      let primaryChanged = false;
      let previousPrimary: string | null = null;
      if (body.action === 'retire') {
        primaryChanged = current.isPrimary;
        await this.file.setAccount(tx, current.id, { status: 'retired', isPrimary: false });
      } else {
        if (current.isPrimary) return true;
        previousPrimary = await this.file.clearPrimary(tx, person.id);
        await this.file.setAccount(tx, current.id, { isPrimary: true });
        primaryChanged = true;
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: person.id,
        eventType: body.action === 'retire' ? 'hr.pay_account_retired' : 'hr.pay_account_made_primary',
        orgId,
        diff: { payAccountId: { to: current.id } },
      });
      if (primaryChanged) {
        await writeHrEvent(tx, {
          trigger: 'pay_account.changed',
          aggregateType: 'employee',
          aggregateId: person.id,
          change: `${current.id}:${body.action}`,
          workspaceId: ws.workspaceId,
          payload: {
            employeeId: person.id,
            payAccountId: body.action === 'retire' ? null : current.id,
            previousPayAccountId: body.action === 'retire' ? current.id : previousPrimary,
          },
        });
      }
      return true;
    });
    if (!done) throw new NotFoundException();
    const row = await this.file.findAccount(accountId);
    if (!row) throw new NotFoundException();
    return presentAccount(row);
  }

  // --- Notes (AC-PF6) ----------------------------------------------------------------

  /** Notes are `people.manage`'s alone, and reading them is itself recorded. */
  async notes(ws: ScopedWorkspace, userId: string, employeeId: string): Promise<EmployeeNoteList> {
    const person = await this.person(ws, employeeId);
    const rows = await this.file.notesOf(person.id);
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'employee',
      subjectId: person.id,
      eventType: 'hr.notes_viewed',
      orgId: orgOf(ws),
      diff: { notes: { to: rows.length } },
    });
    return { notes: rows.map(presentNote) };
  }

  async addNote(
    ws: ScopedWorkspace,
    userId: string,
    employeeId: string,
    body: CreateEmployeeNoteRequest,
  ): Promise<EmployeeNote> {
    const orgId = orgOf(ws);
    const person = await this.person(ws, employeeId);
    assertPersonInReach(ws, person.workPropertyId);
    const fileKeys = [...new Set(body.fileKeys ?? [])];
    await this.files.assertOwn(ws, 'attachment', fileKeys);
    const id = await this.db.transaction(async (tx) => {
      const noteId = await this.file.insertNote(tx, {
        orgId,
        employeeId: person.id,
        body: body.body.trim(),
        fileKeys,
        authorUserId: userId,
      });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: person.id,
        eventType: 'hr.note_added',
        orgId,
        diff: { noteId: { to: noteId }, attachments: { to: fileKeys.length } },
      });
      return noteId;
    });
    const note = (await this.file.notesOf(person.id)).find((n) => n.id === id);
    if (!note) throw new NotFoundException();
    return presentNote(note);
  }

  /** A five minute link to one of a note's attachments; reading it is recorded as reading the notes is. */
  async noteFileLink(
    ws: ScopedWorkspace,
    userId: string,
    employeeId: string,
    noteId: string,
    index: number,
  ): Promise<FileLink> {
    const person = await this.person(ws, employeeId);
    const note = (await this.file.notesOf(person.id)).find((n) => n.id === noteId);
    const key = note && Number.isInteger(index) && index >= 0 ? note.fileKeys[index] : undefined;
    if (!note || !key) throw new NotFoundException('No such attachment.');
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'employee',
      subjectId: person.id,
      eventType: 'hr.note_file_viewed',
      orgId: orgOf(ws),
      diff: { noteId: { to: note.id } },
    });
    return { url: await this.files.link(key), expiresInSeconds: HR_FILE_LINK_SECONDS };
  }

  // --- Documents (AC-PF4, AC-PF5) --------------------------------------------------------

  async documentsOf(ws: ScopedWorkspace, employeeId: string): Promise<EmployeeDocumentList> {
    const person = await this.person(ws, employeeId);
    return { documents: await this.present(await this.file.documentsOf(person.id)) };
  }

  /** The Documents lens: every document in the caller's branches. */
  async documentsInScope(
    ws: ScopedWorkspace,
    filter: { status?: 'requested' | 'submitted' | 'approved' | 'rejected'; requestId?: string },
  ): Promise<EmployeeDocumentList> {
    const rows = await this.file.documentsInScope({ orgId: orgOf(ws), scope: ws.branchScope, ...filter });
    return { documents: await this.present(rows) };
  }

  /**
   * Upload a file for one of the person's requested documents, or a document
   * nobody requested. The file must sniff to a format the request allows and fit
   * its size; the upload is kept as a new version even when it replaces a
   * refused one, so nothing uploaded is ever overwritten (AC-PF4).
   */
  async upload(
    ws: ScopedWorkspace,
    userId: string,
    employeeId: string,
    body: UploadEmployeeDocumentRequest,
  ): Promise<EmployeeDocument> {
    const orgId = orgOf(ws);
    const person = await this.person(ws, employeeId);
    assertPersonInReach(ws, person.workPropertyId);
    assertDates(body);
    const [object] = [...(await this.files.assertOwn(ws, 'document', [body.fileKey])).values()];

    let documentId: string;
    if (body.documentId) {
      const document = assertOwnedByOrg(await this.file.findDocument(body.documentId), ws);
      if (document.employeeId !== person.id) throw new NotFoundException();
      if (document.status === 'approved') {
        throw new ConflictException('That document is already approved; request it again for a new copy.');
      }
      checkAgainstRequest(document, object);
      documentId = document.id;
    } else {
      documentId = '';
    }

    const id = await this.db.transaction(async (tx) => {
      let target = documentId;
      if (target) {
        await this.file.lockDocument(tx, target);
        await this.file.updateDocument(tx, target, {
          status: 'submitted',
          rejectReason: null,
          ...datesOf(body),
        });
      } else {
        target = await this.file.insertDocument(tx, {
          orgId,
          employeeId: person.id,
          requestId: null,
          title: (body.title ?? '').trim(),
          status: 'submitted',
          ...datesOf(body),
        });
      }
      await this.file.insertVersion(tx, { orgId, documentId: target, fileKey: body.fileKey, uploadedByUserId: userId });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: person.id,
        eventType: 'hr.document_uploaded',
        orgId,
        diff: { documentId: { to: target } },
      });
      return target;
    });
    return this.one(ws, id);
  }

  /** Approve the newest version, or refuse it with a reason (AC-PF4). */
  async decide(ws: ScopedWorkspace, userId: string, documentId: string, body: DecideDocumentRequest): Promise<EmployeeDocument> {
    const orgId = orgOf(ws);
    const document = assertOwnedByOrg(await this.file.findDocument(documentId), ws);
    const person = await this.person(ws, document.employeeId);
    assertPersonInReach(ws, person.workPropertyId);
    await this.db.transaction(async (tx) => {
      await this.file.lockDocument(tx, document.id);
      const current = await this.file.findDocument(document.id, tx);
      if (!current || current.status !== 'submitted') {
        throw new ConflictException('Only a document waiting for a decision can be approved or refused.');
      }
      const version = await this.file.newestVersion(tx, document.id);
      if (!version) throw new ConflictException('Nothing has been uploaded for this document yet.');
      const approved = body.decision === 'approve';
      const reason = approved ? null : (body.reason ?? '').trim();
      await this.file.decideVersion(tx, version.id, {
        status: approved ? 'approved' : 'rejected',
        rejectReason: reason,
        decidedByUserId: userId,
      });
      await this.file.updateDocument(tx, document.id, { status: approved ? 'approved' : 'rejected', rejectReason: reason });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: person.id,
        eventType: approved ? 'hr.document_approved' : 'hr.document_rejected',
        orgId,
        diff: { documentId: { to: document.id } },
        reason,
      });
    });
    return this.one(ws, document.id);
  }

  /** Move a document's dates; a moved expiry or lead clears its reminder, so the new date is reminded once (AC-PF5). */
  async updateDates(
    ws: ScopedWorkspace,
    userId: string,
    documentId: string,
    body: UpdateDocumentDatesRequest,
  ): Promise<EmployeeDocument> {
    const orgId = orgOf(ws);
    const document = assertOwnedByOrg(await this.file.findDocument(documentId), ws);
    const person = await this.person(ws, document.employeeId);
    assertPersonInReach(ws, person.workPropertyId);
    assertDates(body);
    const issuedOn = body.issuedOn === undefined ? document.issuedOn : body.issuedOn;
    const expiresOn = body.expiresOn === undefined ? document.expiresOn : body.expiresOn;
    if (issuedOn && expiresOn && expiresOn < issuedOn) {
      throw new UnprocessableEntityException('A document cannot expire before it was issued.');
    }
    const moved =
      (body.expiresOn !== undefined && body.expiresOn !== document.expiresOn) ||
      (body.remindDaysBefore !== undefined && body.remindDaysBefore !== document.remindDaysBefore);
    await this.db.transaction(async (tx) => {
      await this.file.updateDocument(tx, document.id, { ...datesOf(body), ...(moved ? { remindedAt: null } : {}) });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: person.id,
        eventType: 'hr.document_dates_changed',
        orgId,
        diff: { documentId: { to: document.id }, expiresOn: { from: document.expiresOn, to: expiresOn } },
      });
    });
    return this.one(ws, document.id);
  }

  /** A five minute link to the document's newest file; every fetch is recorded (AC-PF4). */
  async fileLink(ws: ScopedWorkspace, userId: string, documentId: string): Promise<FileLink> {
    const document = assertOwnedByOrg(await this.file.findDocument(documentId), ws);
    const person = await this.person(ws, document.employeeId);
    const version = await this.file.newestVersion(this.db, document.id);
    if (!version) throw new NotFoundException('Nothing has been uploaded for this document yet.');
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'employee',
      subjectId: person.id,
      eventType: 'hr.document_viewed',
      orgId: orgOf(ws),
      diff: { documentId: { to: document.id }, versionId: { to: version.id } },
    });
    return { url: await this.files.link(version.fileKey), expiresInSeconds: HR_FILE_LINK_SECONDS };
  }

  // --- Requests (AC-PF4) ------------------------------------------------------------

  async requests(ws: ScopedWorkspace): Promise<DocumentRequestList> {
    const rows = await this.file.requests(orgOf(ws), ws.branchScope);
    return {
      requests: rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        formats: r.formats as DocumentFormat[],
        maxMb: r.maxMb,
        dueOn: r.dueOn,
        createdAt: r.createdAt.toISOString(),
        counts: { requested: r.requested, submitted: r.submitted, approved: r.approved, rejected: r.rejected },
      })),
    };
  }

  /** Request a document from one or many people: one document row per person (AC-PF4). */
  async request(ws: ScopedWorkspace, userId: string, body: CreateDocumentRequestRequest): Promise<DocumentRequestList> {
    const orgId = orgOf(ws);
    if (body.dueOn && !isCalendarDate(body.dueOn)) throw new UnprocessableEntityException('That is not a real date.');
    const people = await this.employees.findMany([...new Set(body.employeeIds)]);
    if (people.length !== new Set(body.employeeIds).size) throw new NotFoundException('Someone named is not on file here.');
    for (const p of people) {
      assertOwnedByOrg(p, ws);
      assertPersonInReach(ws, p.workPropertyId);
      if (p.status !== 'active') throw new ConflictException(`${p.legalName} has left, so no document can be requested.`);
    }
    await this.db.transaction(async (tx) => {
      const requestId = await this.file.insertRequest(tx, {
        orgId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        formats: [...new Set(body.formats)],
        maxMb: body.maxMb,
        dueOn: body.dueOn ?? null,
        createdByUserId: userId,
      });
      for (const p of people) {
        const documentId = await this.file.insertDocument(tx, {
          orgId,
          employeeId: p.id,
          requestId,
          title: body.title.trim(),
          status: 'requested',
        });
        await writeHrEvent(tx, {
          trigger: 'document.requested',
          aggregateType: 'employee_document',
          aggregateId: documentId,
          change: 'requested',
          workspaceId: ws.workspaceId,
          payload: { employeeId: p.id, documentId, requestId },
        });
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.document_requested',
        orgId,
        diff: { requestId: { to: requestId }, people: { to: people.length } },
      });
    });
    return this.requests(ws);
  }

  // --- The daily reminder (AC-PF5) ---------------------------------------------------------

  /**
   * Raise `document.expiring` once per document whose reminder falls due today.
   * Each in its own transaction: the mark and the event commit together, and a
   * rerun finds the mark and writes nothing.
   */
  async raiseDueReminders(today: string = kigaliToday()): Promise<number> {
    const due = await this.file.dueReminders(today);
    let raised = 0;
    for (const doc of due) {
      const wrote = await this.db.transaction(async (tx) => {
        if (!(await this.file.markReminded(tx, doc.id))) return false;
        await writeHrEvent(tx, {
          trigger: 'document.expiring',
          aggregateType: 'employee_document',
          aggregateId: doc.id,
          // One reminder per expiry date and lead: moving either is a new reminder.
          change: `${doc.expiresOn}:${doc.remindDaysBefore}`,
          workspaceId: doc.workspaceId,
          payload: { employeeId: doc.employeeId, documentId: doc.id },
        });
        return true;
      });
      if (wrote) raised += 1;
    }
    return raised;
  }

  // --- Presenting -----------------------------------------------------------------------

  private async one(ws: ScopedWorkspace, documentId: string): Promise<EmployeeDocument> {
    const row = assertOwnedByOrg(await this.file.findDocument(documentId), ws);
    const [doc] = await this.present([row]);
    return doc;
  }

  private async present(rows: DocumentRow[]): Promise<EmployeeDocument[]> {
    const versions = await this.file.versionsOf(rows.map((r) => r.id));
    const today = kigaliToday();
    return rows.map((r) => presentDocument(r, versions.get(r.id) ?? [], today));
  }
}

function normalisePhone(raw: string): string {
  const parsed = RwPhoneNumber.safeParse(raw);
  if (!parsed.success) throw new UnprocessableEntityException('That is not a Rwandan mobile number.');
  return parsed.data;
}

function assertDates(body: { issuedOn?: string | null; expiresOn?: string | null }): void {
  for (const value of [body.issuedOn, body.expiresOn]) {
    if (value && !isCalendarDate(value)) throw new UnprocessableEntityException('That is not a real date.');
  }
  if (body.issuedOn && body.expiresOn && body.expiresOn < body.issuedOn) {
    throw new UnprocessableEntityException('A document cannot expire before it was issued.');
  }
}

function datesOf(body: { issuedOn?: string | null; expiresOn?: string | null; remindDaysBefore?: number | null }): {
  issuedOn?: string | null;
  expiresOn?: string | null;
  remindDaysBefore?: number | null;
} {
  return {
    ...(body.issuedOn !== undefined ? { issuedOn: body.issuedOn } : {}),
    ...(body.expiresOn !== undefined ? { expiresOn: body.expiresOn } : {}),
    ...(body.remindDaysBefore !== undefined ? { remindDaysBefore: body.remindDaysBefore } : {}),
  };
}

/** A requested document's file must be a format the request named, and fit its size. */
function checkAgainstRequest(document: DocumentRow, object: { mime: string | null; sizeBytes: number | null } | undefined): void {
  if (!document.formats || !object) return;
  const allowed: string[] = document.formats.map((f) => DOCUMENT_FORMAT_MIME[f as DocumentFormat]);
  if (!object.mime || !allowed.includes(object.mime)) {
    throw new UnprocessableEntityException(`This request takes ${document.formats.join(', ')} files only.`);
  }
  if (document.maxMb && object.sizeBytes && object.sizeBytes > document.maxMb * 1024 * 1024) {
    throw new UnprocessableEntityException(`This request takes files up to ${document.maxMb} MB.`);
  }
}

function presentAccount(row: PayAccountRow): PayAccount {
  return {
    id: row.id,
    employeeId: row.employeeId,
    kind: row.kind,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    branchName: row.branchName,
    momoPhone: row.momoPhone,
    isPrimary: row.isPrimary,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function presentNote(row: { id: string; body: string; fileKeys: string[]; authorName: string | null; createdAt: Date }): EmployeeNote {
  return {
    id: row.id,
    body: row.body,
    fileKeys: row.fileKeys,
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
  };
}

function presentDocument(row: DocumentRow, versions: VersionRow[], today: string): EmployeeDocument {
  return {
    id: row.id,
    employee: rosterCard({
      id: row.employeeId,
      preferredName: row.preferredName,
      legalName: row.legalName,
      jobPositionTitle: row.jobPositionTitle,
    }),
    requestId: row.requestId,
    title: row.title,
    status: row.status,
    // Computed, never stored: a stored "expired" goes stale the night the job fails (AC-PF5).
    expired: row.expiresOn !== null && row.expiresOn < today,
    rejectReason: row.rejectReason,
    issuedOn: row.issuedOn,
    expiresOn: row.expiresOn,
    remindDaysBefore: row.remindDaysBefore,
    formats: (row.formats ?? ['pdf', 'jpg', 'png', 'heic']) as DocumentFormat[],
    maxMb: row.maxMb ?? 10,
    dueOn: row.dueOn,
    versions: versions.map((v) => ({
      id: v.id,
      uploadedAt: v.uploadedAt.toISOString(),
      uploadedByName: v.uploadedByName,
      status: v.status,
      rejectReason: v.rejectReason,
    })),
    updatedAt: row.updatedAt.toISOString(),
  };
}
