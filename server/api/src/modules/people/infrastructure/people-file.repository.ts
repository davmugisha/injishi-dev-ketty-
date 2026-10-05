import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lte, ne, sql, type SQL } from 'drizzle-orm';

import {
  documentRequests,
  employeeDocumentVersions,
  employeeDocuments,
  employeeNotes,
  employeePayAccounts,
  employees,
  jobPositions,
  users,
  workspaces,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Tx } from './employees.repository';

export interface PayAccountRow {
  id: string;
  orgId: string;
  employeeId: string;
  kind: 'bank' | 'momo';
  bankName: string | null;
  accountNumber: string | null;
  branchName: string | null;
  momoPhone: string | null;
  isPrimary: boolean;
  status: 'active' | 'retired';
  createdAt: Date;
}

export interface NoteRow {
  id: string;
  body: string;
  fileKeys: string[];
  authorName: string | null;
  createdAt: Date;
}

export interface DocumentRow {
  id: string;
  orgId: string;
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  requestId: string | null;
  title: string;
  status: 'requested' | 'submitted' | 'approved' | 'rejected';
  rejectReason: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  remindDaysBefore: number | null;
  remindedAt: Date | null;
  formats: string[] | null;
  maxMb: number | null;
  dueOn: string | null;
  updatedAt: Date;
}

export interface VersionRow {
  id: string;
  documentId: string;
  fileKey: string;
  uploadedAt: Date;
  uploadedByName: string | null;
  status: 'submitted' | 'approved' | 'rejected';
  rejectReason: string | null;
}

/**
 * Pay accounts, notes and documents of the people file (ADR-058,
 * 058-people-file). The only place that touches Drizzle for them.
 *
 * The operator repository split: a LIST is narrowed by org and branch in its
 * `where`; a SINGLE ROW is read unscoped so the service can prove it belongs
 * to the caller's business and answer 404.
 */
@Injectable()
export class PeopleFileRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Pay accounts (AC-PF3) -----------------------------------------------------

  private readonly accountColumns = {
    id: employeePayAccounts.id,
    orgId: employeePayAccounts.orgId,
    employeeId: employeePayAccounts.employeeId,
    kind: employeePayAccounts.kind,
    bankName: employeePayAccounts.bankName,
    accountNumber: employeePayAccounts.accountNumber,
    branchName: employeePayAccounts.branchName,
    momoPhone: employeePayAccounts.momoPhone,
    isPrimary: employeePayAccounts.isPrimary,
    status: employeePayAccounts.status,
    createdAt: employeePayAccounts.createdAt,
  };

  /** A person's accounts: the primary first, retired ones last. */
  async accountsOf(employeeId: string, tx?: Tx): Promise<PayAccountRow[]> {
    return (tx ?? this.db)
      .select(this.accountColumns)
      .from(employeePayAccounts)
      .where(eq(employeePayAccounts.employeeId, employeeId))
      .orderBy(
        desc(employeePayAccounts.isPrimary),
        sql`${employeePayAccounts.status} = 'active' desc`,
        desc(employeePayAccounts.createdAt),
      );
  }

  async findAccount(id: string, tx?: Tx): Promise<PayAccountRow | null> {
    const [row] = await (tx ?? this.db)
      .select(this.accountColumns)
      .from(employeePayAccounts)
      .where(eq(employeePayAccounts.id, id))
      .limit(1);
    return row ?? null;
  }

  async insertAccount(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      kind: 'bank' | 'momo';
      bankName: string | null;
      accountNumber: string | null;
      branchName: string | null;
      momoPhone: string | null;
      isPrimary: boolean;
      createdByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(employeePayAccounts).values(values).returning({ id: employeePayAccounts.id });
    return row.id;
  }

  /** Take the primary flag off the person's current primary account, if any. */
  async clearPrimary(tx: Tx, employeeId: string): Promise<string | null> {
    const rows = await tx
      .update(employeePayAccounts)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(employeePayAccounts.employeeId, employeeId), eq(employeePayAccounts.isPrimary, true)))
      .returning({ id: employeePayAccounts.id });
    return rows[0]?.id ?? null;
  }

  async setAccount(tx: Tx, id: string, values: { isPrimary?: boolean; status?: 'active' | 'retired' }): Promise<void> {
    await tx
      .update(employeePayAccounts)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(employeePayAccounts.id, id));
  }

  // --- Notes (AC-PF6) -----------------------------------------------------------

  async notesOf(employeeId: string): Promise<NoteRow[]> {
    return this.db
      .select({
        id: employeeNotes.id,
        body: employeeNotes.body,
        fileKeys: employeeNotes.fileKeys,
        authorName: users.name,
        createdAt: employeeNotes.createdAt,
      })
      .from(employeeNotes)
      .leftJoin(users, eq(users.id, employeeNotes.authorUserId))
      .where(eq(employeeNotes.employeeId, employeeId))
      .orderBy(desc(employeeNotes.createdAt));
  }

  async insertNote(
    tx: Tx,
    values: { orgId: string; employeeId: string; body: string; fileKeys: string[]; authorUserId: string },
  ): Promise<string> {
    const [row] = await tx.insert(employeeNotes).values(values).returning({ id: employeeNotes.id });
    return row.id;
  }

  // --- Documents (AC-PF4, AC-PF5) ------------------------------------------------

  private readonly documentColumns = {
    id: employeeDocuments.id,
    orgId: employeeDocuments.orgId,
    employeeId: employeeDocuments.employeeId,
    preferredName: employees.preferredName,
    legalName: employees.legalName,
    jobPositionTitle: jobPositions.title,
    workPropertyId: employees.workPropertyId,
    requestId: employeeDocuments.requestId,
    title: employeeDocuments.title,
    status: employeeDocuments.status,
    rejectReason: employeeDocuments.rejectReason,
    issuedOn: employeeDocuments.issuedOn,
    expiresOn: employeeDocuments.expiresOn,
    remindDaysBefore: employeeDocuments.remindDaysBefore,
    remindedAt: employeeDocuments.remindedAt,
    formats: documentRequests.formats,
    maxMb: documentRequests.maxMb,
    dueOn: documentRequests.dueOn,
    updatedAt: employeeDocuments.updatedAt,
  };

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private documents(tx?: Tx) {
    return (tx ?? this.db)
      .select(this.documentColumns)
      .from(employeeDocuments)
      .innerJoin(employees, eq(employees.id, employeeDocuments.employeeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(documentRequests, eq(documentRequests.id, employeeDocuments.requestId));
  }

  async documentsOf(employeeId: string): Promise<DocumentRow[]> {
    return this.documents()
      .where(eq(employeeDocuments.employeeId, employeeId))
      .orderBy(desc(employeeDocuments.updatedAt)) as Promise<DocumentRow[]>;
  }

  /** Every document of the business in the caller's branches, for the Documents lens. */
  async documentsInScope(input: {
    orgId: string;
    scope: BranchScope;
    status?: 'requested' | 'submitted' | 'approved' | 'rejected';
    requestId?: string;
  }): Promise<DocumentRow[]> {
    const where = [eq(employeeDocuments.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope)];
    if (input.status) where.push(eq(employeeDocuments.status, input.status));
    if (input.requestId) where.push(eq(employeeDocuments.requestId, input.requestId));
    return this.documents()
      .where(and(...where))
      .orderBy(desc(employeeDocuments.updatedAt))
      .limit(500) as Promise<DocumentRow[]>;
  }

  async findDocument(id: string, tx?: Tx): Promise<DocumentRow | null> {
    const [row] = await this.documents(tx).where(eq(employeeDocuments.id, id)).limit(1);
    return (row as DocumentRow | undefined) ?? null;
  }

  /** Lock one document row for a decision or an upload, so two cannot race. */
  async lockDocument(tx: Tx, id: string): Promise<boolean> {
    const [row] = await tx
      .select({ id: employeeDocuments.id })
      .from(employeeDocuments)
      .where(eq(employeeDocuments.id, id))
      .for('update')
      .limit(1);
    return !!row;
  }

  async versionsOf(documentIds: readonly string[]): Promise<Map<string, VersionRow[]>> {
    const out = new Map<string, VersionRow[]>();
    if (documentIds.length === 0) return out;
    const rows = await this.db
      .select({
        id: employeeDocumentVersions.id,
        documentId: employeeDocumentVersions.documentId,
        fileKey: employeeDocumentVersions.fileKey,
        uploadedAt: employeeDocumentVersions.uploadedAt,
        uploadedByName: users.name,
        status: employeeDocumentVersions.status,
        rejectReason: employeeDocumentVersions.rejectReason,
      })
      .from(employeeDocumentVersions)
      .leftJoin(users, eq(users.id, employeeDocumentVersions.uploadedByUserId))
      .where(inArray(employeeDocumentVersions.documentId, [...documentIds]))
      .orderBy(desc(employeeDocumentVersions.uploadedAt));
    for (const r of rows) {
      const list = out.get(r.documentId) ?? [];
      list.push(r);
      out.set(r.documentId, list);
    }
    return out;
  }

  /** The newest file of a document: the one a decision is about and a link opens. */
  async newestVersion(tx: Tx | Database, documentId: string): Promise<{ id: string; fileKey: string; status: string } | null> {
    const [row] = await tx
      .select({
        id: employeeDocumentVersions.id,
        fileKey: employeeDocumentVersions.fileKey,
        status: employeeDocumentVersions.status,
      })
      .from(employeeDocumentVersions)
      .where(eq(employeeDocumentVersions.documentId, documentId))
      .orderBy(desc(employeeDocumentVersions.uploadedAt), desc(employeeDocumentVersions.id))
      .limit(1);
    return row ?? null;
  }

  async insertDocument(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      requestId: string | null;
      title: string;
      status: 'requested' | 'submitted';
      issuedOn?: string | null;
      expiresOn?: string | null;
      remindDaysBefore?: number | null;
    },
  ): Promise<string> {
    const [row] = await tx.insert(employeeDocuments).values(values).returning({ id: employeeDocuments.id });
    return row.id;
  }

  async updateDocument(
    tx: Tx,
    id: string,
    values: {
      status?: 'requested' | 'submitted' | 'approved' | 'rejected';
      rejectReason?: string | null;
      issuedOn?: string | null;
      expiresOn?: string | null;
      remindDaysBefore?: number | null;
      remindedAt?: Date | null;
    },
  ): Promise<void> {
    await tx
      .update(employeeDocuments)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(employeeDocuments.id, id));
  }

  async insertVersion(
    tx: Tx,
    values: { orgId: string; documentId: string; fileKey: string; uploadedByUserId: string },
  ): Promise<string> {
    const [row] = await tx
      .insert(employeeDocumentVersions)
      .values(values)
      .returning({ id: employeeDocumentVersions.id });
    return row.id;
  }

  async decideVersion(
    tx: Tx,
    id: string,
    values: { status: 'approved' | 'rejected'; rejectReason: string | null; decidedByUserId: string },
  ): Promise<void> {
    await tx
      .update(employeeDocumentVersions)
      .set({ ...values, decidedAt: new Date() })
      .where(eq(employeeDocumentVersions.id, id));
  }

  // --- Requests (AC-PF4) ---------------------------------------------------------

  async insertRequest(
    tx: Tx,
    values: {
      orgId: string;
      title: string;
      description: string | null;
      formats: string[];
      maxMb: number;
      dueOn: string | null;
      createdByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(documentRequests).values(values).returning({ id: documentRequests.id });
    return row.id;
  }

  /** A business's requests, newest first, each with how its documents stand. */
  async requests(orgId: string, scope: BranchScope): Promise<
    {
      id: string;
      title: string;
      description: string | null;
      formats: string[];
      maxMb: number;
      dueOn: string | null;
      createdAt: Date;
      requested: number;
      submitted: number;
      approved: number;
      rejected: number;
    }[]
  > {
    const count = (status: string): SQL<number> =>
      sql<number>`count(*) filter (where ${employeeDocuments.status} = ${status})::int`;
    return this.db
      .select({
        id: documentRequests.id,
        title: documentRequests.title,
        description: documentRequests.description,
        formats: documentRequests.formats,
        maxMb: documentRequests.maxMb,
        dueOn: documentRequests.dueOn,
        createdAt: documentRequests.createdAt,
        requested: count('requested'),
        submitted: count('submitted'),
        approved: count('approved'),
        rejected: count('rejected'),
      })
      .from(documentRequests)
      .leftJoin(employeeDocuments, eq(employeeDocuments.requestId, documentRequests.id))
      .leftJoin(employees, eq(employees.id, employeeDocuments.employeeId))
      // A request counts the documents of people in the caller's branches only.
      .where(and(eq(documentRequests.orgId, orgId), sql`(${employees.id} IS NULL OR ${inBranchScope(employees.workPropertyId, scope) ?? sql`true`})`))
      .groupBy(documentRequests.id)
      .orderBy(desc(documentRequests.createdAt));
  }

  // --- The daily reminder (AC-PF5) ---------------------------------------------------

  /**
   * Documents whose reminder is due today and not yet raised: an expiry date and
   * a lead, `expires_on − remind_days_before <= today`, not refused, never
   * reminded since their dates last moved.
   */
  async dueReminders(
    today: string,
    limit = 500,
  ): Promise<{ id: string; orgId: string; employeeId: string; workspaceId: string | null; expiresOn: string | null; remindDaysBefore: number | null }[]> {
    return this.db
      .select({
        id: employeeDocuments.id,
        orgId: employeeDocuments.orgId,
        employeeId: employeeDocuments.employeeId,
        expiresOn: employeeDocuments.expiresOn,
        remindDaysBefore: employeeDocuments.remindDaysBefore,
        // One business workspace per org (workspaces_business_org_uk): the outbox row's workspace.
        workspaceId: workspaces.id,
      })
      .from(employeeDocuments)
      .leftJoin(workspaces, and(eq(workspaces.orgId, employeeDocuments.orgId), eq(workspaces.kind, 'business')))
      .where(
        and(
          isNull(employeeDocuments.remindedAt),
          sql`${employeeDocuments.expiresOn} IS NOT NULL`,
          sql`${employeeDocuments.remindDaysBefore} IS NOT NULL`,
          ne(employeeDocuments.status, 'rejected'),
          lte(sql`(${employeeDocuments.expiresOn} - ${employeeDocuments.remindDaysBefore})`, sql`${today}::date`),
        ),
      )
      .orderBy(asc(employeeDocuments.expiresOn))
      .limit(limit);
  }

  /** Mark a reminder raised, once: a second run finds it already marked. */
  async markReminded(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
      .update(employeeDocuments)
      .set({ remindedAt: new Date() })
      .where(and(eq(employeeDocuments.id, id), isNull(employeeDocuments.remindedAt)))
      .returning({ id: employeeDocuments.id });
    return rows.length > 0;
  }
}
