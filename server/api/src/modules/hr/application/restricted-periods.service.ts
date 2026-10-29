import type {
  CreateRestrictedLeavePeriodRequest,
  RestrictedLeavePeriod,
  RestrictedLeavePeriodList,
  UpdateRestrictedLeavePeriodRequest,
} from '@injishi/contracts';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { isCalendarDate } from '../../pms/domain/pricing';
import { addDays } from '../domain/hr-calendar';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { LeaveExtraRepository, type PeriodRow } from '../infrastructure/leave-extra.repository';
import { orgOf } from './hr-access';

/**
 * Restricted periods (058-leave AC-LV9): the days a business cannot spare
 * people, such as the high season or an audit. `people.manage` declares them;
 * a leave request overlapping one it falls under is refused, at request and
 * again at approval. A department and job positions narrow together, and a
 * statutory type is never restricted. A period is a setting, so it is edited
 * in place and may be removed; the requests it refused were never made.
 */
@Injectable()
export class RestrictedPeriodsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly extra: LeaveExtraRepository,
  ) {}

  async list(ws: ScopedWorkspace): Promise<RestrictedLeavePeriodList> {
    return { periods: (await this.extra.periods(orgOf(ws))).map(presentPeriod) };
  }

  async create(ws: ScopedWorkspace, userId: string, body: CreateRestrictedLeavePeriodRequest): Promise<RestrictedLeavePeriod> {
    const orgId = orgOf(ws);
    const values = {
      title: body.title.trim(),
      fromDate: body.fromDate,
      toDate: body.toDate,
      departmentId: body.departmentId ?? null,
      typeMode: body.typeMode ?? 'all',
      description: body.description?.trim() || null,
    };
    const scopes = { jobPositionIds: body.jobPositionIds ?? [], leaveTypeIds: values.typeMode === 'all' ? [] : (body.leaveTypeIds ?? []) };
    await this.assertSound(orgId, values, scopes);
    const id = await this.db.transaction(async (tx) => {
      const created = await this.extra.insertPeriod(tx, { orgId, ...values, createdByUserId: userId }, scopes);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.restricted_period_created',
        orgId,
        diff: { periodId: created, ...values, ...scopes },
      });
      return created;
    });
    return this.present(id);
  }

  async update(ws: ScopedWorkspace, userId: string, id: string, body: UpdateRestrictedLeavePeriodRequest): Promise<RestrictedLeavePeriod> {
    const orgId = orgOf(ws);
    const period = assertOwnedByOrg(await this.extra.findPeriod(id), ws);
    const typeMode = body.typeMode ?? period.typeMode;
    const merged = {
      title: body.title?.trim() ?? period.title,
      fromDate: body.fromDate ?? period.fromDate,
      toDate: body.toDate ?? period.toDate,
      departmentId: body.departmentId !== undefined ? body.departmentId : period.departmentId,
      typeMode,
      description: body.description !== undefined ? body.description?.trim() || null : period.description,
    };
    const scopes = {
      jobPositionIds: body.jobPositionIds ?? [...period.jobPositionIds],
      leaveTypeIds: typeMode === 'all' ? [] : (body.leaveTypeIds ?? [...period.leaveTypeIds]),
    };
    await this.assertSound(orgId, merged, scopes);
    await this.db.transaction(async (tx) => {
      await this.extra.updatePeriod(tx, id, orgId, merged, scopes);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.restricted_period_updated',
        orgId,
        diff: { periodId: id, ...body },
      });
    });
    return this.present(id);
  }

  async remove(ws: ScopedWorkspace, userId: string, id: string): Promise<void> {
    const orgId = orgOf(ws);
    const period = assertOwnedByOrg(await this.extra.findPeriod(id), ws);
    await this.db.transaction(async (tx) => {
      await this.extra.deletePeriod(tx, id);
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.restricted_period_removed',
        orgId,
        diff: { periodId: id, title: period.title, fromDate: period.fromDate, toDate: period.toDate },
      });
    });
  }

  /** Real dates, at most a year, and every department, position and type this business's own. */
  private async assertSound(
    orgId: string,
    values: { fromDate: string; toDate: string; departmentId: string | null; typeMode: string },
    scopes: { jobPositionIds: readonly string[]; leaveTypeIds: readonly string[] },
  ): Promise<void> {
    if (!isCalendarDate(values.fromDate) || !isCalendarDate(values.toDate)) throw new UnprocessableEntityException('Those are not real dates.');
    if (values.toDate < values.fromDate) throw new UnprocessableEntityException('It ends before it starts.');
    if (values.toDate > addDays(values.fromDate, 365)) throw new UnprocessableEntityException('A restricted period covers at most a year.');
    if (values.typeMode !== 'all' && scopes.leaveTypeIds.length === 0) {
      throw new UnprocessableEntityException('Name the types it covers or leaves out.');
    }
    if (values.departmentId) {
      const department = await this.extra.departmentOf(values.departmentId);
      if (!department || department.orgId !== orgId) throw new UnprocessableEntityException('That department is not this business’s.');
    }
    const own = await this.extra.ownIds(orgId, scopes.jobPositionIds, scopes.leaveTypeIds);
    if (own.positions !== new Set(scopes.jobPositionIds).size) throw new UnprocessableEntityException('A job position named is not this business’s.');
    if (own.types !== new Set(scopes.leaveTypeIds).size) throw new UnprocessableEntityException('A leave type named is not this business’s.');
  }

  private async present(id: string): Promise<RestrictedLeavePeriod> {
    const row = await this.extra.findPeriod(id);
    if (!row) throw new NotFoundException();
    return presentPeriod(row);
  }
}

function presentPeriod(row: PeriodRow): RestrictedLeavePeriod {
  return {
    id: row.id,
    title: row.title,
    fromDate: row.fromDate,
    toDate: row.toDate,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    jobPositionIds: [...row.jobPositionIds],
    typeMode: row.typeMode,
    leaveTypeIds: [...row.leaveTypeIds],
    description: row.description,
  };
}
