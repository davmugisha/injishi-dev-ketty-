import type { DisciplinaryKind, HrCatalogKind, HrTargets, TagTone } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import {
  departments,
  disciplinaryActions,
  disciplinaryTypes,
  employeeTags,
  employeeTypes,
  employees,
  hrSettings,
  jobPositions,
  staffAnnouncementAudiences,
  staffAnnouncementComments,
  staffAnnouncementViews,
  staffAnnouncements,
  staffPolicies,
  staffPolicyAudiences,
  users,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { Tx } from './employees.repository';

export interface CatalogRow {
  id: string;
  orgId: string;
  title: string;
  status: 'active' | 'archived';
  tone?: TagTone;
  kind?: DisciplinaryKind;
}

export interface PolicyRow {
  id: string;
  orgId: string;
  title: string;
  body: string;
  fileKeys: string[];
  audience: 'all' | 'targeted';
  status: 'published' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface AnnouncementRow extends PolicyRow {
  expiresOn: string | null;
  commentsAllowed: boolean;
  viewCount: number;
  commentCount: number;
}

export interface DisciplineRow {
  id: string;
  orgId: string;
  employeeId: string;
  preferredName: string | null;
  legalName: string;
  jobPositionTitle: string | null;
  workPropertyId: string | null;
  typeId: string;
  typeTitle: string;
  typeKind: DisciplinaryKind;
  description: string;
  unit: 'days' | 'hours' | null;
  length: number | null;
  startsOn: string;
  fileKey: string | null;
  createdAt: Date;
  createdByName: string | null;
}

/** Whose audience rows: a policy's or an announcement's. */
export type AudienceOwner = 'policy' | 'announcement';

/**
 * What a whole business shares in HR (ADR-058, 058-people-file): its catalogs,
 * its HR settings, its policies and staff announcements, and its disciplinary
 * records. The only place that touches Drizzle for them.
 *
 * Nothing here is deleted (AC-PF11): a catalog row, a policy and an announcement
 * are archived. The one exception is an audience row, which says who something
 * is for NOW and is replaced as a set.
 */
@Injectable()
export class HrContentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Catalogs (AC-PF11) --------------------------------------------------------

  /** A business's rows of one catalog, active first, then by title. */
  async catalog(kind: HrCatalogKind, orgId: string): Promise<CatalogRow[]> {
    switch (kind) {
      case 'tags':
        return this.db
          .select({
            id: employeeTags.id,
            orgId: employeeTags.orgId,
            title: employeeTags.title,
            status: employeeTags.status,
            tone: employeeTags.tone,
          })
          .from(employeeTags)
          .where(eq(employeeTags.orgId, orgId))
          .orderBy(asc(employeeTags.status), asc(sql`lower(${employeeTags.title})`));
      case 'disciplinary-types':
        return this.db
          .select({
            id: disciplinaryTypes.id,
            orgId: disciplinaryTypes.orgId,
            title: disciplinaryTypes.title,
            status: disciplinaryTypes.status,
            kind: disciplinaryTypes.kind,
          })
          .from(disciplinaryTypes)
          .where(eq(disciplinaryTypes.orgId, orgId))
          .orderBy(asc(disciplinaryTypes.status), asc(sql`lower(${disciplinaryTypes.title})`));
      case 'job-positions':
        return this.db
          .select({ id: jobPositions.id, orgId: jobPositions.orgId, title: jobPositions.title, status: jobPositions.status })
          .from(jobPositions)
          .where(eq(jobPositions.orgId, orgId))
          .orderBy(asc(jobPositions.status), asc(sql`lower(${jobPositions.title})`));
      case 'employee-types':
        return this.db
          .select({ id: employeeTypes.id, orgId: employeeTypes.orgId, title: employeeTypes.title, status: employeeTypes.status })
          .from(employeeTypes)
          .where(eq(employeeTypes.orgId, orgId))
          .orderBy(asc(employeeTypes.status), asc(sql`lower(${employeeTypes.title})`));
    }
  }

  async findCatalog(kind: HrCatalogKind, id: string, tx?: Tx): Promise<CatalogRow | null> {
    const db = tx ?? this.db;
    let rows: CatalogRow[];
    switch (kind) {
      case 'tags':
        rows = await db
          .select({
            id: employeeTags.id,
            orgId: employeeTags.orgId,
            title: employeeTags.title,
            status: employeeTags.status,
            tone: employeeTags.tone,
          })
          .from(employeeTags)
          .where(eq(employeeTags.id, id))
          .limit(1);
        break;
      case 'disciplinary-types':
        rows = await db
          .select({
            id: disciplinaryTypes.id,
            orgId: disciplinaryTypes.orgId,
            title: disciplinaryTypes.title,
            status: disciplinaryTypes.status,
            kind: disciplinaryTypes.kind,
          })
          .from(disciplinaryTypes)
          .where(eq(disciplinaryTypes.id, id))
          .limit(1);
        break;
      case 'job-positions':
        rows = await db
          .select({ id: jobPositions.id, orgId: jobPositions.orgId, title: jobPositions.title, status: jobPositions.status })
          .from(jobPositions)
          .where(eq(jobPositions.id, id))
          .limit(1);
        break;
      case 'employee-types':
        rows = await db
          .select({ id: employeeTypes.id, orgId: employeeTypes.orgId, title: employeeTypes.title, status: employeeTypes.status })
          .from(employeeTypes)
          .where(eq(employeeTypes.id, id))
          .limit(1);
        break;
    }
    return rows[0] ?? null;
  }

  async insertCatalog(
    tx: Tx,
    kind: HrCatalogKind,
    values: { orgId: string; title: string; tone?: TagTone; kind?: DisciplinaryKind },
  ): Promise<string> {
    switch (kind) {
      case 'tags': {
        const [row] = await tx
          .insert(employeeTags)
          .values({ orgId: values.orgId, title: values.title, tone: values.tone ?? 'neutral' })
          .returning({ id: employeeTags.id });
        return row.id;
      }
      case 'disciplinary-types': {
        const [row] = await tx
          .insert(disciplinaryTypes)
          .values({ orgId: values.orgId, title: values.title, kind: values.kind ?? 'warning' })
          .returning({ id: disciplinaryTypes.id });
        return row.id;
      }
      case 'job-positions': {
        const [row] = await tx
          .insert(jobPositions)
          .values({ orgId: values.orgId, title: values.title })
          .returning({ id: jobPositions.id });
        return row.id;
      }
      case 'employee-types': {
        const [row] = await tx
          .insert(employeeTypes)
          .values({ orgId: values.orgId, title: values.title })
          .returning({ id: employeeTypes.id });
        return row.id;
      }
    }
  }

  async updateCatalog(
    tx: Tx,
    kind: HrCatalogKind,
    id: string,
    values: { title?: string; status?: 'active' | 'archived'; tone?: TagTone; kind?: DisciplinaryKind },
  ): Promise<void> {
    const common = {
      ...(values.title !== undefined ? { title: values.title } : {}),
      ...(values.status !== undefined ? { status: values.status } : {}),
      updatedAt: new Date(),
    };
    switch (kind) {
      case 'tags':
        await tx
          .update(employeeTags)
          .set({ ...common, ...(values.tone !== undefined ? { tone: values.tone } : {}) })
          .where(eq(employeeTags.id, id));
        return;
      case 'disciplinary-types':
        await tx
          .update(disciplinaryTypes)
          .set({ ...common, ...(values.kind !== undefined ? { kind: values.kind } : {}) })
          .where(eq(disciplinaryTypes.id, id));
        return;
      case 'job-positions':
        await tx.update(jobPositions).set(common).where(eq(jobPositions.id, id));
        return;
      case 'employee-types':
        await tx.update(employeeTypes).set(common).where(eq(employeeTypes.id, id));
        return;
    }
  }

  /** Has any record been written under this disciplinary type? Its kind is then history. */
  async disciplinaryTypeUsed(typeId: string, tx?: Tx): Promise<boolean> {
    const [row] = await (tx ?? this.db)
      .select({ id: disciplinaryActions.id })
      .from(disciplinaryActions)
      .where(eq(disciplinaryActions.typeId, typeId))
      .limit(1);
    return !!row;
  }

  // --- Settings (AC-PF12) -------------------------------------------------------

  async settings(orgId: string): Promise<{ employeeNumberPrefix: string | null; payRunAutoDraftDay: number | null; rssbEmployerNumber: string | null }> {
    const [row] = await this.db
      .select({
        employeeNumberPrefix: hrSettings.employeeNumberPrefix,
        payRunAutoDraftDay: hrSettings.payRunAutoDraftDay,
        rssbEmployerNumber: hrSettings.rssbEmployerNumber,
      })
      .from(hrSettings)
      .where(eq(hrSettings.orgId, orgId))
      .limit(1);
    return {
      employeeNumberPrefix: row?.employeeNumberPrefix ?? null,
      payRunAutoDraftDay: row?.payRunAutoDraftDay ?? null,
      rssbEmployerNumber: row?.rssbEmployerNumber ?? null,
    };
  }

  /** 058-payroll AC-PY14: the automatic draft day and the RSSB employer number, written on first use. */
  async setPayrollSettings(tx: Tx, orgId: string, values: { payRunAutoDraftDay?: number | null; rssbEmployerNumber?: string | null }): Promise<void> {
    if (Object.keys(values).length === 0) return;
    await tx
      .insert(hrSettings)
      .values({ orgId, ...values })
      .onConflictDoUpdate({ target: hrSettings.orgId, set: { ...values, updatedAt: new Date() } });
  }

  /** One row per business, written on first use (index contract 13). */
  async setNumberPrefix(tx: Tx, orgId: string, prefix: string | null): Promise<void> {
    await tx
      .insert(hrSettings)
      .values({ orgId, employeeNumberPrefix: prefix })
      .onConflictDoUpdate({
        target: hrSettings.orgId,
        set: { employeeNumberPrefix: prefix, updatedAt: new Date() },
      });
  }

  // --- Audiences (AC-PF7, AC-PF9) -------------------------------------------------

  /** Who each policy or announcement names, as three id lists. */
  async targetsOf(owner: AudienceOwner, ids: readonly string[]): Promise<Map<string, HrTargets>> {
    const out = new Map<string, HrTargets>();
    if (ids.length === 0) return out;
    const rows =
      owner === 'policy'
        ? await this.db
            .select({
              ownerId: staffPolicyAudiences.policyId,
              departmentId: staffPolicyAudiences.departmentId,
              jobPositionId: staffPolicyAudiences.jobPositionId,
              employeeId: staffPolicyAudiences.employeeId,
            })
            .from(staffPolicyAudiences)
            .where(inArray(staffPolicyAudiences.policyId, [...ids]))
        : await this.db
            .select({
              ownerId: staffAnnouncementAudiences.announcementId,
              departmentId: staffAnnouncementAudiences.departmentId,
              jobPositionId: staffAnnouncementAudiences.jobPositionId,
              employeeId: staffAnnouncementAudiences.employeeId,
            })
            .from(staffAnnouncementAudiences)
            .where(inArray(staffAnnouncementAudiences.announcementId, [...ids]));
    for (const r of rows) {
      const t = out.get(r.ownerId) ?? { departmentIds: [], jobPositionIds: [], employeeIds: [] };
      if (r.departmentId) t.departmentIds.push(r.departmentId);
      if (r.jobPositionId) t.jobPositionIds.push(r.jobPositionId);
      if (r.employeeId) t.employeeIds.push(r.employeeId);
      out.set(r.ownerId, t);
    }
    return out;
  }

  /** Replace the audience as a set: an audience row says who it is for now, not who it was for. */
  async setTargets(tx: Tx, owner: AudienceOwner, orgId: string, ownerId: string, targets: HrTargets | null): Promise<void> {
    const rows = targets
      ? [
          ...[...new Set(targets.departmentIds)].map((departmentId) => ({ departmentId })),
          ...[...new Set(targets.jobPositionIds)].map((jobPositionId) => ({ jobPositionId })),
          ...[...new Set(targets.employeeIds)].map((employeeId) => ({ employeeId })),
        ]
      : [];
    if (owner === 'policy') {
      await tx.delete(staffPolicyAudiences).where(eq(staffPolicyAudiences.policyId, ownerId));
      if (rows.length > 0) {
        await tx.insert(staffPolicyAudiences).values(rows.map((r) => ({ orgId, policyId: ownerId, ...r })));
      }
    } else {
      await tx.delete(staffAnnouncementAudiences).where(eq(staffAnnouncementAudiences.announcementId, ownerId));
      if (rows.length > 0) {
        await tx
          .insert(staffAnnouncementAudiences)
          .values(rows.map((r) => ({ orgId, announcementId: ownerId, ...r })));
      }
    }
  }

  /** Of these ids, the business's departments. */
  async departmentIdsOf(orgId: string, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.orgId, orgId), inArray(departments.id, [...ids])));
    return new Set(rows.map((r) => r.id));
  }

  /** Of these ids, the business's job positions, archived ones included: they may already be named. */
  async positionIdsOf(orgId: string, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db
      .select({ id: jobPositions.id })
      .from(jobPositions)
      .where(and(eq(jobPositions.orgId, orgId), inArray(jobPositions.id, [...ids])));
    return new Set(rows.map((r) => r.id));
  }

  // --- Policies (AC-PF7) ------------------------------------------------------------

  private readonly policyColumns = {
    id: staffPolicies.id,
    orgId: staffPolicies.orgId,
    title: staffPolicies.title,
    body: staffPolicies.body,
    fileKeys: staffPolicies.fileKeys,
    audience: staffPolicies.audience,
    status: staffPolicies.status,
    createdAt: staffPolicies.createdAt,
    updatedAt: staffPolicies.updatedAt,
  };

  /** A business's policies: published first, newest first. */
  async policies(orgId: string): Promise<PolicyRow[]> {
    return this.db
      .select(this.policyColumns)
      .from(staffPolicies)
      .where(eq(staffPolicies.orgId, orgId))
      .orderBy(asc(staffPolicies.status), desc(staffPolicies.updatedAt));
  }

  async findPolicy(id: string, tx?: Tx): Promise<PolicyRow | null> {
    const [row] = await (tx ?? this.db).select(this.policyColumns).from(staffPolicies).where(eq(staffPolicies.id, id)).limit(1);
    return row ?? null;
  }

  async insertPolicy(
    tx: Tx,
    values: { orgId: string; title: string; body: string; fileKeys: string[]; audience: 'all' | 'targeted'; createdByUserId: string },
  ): Promise<string> {
    const [row] = await tx.insert(staffPolicies).values(values).returning({ id: staffPolicies.id });
    return row.id;
  }

  async updatePolicy(
    tx: Tx,
    id: string,
    values: { title?: string; body?: string; fileKeys?: string[]; audience?: 'all' | 'targeted'; status?: 'published' | 'archived' },
  ): Promise<void> {
    await tx
      .update(staffPolicies)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(staffPolicies.id, id));
  }

  // --- Staff announcements (AC-PF9) ----------------------------------------------------

  private readonly announcementColumns = {
    id: staffAnnouncements.id,
    orgId: staffAnnouncements.orgId,
    title: staffAnnouncements.title,
    body: staffAnnouncements.body,
    fileKeys: staffAnnouncements.fileKeys,
    audience: staffAnnouncements.audience,
    expiresOn: staffAnnouncements.expiresOn,
    commentsAllowed: staffAnnouncements.commentsAllowed,
    status: staffAnnouncements.status,
    createdAt: staffAnnouncements.createdAt,
    updatedAt: staffAnnouncements.updatedAt,
    viewCount: sql<number>`(select count(*)::int from ${staffAnnouncementViews} v where v.announcement_id = ${staffAnnouncements.id})`,
    commentCount: sql<number>`(select count(*)::int from ${staffAnnouncementComments} c where c.announcement_id = ${staffAnnouncements.id})`,
  };

  /** A business's announcements: published first, newest first. */
  async announcements(orgId: string): Promise<AnnouncementRow[]> {
    return this.db
      .select(this.announcementColumns)
      .from(staffAnnouncements)
      .where(eq(staffAnnouncements.orgId, orgId))
      .orderBy(asc(staffAnnouncements.status), desc(staffAnnouncements.createdAt));
  }

  async findAnnouncement(id: string, tx?: Tx): Promise<AnnouncementRow | null> {
    const [row] = await (tx ?? this.db)
      .select(this.announcementColumns)
      .from(staffAnnouncements)
      .where(eq(staffAnnouncements.id, id))
      .limit(1);
    return row ?? null;
  }

  async insertAnnouncement(
    tx: Tx,
    values: {
      orgId: string;
      title: string;
      body: string;
      fileKeys: string[];
      audience: 'all' | 'targeted';
      expiresOn: string | null;
      commentsAllowed: boolean;
      createdByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(staffAnnouncements).values(values).returning({ id: staffAnnouncements.id });
    return row.id;
  }

  async updateAnnouncement(
    tx: Tx,
    id: string,
    values: {
      title?: string;
      body?: string;
      fileKeys?: string[];
      audience?: 'all' | 'targeted';
      expiresOn?: string | null;
      commentsAllowed?: boolean;
      status?: 'published' | 'archived';
    },
  ): Promise<void> {
    await tx
      .update(staffAnnouncements)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(staffAnnouncements.id, id));
  }

  // --- Discipline (AC-PF8) ------------------------------------------------------------

  // The joined select builder's type is drizzle's to spell, and every caller
  // narrows it to its row type; writing it out would only restate drizzle.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private discipline() {
    return this.db
      .select({
        id: disciplinaryActions.id,
        orgId: disciplinaryActions.orgId,
        employeeId: disciplinaryActions.employeeId,
        preferredName: employees.preferredName,
        legalName: employees.legalName,
        jobPositionTitle: jobPositions.title,
        workPropertyId: employees.workPropertyId,
        typeId: disciplinaryActions.typeId,
        typeTitle: disciplinaryTypes.title,
        typeKind: disciplinaryTypes.kind,
        description: disciplinaryActions.description,
        unit: disciplinaryActions.unit,
        length: disciplinaryActions.length,
        startsOn: disciplinaryActions.startsOn,
        fileKey: disciplinaryActions.fileKey,
        createdAt: disciplinaryActions.createdAt,
        createdByName: users.name,
      })
      .from(disciplinaryActions)
      .innerJoin(employees, eq(employees.id, disciplinaryActions.employeeId))
      .innerJoin(disciplinaryTypes, eq(disciplinaryTypes.id, disciplinaryActions.typeId))
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .leftJoin(users, eq(users.id, disciplinaryActions.createdByUserId));
  }

  /** The business's records in the caller's branches, newest first; one person's when named. */
  async disciplinaryActions(input: { orgId: string; scope: BranchScope; employeeId?: string }): Promise<DisciplineRow[]> {
    const where = [eq(disciplinaryActions.orgId, input.orgId), inBranchScope(employees.workPropertyId, input.scope)];
    if (input.employeeId) where.push(eq(disciplinaryActions.employeeId, input.employeeId));
    return this.discipline()
      .where(and(...where))
      .orderBy(desc(disciplinaryActions.startsOn), desc(disciplinaryActions.createdAt))
      .limit(500) as Promise<DisciplineRow[]>;
  }

  async findDisciplinaryActions(ids: readonly string[]): Promise<DisciplineRow[]> {
    if (ids.length === 0) return [];
    return this.discipline()
      .where(inArray(disciplinaryActions.id, [...ids]))
      .orderBy(asc(employees.legalName)) as Promise<DisciplineRow[]>;
  }

  async insertDisciplinaryAction(
    tx: Tx,
    values: {
      orgId: string;
      employeeId: string;
      typeId: string;
      description: string;
      unit: 'days' | 'hours' | null;
      length: number | null;
      startsOn: string;
      fileKey: string | null;
      createdByUserId: string;
    },
  ): Promise<string> {
    const [row] = await tx.insert(disciplinaryActions).values(values).returning({ id: disciplinaryActions.id });
    return row.id;
  }
}
