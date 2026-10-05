import type {
  CreateDisciplinaryActionRequest,
  CreateDisciplinaryActionResponse,
  CreateHrCatalogItemRequest,
  CreateStaffAnnouncementRequest,
  CreateStaffPolicyRequest,
  DisciplinaryAction,
  DisciplinaryActionList,
  FileLink,
  HrCatalogItem,
  HrCatalogKind,
  HrCatalogList,
  HrSettings,
  HrTargets,
  OrgChart,
  StaffAnnouncement,
  StaffAnnouncementList,
  StaffPolicy,
  StaffPolicyList,
  UpdateHrCatalogItemRequest,
  UpdateHrSettingsRequest,
  UpdateStaffAnnouncementRequest,
  UpdateStaffPolicyRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
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
import { EmployeesRepository, violatedConstraint } from '../infrastructure/employees.repository';
import {
  HrContentRepository,
  type AnnouncementRow,
  type AudienceOwner,
  type CatalogRow,
  type DisciplineRow,
  type PolicyRow,
} from '../infrastructure/hr-content.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { writeHrEvent } from '../infrastructure/hr-events';
import { rosterCard } from './employee-presenter';
import { assertPersonInReach, orgOf } from './hr-access';
import { HR_FILE_LINK_SECONDS, HrFilesService } from './hr-files.service';

const NO_TARGETS: HrTargets = { departmentIds: [], jobPositionIds: [], employeeIds: [] };

/**
 * What a whole business shares in HR (ADR-058, 058-people-file): the catalogs
 * (AC-PF11), the HR settings (AC-PF12), policies (AC-PF7), staff announcements
 * (AC-PF9), disciplinary records (AC-PF8) and the org chart (AC-PF10).
 *
 * A policy or an announcement belongs to the business, so its audit row is
 * filed against the org; a disciplinary record belongs to a person, so its row
 * is filed against their file. Discipline is `people.manage`'s alone and
 * follows the caller's branches (AC-PF15).
 */
@Injectable()
export class HrContentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly content: HrContentRepository,
    private readonly employees: EmployeesRepository,
    private readonly files: HrFilesService,
  ) {}

  // --- Catalogs (AC-PF11) -------------------------------------------------------------

  async catalog(ws: ScopedWorkspace, kind: HrCatalogKind): Promise<HrCatalogList> {
    return { items: (await this.content.catalog(kind, orgOf(ws))).map(presentCatalog) };
  }

  async addCatalogItem(
    ws: ScopedWorkspace,
    userId: string,
    kind: HrCatalogKind,
    body: CreateHrCatalogItemRequest,
  ): Promise<HrCatalogItem> {
    const orgId = orgOf(ws);
    assertCatalogFields(kind, body);
    if (kind === 'disciplinary-types' && !body.kind) {
      throw new UnprocessableEntityException('Say whether it is a warning, a suspension or a dismissal.');
    }
    const title = body.title.trim();
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        const created = await this.content.insertCatalog(tx, kind, { orgId, title, tone: body.tone, kind: body.kind });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'org',
          subjectId: orgId,
          eventType: 'hr.catalog_item_added',
          orgId,
          diff: { catalog: { to: kind }, itemId: { to: created }, title: { to: title } },
        });
        return created;
      });
    } catch (error) {
      throw titleTaken(error, title);
    }
    return this.catalogItem(ws, kind, id);
  }

  /** Rename, retone, archive or bring back. Nothing in a catalog is deleted (AC-PF11). */
  async changeCatalogItem(
    ws: ScopedWorkspace,
    userId: string,
    kind: HrCatalogKind,
    id: string,
    body: UpdateHrCatalogItemRequest,
  ): Promise<HrCatalogItem> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.content.findCatalog(kind, id), ws);
    assertCatalogFields(kind, body);
    if (
      kind === 'disciplinary-types' &&
      body.kind !== undefined &&
      body.kind !== row.kind &&
      (await this.content.disciplinaryTypeUsed(row.id))
    ) {
      // A record says "suspension" because its type did; changing the type would rewrite it.
      throw new ConflictException('Records were written under this type, so its kind stays. Archive it and add another.');
    }
    const title = body.title?.trim();
    const changed: Record<string, unknown> = {};
    if (title !== undefined && title !== row.title) changed.title = { from: row.title, to: title };
    if (body.status !== undefined && body.status !== row.status) changed.status = { from: row.status, to: body.status };
    if (body.tone !== undefined && body.tone !== row.tone) changed.tone = { from: row.tone ?? null, to: body.tone };
    if (body.kind !== undefined && body.kind !== row.kind) changed.kind = { from: row.kind ?? null, to: body.kind };
    if (Object.keys(changed).length > 0) {
      try {
        await this.db.transaction(async (tx) => {
          await this.content.updateCatalog(tx, kind, row.id, { title, status: body.status, tone: body.tone, kind: body.kind });
          await writeHrAudit(tx, {
            actorUserId: userId,
            subjectType: 'org',
            subjectId: orgId,
            eventType: body.status === 'archived' ? 'hr.catalog_item_archived' : 'hr.catalog_item_changed',
            orgId,
            diff: { catalog: { to: kind }, itemId: { to: row.id }, ...changed },
          });
        });
      } catch (error) {
        throw titleTaken(error, title ?? row.title);
      }
    }
    return this.catalogItem(ws, kind, row.id);
  }

  private async catalogItem(ws: ScopedWorkspace, kind: HrCatalogKind, id: string): Promise<HrCatalogItem> {
    return presentCatalog(assertOwnedByOrg(await this.content.findCatalog(kind, id), ws));
  }

  // --- Settings (AC-PF12) --------------------------------------------------------------

  settings(ws: ScopedWorkspace): Promise<HrSettings> {
    return this.content.settings(orgOf(ws));
  }

  /**
   * A prefix changes how NEW numbers read; no issued number is renamed
   * (AC-PF12). Only what the body names changes: the payroll settings
   * (058-payroll AC-PY14) ride the same row.
   */
  async updateSettings(ws: ScopedWorkspace, userId: string, body: UpdateHrSettingsRequest): Promise<HrSettings> {
    const orgId = orgOf(ws);
    // The number prefix is the files' and the draft day and employer number
    // are pay's (058-payroll AC-PY14): each field asks its own permission.
    if (body.employeeNumberPrefix !== undefined && !ws.permissions.includes('people.manage')) {
      throw new ForbiddenException('Changing how employee numbers start needs the people.manage permission.');
    }
    if ((body.payRunAutoDraftDay !== undefined || body.rssbEmployerNumber !== undefined) && !ws.permissions.includes('payroll.run')) {
      throw new ForbiddenException('The draft day and the RSSB employer number need the payroll.run permission.');
    }
    const before = await this.content.settings(orgId);
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    if (body.employeeNumberPrefix !== undefined && before.employeeNumberPrefix !== body.employeeNumberPrefix) {
      diff.employeeNumberPrefix = { from: before.employeeNumberPrefix, to: body.employeeNumberPrefix };
    }
    const payroll: { payRunAutoDraftDay?: number | null; rssbEmployerNumber?: string | null } = {};
    if (body.payRunAutoDraftDay !== undefined && body.payRunAutoDraftDay !== before.payRunAutoDraftDay) {
      payroll.payRunAutoDraftDay = body.payRunAutoDraftDay;
      diff.payRunAutoDraftDay = { from: before.payRunAutoDraftDay, to: body.payRunAutoDraftDay };
    }
    if (body.rssbEmployerNumber !== undefined && body.rssbEmployerNumber !== before.rssbEmployerNumber) {
      payroll.rssbEmployerNumber = body.rssbEmployerNumber;
      diff.rssbEmployerNumber = { from: before.rssbEmployerNumber, to: body.rssbEmployerNumber };
    }
    if (Object.keys(diff).length > 0) {
      await this.db.transaction(async (tx) => {
        if (diff.employeeNumberPrefix) await this.content.setNumberPrefix(tx, orgId, body.employeeNumberPrefix ?? null);
        await this.content.setPayrollSettings(tx, orgId, payroll);
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'org',
          subjectId: orgId,
          eventType: 'hr.settings_changed',
          orgId,
          diff,
        });
      });
    }
    return this.content.settings(orgId);
  }

  // --- Policies (AC-PF7) ------------------------------------------------------------------

  async policies(ws: ScopedWorkspace): Promise<StaffPolicyList> {
    const rows = await this.content.policies(orgOf(ws));
    const targets = await this.content.targetsOf('policy', rows.map((r) => r.id));
    return { policies: rows.map((r) => presentPolicy(r, targets.get(r.id))) };
  }

  async createPolicy(ws: ScopedWorkspace, userId: string, body: CreateStaffPolicyRequest): Promise<StaffPolicy> {
    const orgId = orgOf(ws);
    const targets = await this.checkTargets(ws, orgId, body.audience, body.targets);
    const fileKeys = [...new Set(body.fileKeys ?? [])];
    await this.files.assertOwn(ws, 'attachment', fileKeys);
    const id = await this.db.transaction(async (tx) => {
      const created = await this.content.insertPolicy(tx, {
        orgId,
        title: body.title.trim(),
        body: body.body.trim(),
        fileKeys,
        audience: body.audience,
        createdByUserId: userId,
      });
      await this.content.setTargets(tx, 'policy', orgId, created, targets);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.policy_published',
        orgId,
        diff: { policyId: { to: created }, audience: { to: body.audience } },
      });
      return created;
    });
    return this.policy(ws, id);
  }

  async updatePolicy(
    ws: ScopedWorkspace,
    userId: string,
    id: string,
    body: UpdateStaffPolicyRequest,
  ): Promise<StaffPolicy> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.content.findPolicy(id), ws);
    const targets = await this.nextTargets(ws, orgId, 'policy', row, body);
    const fileKeys = await this.nextFileKeys(ws, row.fileKeys, body.fileKeys);
    const values = {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.body !== undefined ? { body: body.body.trim() } : {}),
      ...(fileKeys !== undefined ? { fileKeys } : {}),
      ...(body.audience !== undefined ? { audience: body.audience } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    };
    await this.db.transaction(async (tx) => {
      await this.content.updatePolicy(tx, row.id, values);
      if (targets !== undefined) await this.content.setTargets(tx, 'policy', orgId, row.id, targets);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: body.status === 'archived' ? 'hr.policy_archived' : 'hr.policy_changed',
        orgId,
        // The text is the business's own and can be long: the diff names what moved.
        diff: { policyId: { to: row.id }, fields: { to: Object.keys(body) } },
      });
    });
    return this.policy(ws, row.id);
  }

  /** A policy's attachment, through a five minute link. Policies are the business's, not a person's. */
  async policyFileLink(ws: ScopedWorkspace, id: string, index: number): Promise<FileLink> {
    const row = assertOwnedByOrg(await this.content.findPolicy(id), ws);
    return this.linkAt(row.fileKeys, index);
  }

  private async policy(ws: ScopedWorkspace, id: string): Promise<StaffPolicy> {
    const row = assertOwnedByOrg(await this.content.findPolicy(id), ws);
    const targets = await this.content.targetsOf('policy', [row.id]);
    return presentPolicy(row, targets.get(row.id));
  }

  // --- Staff announcements (AC-PF9) ------------------------------------------------------

  async announcements(ws: ScopedWorkspace): Promise<StaffAnnouncementList> {
    const rows = await this.content.announcements(orgOf(ws));
    const targets = await this.content.targetsOf('announcement', rows.map((r) => r.id));
    return { announcements: rows.map((r) => presentAnnouncement(r, targets.get(r.id))) };
  }

  async createAnnouncement(
    ws: ScopedWorkspace,
    userId: string,
    body: CreateStaffAnnouncementRequest,
  ): Promise<StaffAnnouncement> {
    const orgId = orgOf(ws);
    assertExpiry(body.expiresOn);
    const targets = await this.checkTargets(ws, orgId, body.audience, body.targets);
    const fileKeys = [...new Set(body.fileKeys ?? [])];
    await this.files.assertOwn(ws, 'attachment', fileKeys);
    const id = await this.db.transaction(async (tx) => {
      const created = await this.content.insertAnnouncement(tx, {
        orgId,
        title: body.title.trim(),
        body: body.body.trim(),
        fileKeys,
        audience: body.audience,
        expiresOn: body.expiresOn ?? null,
        commentsAllowed: body.commentsAllowed ?? true,
        createdByUserId: userId,
      });
      await this.content.setTargets(tx, 'announcement', orgId, created, targets);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.announcement_published',
        orgId,
        diff: { announcementId: { to: created }, audience: { to: body.audience } },
      });
      // The automations deliver it to the audience (058-reports-automations).
      await writeHrEvent(tx, {
        trigger: 'announcement.published',
        aggregateType: 'staff_announcement',
        aggregateId: created,
        change: 'published',
        workspaceId: ws.workspaceId,
        payload: { announcementId: created },
      });
      return created;
    });
    return this.announcement(ws, id);
  }

  async updateAnnouncement(
    ws: ScopedWorkspace,
    userId: string,
    id: string,
    body: UpdateStaffAnnouncementRequest,
  ): Promise<StaffAnnouncement> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.content.findAnnouncement(id), ws);
    if (body.expiresOn !== undefined && body.expiresOn !== row.expiresOn) assertExpiry(body.expiresOn);
    const targets = await this.nextTargets(ws, orgId, 'announcement', row, body);
    const fileKeys = await this.nextFileKeys(ws, row.fileKeys, body.fileKeys);
    const values = {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.body !== undefined ? { body: body.body.trim() } : {}),
      ...(fileKeys !== undefined ? { fileKeys } : {}),
      ...(body.audience !== undefined ? { audience: body.audience } : {}),
      ...(body.expiresOn !== undefined ? { expiresOn: body.expiresOn } : {}),
      ...(body.commentsAllowed !== undefined ? { commentsAllowed: body.commentsAllowed } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    };
    const republished = row.status === 'archived' && body.status === 'published';
    await this.db.transaction(async (tx) => {
      await this.content.updateAnnouncement(tx, row.id, values);
      if (targets !== undefined) await this.content.setTargets(tx, 'announcement', orgId, row.id, targets);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: body.status === 'archived' ? 'hr.announcement_archived' : 'hr.announcement_changed',
        orgId,
        diff: { announcementId: { to: row.id }, fields: { to: Object.keys(body) } },
      });
      if (republished) {
        await writeHrEvent(tx, {
          trigger: 'announcement.published',
          aggregateType: 'staff_announcement',
          aggregateId: row.id,
          change: `republished:${new Date().toISOString()}`,
          workspaceId: ws.workspaceId,
          payload: { announcementId: row.id },
        });
      }
    });
    return this.announcement(ws, row.id);
  }

  async announcementFileLink(ws: ScopedWorkspace, id: string, index: number): Promise<FileLink> {
    const row = assertOwnedByOrg(await this.content.findAnnouncement(id), ws);
    return this.linkAt(row.fileKeys, index);
  }

  private async announcement(ws: ScopedWorkspace, id: string): Promise<StaffAnnouncement> {
    const row = assertOwnedByOrg(await this.content.findAnnouncement(id), ws);
    const targets = await this.content.targetsOf('announcement', [row.id]);
    return presentAnnouncement(row, targets.get(row.id));
  }

  // --- Discipline (AC-PF8) ------------------------------------------------------------------

  /** The records in the caller's branches; one person's when named, and 404 for a person outside them. */
  async disciplinaryActions(ws: ScopedWorkspace, employeeId?: string): Promise<DisciplinaryActionList> {
    const orgId = orgOf(ws);
    if (employeeId) {
      const person = assertOwnedByOrg(await this.employees.find(employeeId), ws);
      assertInBranchScope(ws, person.workPropertyId);
    }
    const rows = await this.content.disciplinaryActions({ orgId, scope: ws.branchScope, employeeId });
    return { actions: rows.map(presentDiscipline) };
  }

  /**
   * Record one action against each person named: one row each, so nobody's
   * record shows who else was named (AC-PF8). A dismissal offboards nobody by
   * itself; the answer says to offer it.
   */
  async recordDiscipline(
    ws: ScopedWorkspace,
    userId: string,
    body: CreateDisciplinaryActionRequest,
  ): Promise<CreateDisciplinaryActionResponse> {
    const orgId = orgOf(ws);
    if (!isCalendarDate(body.startsOn)) throw new UnprocessableEntityException('That is not a real date.');
    const type = await this.content.findCatalog('disciplinary-types', body.typeId);
    if (!type || type.orgId !== orgId) throw new UnprocessableEntityException('That disciplinary type is not available here.');
    if (type.status !== 'active') throw new UnprocessableEntityException('That type is archived; choose another.');
    if (body.fileKey) await this.files.assertOwn(ws, 'attachment', [body.fileKey]);
    const ids = [...new Set(body.employeeIds)];
    const people = await this.employees.findMany(ids);
    if (people.length !== ids.length) throw new NotFoundException('Someone named is not on file here.');
    for (const person of people) {
      assertOwnedByOrg(person, ws);
      assertPersonInReach(ws, person.workPropertyId);
      if (person.status !== 'active') {
        throw new ConflictException(`${person.legalName} has left, so nothing more can be recorded on their file.`);
      }
    }
    const written = await this.db.transaction(async (tx) => {
      const out: string[] = [];
      for (const person of people) {
        const actionId = await this.content.insertDisciplinaryAction(tx, {
          orgId,
          employeeId: person.id,
          typeId: type.id,
          description: body.description.trim(),
          unit: body.unit ?? null,
          length: body.length ?? null,
          startsOn: body.startsOn,
          fileKey: body.fileKey ?? null,
          createdByUserId: userId,
        });
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'employee',
          subjectId: person.id,
          eventType: 'hr.disciplinary_recorded',
          orgId,
          diff: { actionId: { to: actionId }, typeId: { to: type.id }, kind: { to: type.kind ?? null } },
        });
        out.push(actionId);
      }
      return out;
    });
    const rows = await this.content.findDisciplinaryActions(written);
    return { actions: rows.map(presentDiscipline), offerOffboarding: type.kind === 'dismissal' };
  }

  /** A record's attachment; every fetch is recorded, as a document's is. */
  async disciplineFileLink(ws: ScopedWorkspace, userId: string, id: string): Promise<FileLink> {
    const [row] = await this.content.findDisciplinaryActions([id]);
    const action = assertOwnedByOrg(row, ws);
    assertInBranchScope(ws, action.workPropertyId);
    if (!action.fileKey) throw new NotFoundException('No file is attached to this record.');
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'employee',
      subjectId: action.employeeId,
      eventType: 'hr.disciplinary_file_viewed',
      orgId: action.orgId,
      diff: { actionId: { to: action.id } },
    });
    return { url: await this.files.link(action.fileKey), expiresInSeconds: HR_FILE_LINK_SECONDS };
  }

  // --- The org chart (AC-PF10) ------------------------------------------------------------

  /** Everyone active in the caller's branches; a manager outside them makes the person a root. */
  async orgChart(ws: ScopedWorkspace): Promise<OrgChart> {
    const rows = await this.employees.orgChart({ orgId: orgOf(ws), scope: ws.branchScope });
    const shown = new Set(rows.map((r) => r.id));
    return {
      nodes: rows.map((r) => ({
        employeeId: r.id,
        displayName: r.displayName,
        jobPositionTitle: r.jobPositionTitle,
        reportingManagerId: r.reportingManagerId && shown.has(r.reportingManagerId) ? r.reportingManagerId : null,
        hasPhoto: r.hasPhoto,
      })),
    };
  }

  // --- Shared ---------------------------------------------------------------------------------

  /**
   * Check who a targeted policy or announcement names (AC-PF7): the business's
   * departments and positions, and people on its file the caller may act on.
   * `all` names nobody, so it clears the set.
   */
  private async checkTargets(
    ws: ScopedWorkspace,
    orgId: string,
    audience: 'all' | 'targeted',
    targets: HrTargets | undefined,
  ): Promise<HrTargets | null> {
    if (audience === 'all') return null;
    const given = targets ?? NO_TARGETS;
    const set = {
      departmentIds: [...new Set(given.departmentIds)],
      jobPositionIds: [...new Set(given.jobPositionIds)],
      employeeIds: [...new Set(given.employeeIds)],
    };
    if (set.departmentIds.length + set.jobPositionIds.length + set.employeeIds.length === 0) {
      throw new UnprocessableEntityException('Choose who it is for.');
    }
    const departments = await this.content.departmentIdsOf(orgId, set.departmentIds);
    if (set.departmentIds.some((d) => !departments.has(d))) {
      throw new UnprocessableEntityException('A department named is not available here.');
    }
    const positions = await this.content.positionIdsOf(orgId, set.jobPositionIds);
    if (set.jobPositionIds.some((p) => !positions.has(p))) {
      throw new UnprocessableEntityException('A job position named is not available here.');
    }
    if (set.employeeIds.length > 0) {
      const people = await this.employees.findMany(set.employeeIds);
      if (people.length !== set.employeeIds.length || people.some((p) => p.orgId !== orgId)) {
        throw new UnprocessableEntityException('Someone named is not on file here.');
      }
      for (const person of people) assertPersonInReach(ws, person.workPropertyId);
    }
    return set;
  }

  /** The audience a PATCH leaves: undefined when it touched neither the audience nor the targets. */
  private async nextTargets(
    ws: ScopedWorkspace,
    orgId: string,
    owner: AudienceOwner,
    row: PolicyRow,
    body: { audience?: 'all' | 'targeted'; targets?: HrTargets },
  ): Promise<HrTargets | null | undefined> {
    if (body.audience === undefined && body.targets === undefined) return undefined;
    const audience = body.audience ?? row.audience;
    if (audience === 'all') return null;
    const given = body.targets ?? (await this.content.targetsOf(owner, [row.id])).get(row.id);
    return this.checkTargets(ws, orgId, audience, given);
  }

  /** The attachments a PATCH leaves; a key new to the row must be this workspace's attachment. */
  private async nextFileKeys(
    ws: ScopedWorkspace,
    current: readonly string[],
    given: readonly string[] | undefined,
  ): Promise<string[] | undefined> {
    if (given === undefined) return undefined;
    const keys = [...new Set(given)];
    await this.files.assertOwn(ws, 'attachment', keys.filter((k) => !current.includes(k)));
    return keys;
  }

  private async linkAt(keys: readonly string[], index: number): Promise<FileLink> {
    const key = Number.isInteger(index) && index >= 0 ? keys[index] : undefined;
    if (!key) throw new NotFoundException('No such attachment.');
    return { url: await this.files.link(key), expiresInSeconds: HR_FILE_LINK_SECONDS };
  }
}

/** A tone is a tag's and a kind a disciplinary type's; anything else sent is a mistake worth naming. */
function assertCatalogFields(kind: HrCatalogKind, body: { tone?: unknown; kind?: unknown }): void {
  if (body.tone !== undefined && kind !== 'tags') throw new UnprocessableEntityException('Only a tag has a tone.');
  if (body.kind !== undefined && kind !== 'disciplinary-types') {
    throw new UnprocessableEntityException('Only a disciplinary type has a kind.');
  }
}

/** An announcement may not be posted already expired. */
function assertExpiry(expiresOn: string | null | undefined): void {
  if (!expiresOn) return;
  if (!isCalendarDate(expiresOn)) throw new UnprocessableEntityException('That is not a real date.');
  if (expiresOn < kigaliToday()) throw new UnprocessableEntityException('An announcement cannot expire before today.');
}

/** The one active title per catalog, held by a partial unique index, in words. */
function titleTaken(error: unknown, title: string): unknown {
  const constraint = violatedConstraint(error);
  if (constraint && constraint.endsWith('_title_uk')) {
    return new ConflictException(`There is already one called "${title}".`);
  }
  return error;
}

function presentCatalog(row: CatalogRow): HrCatalogItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    ...(row.tone ? { tone: row.tone } : {}),
    ...(row.kind ? { kind: row.kind } : {}),
  };
}

function presentPolicy(row: PolicyRow, targets: HrTargets | undefined): StaffPolicy {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    fileKeys: row.fileKeys,
    audience: row.audience,
    targets: targets ?? NO_TARGETS,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function presentAnnouncement(row: AnnouncementRow, targets: HrTargets | undefined): StaffAnnouncement {
  return {
    ...presentPolicy(row, targets),
    expiresOn: row.expiresOn,
    commentsAllowed: row.commentsAllowed,
    viewCount: row.viewCount,
    commentCount: row.commentCount,
  };
}

function presentDiscipline(row: DisciplineRow): DisciplinaryAction {
  return {
    id: row.id,
    employee: rosterCard({
      id: row.employeeId,
      preferredName: row.preferredName,
      legalName: row.legalName,
      jobPositionTitle: row.jobPositionTitle,
    }),
    type: { id: row.typeId, title: row.typeTitle, kind: row.typeKind },
    description: row.description,
    unit: row.unit,
    length: row.length,
    startsOn: row.startsOn,
    hasFile: row.fileKey !== null,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdByName,
  };
}
